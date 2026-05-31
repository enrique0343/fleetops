import type { PrismaClient } from '@prisma/client';
import { AppError } from '../lib/http';
import { toJson, fromJson } from '../lib/json';

interface StartTripInput {
  driverId: string;
  vehicleId: string;
  originBranchId: string;
  destinationId: string;
  startLat?: number;
  startLng?: number;
  comment?: string;
  deviceTimestamp: Date;
}

interface EventInput {
  comment?: string;
  lat?: number;
  lng?: number;
  deviceTimestamp: Date;
}

const ACTIVE_STATUSES = ['IN_TRANSIT', 'IN_STOP', 'IN_INCIDENT'];

const VALID_TRANSITIONS: Record<string, string[]> = {
  IN_TRANSIT: ['IN_STOP', 'IN_INCIDENT', 'FINISHED'],
  IN_STOP: ['IN_TRANSIT', 'IN_INCIDENT', 'FINISHED'],
  IN_INCIDENT: ['IN_TRANSIT', 'IN_STOP', 'FINISHED'],
  FINISHED: [],
  CANCELLED: [],
};

export class TripService {
  constructor(private prisma: PrismaClient) {}

  async startTrip(input: StartTripInput) {
    const activeTrip = await this.prisma.trip.findFirst({
      where: { driverId: input.driverId, status: { in: ACTIVE_STATUSES } },
    });
    if (activeTrip) {
      throw new AppError('Ya tienes un viaje activo. Finalízalo antes de iniciar uno nuevo.', 409);
    }

    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw new AppError('Vehículo no encontrado', 404);
    if (vehicle.currentTripId) throw new AppError('El vehículo ya está en uso', 409);

    const trip = await this.prisma.$transaction(async (tx) => {
      const newTrip = await tx.trip.create({
        data: {
          driverId: input.driverId,
          vehicleId: input.vehicleId,
          originBranchId: input.originBranchId,
          destinationId: input.destinationId,
          status: 'IN_TRANSIT',
          startedAt: input.deviceTimestamp,
          startLat: input.startLat,
          startLng: input.startLng,
          comment: input.comment,
        },
      });

      await tx.tripEvent.create({
        data: {
          tripId: newTrip.id,
          type: 'START_TRIP',
          userId: input.driverId,
          deviceTimestamp: input.deviceTimestamp,
          comment: input.comment,
          metadata: input.startLat ? toJson({ lat: input.startLat, lng: input.startLng }) : null,
        },
      });

      await tx.vehicle.update({
        where: { id: input.vehicleId },
        data: { currentTripId: newTrip.id },
      });

      return newTrip;
    });

    return this.getTripDetail(trip.id);
  }

