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
  requestId?: string; // originating appointment, if any
  priority?: string; // NORMAL | URGENT | EMERGENCY
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

    // D1 only supports batch transactions, so the trip id is generated
    // up-front to let the dependent writes go in a single batch.
    const tripId = crypto.randomUUID();
    await this.prisma.$transaction([
      this.prisma.trip.create({
        data: {
          id: tripId,
          driverId: input.driverId,
          vehicleId: input.vehicleId,
          originBranchId: input.originBranchId,
          destinationId: input.destinationId,
          status: 'IN_TRANSIT',
          startedAt: input.deviceTimestamp,
          startLat: input.startLat,
          startLng: input.startLng,
          comment: input.comment,
          requestId: input.requestId,
          priority: input.priority ?? 'NORMAL',
        },
      }),
      this.prisma.tripEvent.create({
        data: {
          tripId,
          type: 'START_TRIP',
          userId: input.driverId,
          deviceTimestamp: input.deviceTimestamp,
          comment: input.comment,
          metadata: input.startLat ? toJson({ lat: input.startLat, lng: input.startLng }) : null,
        },
      }),
      this.prisma.vehicle.update({
        where: { id: input.vehicleId },
        data: { currentTripId: tripId },
      }),
    ]);

    return this.getTripDetail(tripId);
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

    await this.prisma.$transaction([
      this.prisma.tripEvent.create({
        data: {
          tripId,
          type: 'FINISH_TRIP',
          userId,
          deviceTimestamp: input.deviceTimestamp,
          comment: input.comment,
          metadata: input.endLat ? toJson({ lat: input.endLat, lng: input.endLng }) : null,
        },
      }),
      this.prisma.trip.update({
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
      }),
      this.prisma.vehicle.update({
        where: { id: trip.vehicleId },
        data: { currentTripId: null },
      }),
    ]);

    // If this trip came from an appointment or a route plan, close the loop.
    if (trip.requestId) {
      await this.prisma.$transaction([
        this.prisma.transportRequest.update({
          where: { id: trip.requestId },
          data: { status: 'COMPLETED', completedAt: finishedAt },
        }),
        this.prisma.requestEvent.create({
          data: { requestId: trip.requestId, type: 'COMPLETED', userId, comment: 'Viaje finalizado' },
        }),
      ]);
    }
    await this.prisma.routePlan.updateMany({
      where: { tripId },
      data: { status: 'DONE' },
    });

    return this.getTripDetail(tripId);
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
    manualVehicle?: boolean;
    page: number;
    limit: number;
  }) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.branchId) where.originBranchId = filters.branchId;
    if (filters.driverId) where.driverId = filters.driverId;
    if (filters.vehicleId) where.vehicleId = filters.vehicleId;
    if (filters.telegramFailed) where.telegramDeliveryStatus = 'FAILED';
    // Viajes donde el vehículo se ingresó a mano (respaldo del escaneo QR);
    // la marca queda en el comentario al iniciar el viaje.
    if (filters.manualVehicle) where.comment = { contains: 'Vehículo ingresado manualmente' };
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

    await this.prisma.$transaction([
      this.prisma.tripEvent.create({
        data: {
          tripId,
          type: 'FORCE_CLOSE',
          userId: adminId,
          deviceTimestamp: finishedAt,
          comment: reason,
        },
      }),
      this.prisma.trip.update({
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
      }),
      this.prisma.vehicle.update({
        where: { id: trip.vehicleId },
        data: { currentTripId: null },
      }),
      this.prisma.auditLog.create({
        data: {
          entityName: 'Trip',
          entityId: tripId,
          adminId,
          action: 'FORCE_CLOSE',
          oldValue: toJson({ status: trip.status }),
          newValue: toJson({ status: 'FINISHED', closureType: 'FORCED' }),
          reason,
        },
      }),
    ]);

    return this.getTripDetail(tripId);
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

    await this.prisma.$transaction([
      this.prisma.trip.update({
        where: { id: tripId },
        data: {
          finishedAt: newFinishedAt,
          durationMinutes,
          closureBranchId: input.closureBranchId ?? trip.closureBranchId,
          comment: input.comment ?? trip.comment,
          closureType: 'ADMIN_CORRECTION',
          correctionFlag: true,
        },
      }),
      this.prisma.tripEvent.create({
        data: {
          tripId,
          type: 'ADMIN_CORRECTION',
          userId: adminId,
          deviceTimestamp: new Date(),
          comment: input.reason,
        },
      }),
      this.prisma.auditLog.create({
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
      }),
    ]);

    return this.getTripDetail(tripId);
  }

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 6);

    const [
      totalToday,
      activeNow,
      withIncident,
      telegramFailed,
      avgDurationResult,
      fuelRecordsToday,
      finishedToday,
      forcedWeek,
      vehiclesTotal,
      vehiclesInUse,
      weekTrips,
      activeTrips,
      weekFuel,
      weekIncidents,
      manualVehicleWeek,
    ] = await Promise.all([
      this.prisma.trip.count({ where: { startedAt: { gte: today } } }),
      this.prisma.trip.count({ where: { status: { in: ACTIVE_STATUSES } } }),
      this.prisma.trip.count({ where: { startedAt: { gte: today }, status: 'IN_INCIDENT' } }),
      this.prisma.trip.count({
        where: { telegramDeliveryStatus: 'FAILED', startedAt: { gte: today } },
      }),
      this.prisma.trip.aggregate({
        _avg: { durationMinutes: true },
        where: { startedAt: { gte: today }, status: 'FINISHED' },
      }),
      this.prisma.fuelRecord.count({ where: { recordedAt: { gte: today } } }),
      this.prisma.trip.count({ where: { startedAt: { gte: today }, status: 'FINISHED' } }),
      this.prisma.trip.count({ where: { startedAt: { gte: weekAgo }, forcedCloseFlag: true } }),
      this.prisma.vehicle.count({ where: { isActive: true } }),
      this.prisma.vehicle.count({ where: { isActive: true, currentTripId: { not: null } } }),
      this.prisma.trip.findMany({
        where: { startedAt: { gte: weekAgo } },
        select: { startedAt: true, status: true, driverId: true, driver: { select: { fullName: true } } },
      }),
      this.prisma.trip.findMany({
        where: { status: { in: ACTIVE_STATUSES } },
        select: {
          id: true,
          status: true,
          startedAt: true,
          driver: { select: { fullName: true } },
          vehicle: { select: { plate: true } },
          destination: { select: { name: true } },
        },
        orderBy: { startedAt: 'asc' },
        take: 20,
      }),
      this.prisma.fuelRecord.aggregate({
        where: { recordedAt: { gte: weekAgo } },
        _sum: { quantity: true, totalAmount: true },
        _count: { id: true },
      }),
      this.prisma.tripEvent.count({
        where: { type: 'REPORT_INCIDENT', serverTimestamp: { gte: weekAgo } },
      }),
      this.prisma.trip.count({
        where: {
          startedAt: { gte: weekAgo },
          comment: { contains: 'Vehículo ingresado manualmente' },
        },
      }),
    ]);

    // Bucket the week's trips per day (done in JS: D1/SQLite lacks date_trunc).
    const trend7d: { date: string; trips: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekAgo);
      d.setDate(d.getDate() + i);
      trend7d.push({ date: d.toISOString().slice(0, 10), trips: 0 });
    }
    const byDriver = new Map<string, { name: string; trips: number }>();
    for (const t of weekTrips) {
      const key = new Date(t.startedAt).toISOString().slice(0, 10);
      const bucket = trend7d.find((b) => b.date === key);
      if (bucket) bucket.trips++;
      const entry = byDriver.get(t.driverId) || { name: t.driver?.fullName || '—', trips: 0 };
      entry.trips++;
      byDriver.set(t.driverId, entry);
    }
    const topDrivers = [...byDriver.values()].sort((a, b) => b.trips - a.trips).slice(0, 5);

    return {
      // Same keys the original Express dashboard returned (frontend contract).
      totalToday,
      activeNow,
      withIncident,
      telegramFailed,
      avgDurationMinutes: Math.round(avgDurationResult._avg.durationMinutes || 0),
      fuelRecordsToday,
      // Executive extensions
      finishedToday,
      forcedWeek,
      weekTrips: weekTrips.length,
      weekIncidents,
      manualVehicleWeek,
      fleet: { total: vehiclesTotal, inUse: vehiclesInUse },
      trend7d,
      topDrivers,
      activeTrips,
      fuelWeek: {
        records: weekFuel._count.id,
        quantity: Math.round((weekFuel._sum.quantity || 0) * 10) / 10,
        amount: Math.round((weekFuel._sum.totalAmount || 0) * 100) / 100,
      },
    };
  }
}