  async getActiveTrip(driverId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { driverId, status: { in: ACTIVE_STATUSES } },
      include: {
        vehicle: true,
        originBranch: true,
        destination: true,
        events: { orderBy: { serverTimestamp: 'desc' } },
      },
    });
    return trip ? this.decodeEvents(trip) : null;
  }

  async getDriverHistory(driverId: string, page: number, limit: number) {
    const [trips, total] = await Promise.all([
      this.prisma.trip.findMany({
        where: { driverId },
        include: {
          vehicle: { select: { plate: true, brand: true, model: true } },
          originBranch: { select: { name: true } },
          destination: { select: { name: true } },
        },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.trip.count({ where: { driverId } }),
    ]);

    return { data: trips, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  registerStop(tripId: string, userId: string, input: EventInput) {
    return this.transitionTrip(tripId, userId, 'IN_STOP', 'ARRIVE_STOP', input);
  }

  resumeTrip(tripId: string, userId: string, input: EventInput) {
    return this.transitionTrip(tripId, userId, 'IN_TRANSIT', 'RESUME_TRIP', input);
  }

  async reportIncident(tripId: string, userId: string, input: EventInput & { incidentTypeId?: string }) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new AppError('Viaje no encontrado', 404);

    await this.prisma.tripEvent.create({
      data: {
        tripId,
        type: 'REPORT_INCIDENT',
        userId,
        deviceTimestamp: input.deviceTimestamp,
        comment: input.comment,
        metadata: toJson({ incidentTypeId: input.incidentTypeId, lat: input.lat, lng: input.lng }),
      },
    });

    const updated = await this.prisma.trip.update({
      where: { id: tripId },
      data: { status: 'IN_INCIDENT' },
    });

    return this.getTripDetail(updated.id);
  }

  private async transitionTrip(
    tripId: string,
    userId: string,
    newStatus: string,
    eventType: string,
    input: EventInput
  ) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new AppError('Viaje no encontrado', 404);

    const allowed = VALID_TRANSITIONS[trip.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new AppError(`No se puede cambiar de ${trip.status} a ${newStatus}`, 400);
    }

    await this.prisma.tripEvent.create({
      data: {
        tripId,
        type: eventType,
        userId,
        deviceTimestamp: input.deviceTimestamp,
        comment: input.comment,
        metadata: input.lat ? toJson({ lat: input.lat, lng: input.lng }) : null,
      },
    });

    const updated = await this.prisma.trip.update({
      where: { id: tripId },
      data: { status: newStatus },
    });

    return this.getTripDetail(updated.id);
  }

  async finishTrip(
    tripId: string,
    userId: string,
    input: EventInput & { endLat?: number; endLng?: number; closureBranchId?: string }
  ) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new AppError('Viaje no encontrado', 404);
    if (trip.status === 'FINISHED' || trip.status === 'CANCELLED') {
      throw new AppError('El viaje ya está finalizado', 400);
    }

    const finishedAt = input.deviceTimestamp;
    const durationMinutes = Math.round((finishedAt.getTime() - trip.startedAt.getTime()) / 60000);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.tripEvent.create({
        data: {
          tripId,
          type: 'FINISH_TRIP',
          userId,
          deviceTimestamp: input.deviceTimestamp,
          comment: input.comment,
          metadata: input.endLat ? toJson({ lat: input.endLat, lng: input.endLng }) : null,
        },
      });

      const t = await tx.trip.update({
        where: { id: tripId },
        data: {
          status: 'FINISHED',
          closureType: 'NORMAL',
          finishedAt,
          durationMinutes,
          endLat: input.endLat,
          endLng: input.endLng,
          closureBranchId: input.closureBranchId,
          comment: input.comment || trip.comment,
        },
      });

      await tx.vehicle.update({
        where: { id: trip.vehicleId },
        data: { currentTripId: null },
      });

      return t;
    });

    return this.getTripDetail(updated.id);
  }

  async getTripDetail(tripId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        driver: { select: { id: true, fullName: true, email: true, phone: true } },
        vehicle: true,
        originBranch: true,
        destination: true,
        closureBranch: true,
        events: {
          orderBy: { serverTimestamp: 'asc' },
          include: { user: { select: { fullName: true } } },
        },
        fuelRecords: true,
      },
    });

    if (!trip) throw new AppError('Viaje no encontrado', 404);
    return this.decodeEvents(trip);
  }

  // Decode JSON-encoded event metadata back into objects for the API response.
  private decodeEvents<T extends { events?: any[] }>(trip: T): T {
    if (Array.isArray(trip.events)) {
      trip.events = trip.events.map((e: any) => ({ ...e, metadata: fromJson(e.metadata) }));
    }
    return trip;
  }

  async getAdminTrips(filters: {
    status?: string;
    branchId?: string;
    driverId?: string;
    vehicleId?: string;
    dateFrom?: string;
    dateTo?: string;
    telegramFailed?: boolean;
    page: number;
    limit: number;
  }) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.branchId) where.originBranchId = filters.branchId;
    if (filters.driverId) where.driverId = filters.driverId;
    if (filters.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters.telegramFailed) where.telegramDeliveryStatus = 'FAILED';
    if (filters.dateFrom || filters.dateTo) {
      where.startedAt = {};
      if (filters.dateFrom) where.startedAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.startedAt.lte = new Date(filters.dateTo);
    }

    const [trips, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        include: {
          driver: { select: { fullName: true } },
          vehicle: { select: { plate: true } },
          originBranch: { select: { name: true } },
          destination: { select: { name: true } },
        },
        orderBy: { startedAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.trip.count({ where }),
    ]);

    return {
      data: trips,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(total / filters.limit),
    };
  }

  async forceCloseTrip(tripId: string, adminId: string, reason: string, closureBranchId?: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new AppError('Viaje no encontrado', 404);
    if (trip.status === 'FINISHED' || trip.status === 'CANCELLED') {
      throw new AppError('El viaje ya está finalizado', 400);
    }

    const finishedAt = new Date();
    const durationMinutes = Math.round((finishedAt.getTime() - trip.startedAt.getTime()) / 60000);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.tripEvent.create({
        data: {
          tripId,
          type: 'FORCE_CLOSE',
          userId: adminId,
          deviceTimestamp: finishedAt,
          comment: reason,
        },
      });

      const t = await tx.trip.update({
        where: { id: tripId },
        data: {
          status: 'FINISHED',
          closureType: 'FORCED',
          forcedCloseFlag: true,
          finishedAt,
          durationMinutes,
          closureBranchId,
          comment: reason,
        },
      });

      await tx.vehicle.update({
        where: { id: trip.vehicleId },
        data: { currentTripId: null },
      });

      await tx.auditLog.create({
        data: {
          entityName: 'Trip',
          entityId: tripId,
          adminId,
          action: 'FORCE_CLOSE',
          oldValue: toJson({ status: trip.status }),
          newValue: toJson({ status: 'FINISHED', closureType: 'FORCED' }),
          reason,
        },
      });

      return t;
    });

    return this.getTripDetail(updated.id);
  }

  async correctTrip(
    tripId: string,
    adminId: string,
    input: { reason: string; finishedAt?: string; closureBranchId?: string; comment?: string }
  ) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new AppError('Viaje no encontrado', 404);

    const oldValue = {
      finishedAt: trip.finishedAt,
      closureBranchId: trip.closureBranchId,
      comment: trip.comment,
    };

    const newFinishedAt = input.finishedAt ? new Date(input.finishedAt) : trip.finishedAt;
    const durationMinutes = newFinishedAt
      ? Math.round((newFinishedAt.getTime() - trip.startedAt.getTime()) / 60000)
      : trip.durationMinutes;

    const updated = await this.prisma.$transaction(async (tx) => {
      const t = await tx.trip.update({
        where: { id: tripId },
        data: {
          finishedAt: newFinishedAt,
          durationMinutes,
          closureBranchId: input.closureBranchId ?? trip.closureBranchId,
          comment: input.comment ?? trip.comment,
          closureType: 'ADMIN_CORRECTION',
          correctionFlag: true,
        },
      });

      await tx.tripEvent.create({
        data: {
          tripId,
          type: 'ADMIN_CORRECTION',
          userId: adminId,
          deviceTimestamp: new Date(),
          comment: input.reason,
        },
      });

      await tx.auditLog.create({
        data: {
          entityName: 'Trip',
          entityId: tripId,
          adminId,
          action: 'CORRECTION',
          oldValue: toJson(oldValue),
          newValue: toJson({
            finishedAt: newFinishedAt,
            closureBranchId: input.closureBranchId,
            comment: input.comment,
          }),
          reason: input.reason,
        },
      });

      return t;
    });

    return this.getTripDetail(updated.id);
  }

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalToday, activeNow, incidentsToday, telegramFailed, avgDurationResult, fuelToday] =
      await Promise.all([
        this.prisma.trip.count({ where: { startedAt: { gte: today } } }),
        this.prisma.trip.count({ where: { status: { in: ACTIVE_STATUSES } } }),
        this.prisma.trip.count({ where: { status: 'IN_INCIDENT' } }),
        this.prisma.trip.count({ where: { telegramDeliveryStatus: 'FAILED' } }),
        this.prisma.trip.aggregate({ _avg: { durationMinutes: true }, where: { status: 'FINISHED' } }),
        this.prisma.fuelRecord.count({ where: { recordedAt: { gte: today } } }),
      ]);

    return {
      totalToday,
      activeNow,
      incidentsToday,
      telegramFailed,
      avgDuration: Math.round(avgDurationResult._avg.durationMinutes || 0),
      fuelToday,
    };
  }
}
