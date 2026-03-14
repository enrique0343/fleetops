import { prisma } from '../config/database';
import { TripStatus, TripEventType, ClosureType, TelegramDeliveryStatus } from '@prisma/client';
import { notificationService } from '../adapters/notification';
import { AppError } from '../middleware/errorHandler';

// Fire notification without blocking the response
function fireNotification(fn: () => Promise<unknown>) {
  setImmediate(async () => {
    try { await fn(); } catch (err) { console.error('[NOTIFICATION] Unexpected error:', err); }
  });
}

const VALID_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  IN_TRANSIT: [TripStatus.IN_STOP, TripStatus.IN_INCIDENT, TripStatus.FINISHED, TripStatus.CANCELLED],
  IN_STOP: [TripStatus.IN_TRANSIT, TripStatus.IN_INCIDENT, TripStatus.FINISHED],
  IN_INCIDENT: [TripStatus.IN_TRANSIT, TripStatus.FINISHED],
  FINISHED: [],
  CANCELLED: [],
};

export function validateTransition(from: TripStatus, to: TripStatus): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new AppError(`Transición inválida: ${from} → ${to}. Permitidas: ${allowed.join(', ')}`, 400);
  }
}

export const TripService = {

  async startTrip(params: {
    driverId: string; vehicleId: string; originBranchId: string;
    destinationId: string; comment?: string; deviceTimestamp: string;
    lat?: number; lng?: number;
  }) {
    const activeTrip = await prisma.trip.findFirst({
      where: { driverId: params.driverId, status: { notIn: ['FINISHED', 'CANCELLED'] } },
    });
    if (activeTrip) throw new AppError('Ya tienes un viaje activo. Finalízalo antes de iniciar uno nuevo.', 409);

    const vehicle = await prisma.vehicle.findUnique({ where: { id: params.vehicleId } });
    if (!vehicle) throw new AppError('Vehículo no encontrado', 404);
    if (!vehicle.isActive) throw new AppError('Vehículo inactivo', 400);
    if (vehicle.currentTripId) throw new AppError('Vehículo en uso por otro viaje activo', 409);

    const startedAt = new Date();

    const [trip] = await prisma.$transaction(async (tx) => {
      const newTrip = await tx.trip.create({
        data: {
          driverId: params.driverId, vehicleId: params.vehicleId,
          originBranchId: params.originBranchId, destinationId: params.destinationId,
          status: TripStatus.IN_TRANSIT, startedAt,
          comment: params.comment, startLat: params.lat, startLng: params.lng,
        },
        include: {
          driver: { select: { fullName: true, email: true } },
          vehicle: { select: { plate: true, model: true, brand: true } },
          originBranch: { select: { name: true } },
          destination: { select: { name: true } },
        },
      });
      await tx.vehicle.update({ where: { id: params.vehicleId }, data: { currentTripId: newTrip.id } });
      await tx.tripEvent.create({
        data: {
          tripId: newTrip.id, type: TripEventType.START_TRIP, userId: params.driverId,
          deviceTimestamp: new Date(params.deviceTimestamp), comment: params.comment,
          metadata: params.lat ? { lat: params.lat, lng: params.lng } : null,
        },
      });
      return [newTrip];
    });

    // Telegram: viaje iniciado
    fireNotification(() => notificationService.sendTripStarted({
      tripId: trip.id, driverName: trip.driver.fullName, vehiclePlate: trip.vehicle.plate,
      origin: trip.originBranch.name, destination: trip.destination.name,
      startedAt, comment: params.comment,
    }));

    return trip;
  },

  async registerStop(params: {
    tripId: string; userId: string; comment?: string;
    deviceTimestamp: string; lat?: number; lng?: number;
  }) {
    const trip = await this.getActiveTrip(params.tripId, true);
    validateTransition(trip.status, TripStatus.IN_STOP);

    await prisma.$transaction(async (tx) => {
      await tx.trip.update({ where: { id: params.tripId }, data: { status: TripStatus.IN_STOP } });
      await tx.tripEvent.create({
        data: {
          tripId: params.tripId, type: TripEventType.ARRIVE_STOP, userId: params.userId,
          deviceTimestamp: new Date(params.deviceTimestamp), comment: params.comment,
          metadata: params.lat ? { lat: params.lat, lng: params.lng } : null,
        },
      });
    });

    const t = trip as any;
    fireNotification(() => notificationService.sendTripStop({
      tripId: params.tripId, driverName: t.driver?.fullName || 'Motorista',
      vehiclePlate: t.vehicle?.plate || '—', destination: t.destination?.name || '—',
      comment: params.comment, timestamp: new Date(),
    }));

    return await prisma.trip.findUnique({ where: { id: params.tripId } });
  },

  async resumeTrip(params: {
    tripId: string; userId: string; comment?: string; deviceTimestamp: string;
  }) {
    const trip = await this.getActiveTrip(params.tripId, true);
    validateTransition(trip.status, TripStatus.IN_TRANSIT);

    await prisma.$transaction(async (tx) => {
      await tx.trip.update({ where: { id: params.tripId }, data: { status: TripStatus.IN_TRANSIT } });
      await tx.tripEvent.create({
        data: {
          tripId: params.tripId, type: TripEventType.RESUME_TRIP, userId: params.userId,
          deviceTimestamp: new Date(params.deviceTimestamp), comment: params.comment,
        },
      });
    });

    const t = trip as any;
    fireNotification(() => notificationService.sendTripResume({
      tripId: params.tripId, driverName: t.driver?.fullName || 'Motorista',
      vehiclePlate: t.vehicle?.plate || '—', destination: t.destination?.name || '—',
      timestamp: new Date(),
    }));

    return await prisma.trip.findUnique({ where: { id: params.tripId } });
  },

  async reportIncident(params: {
    tripId: string; userId: string; incidentTypeId?: string;
    comment: string; deviceTimestamp: string; lat?: number; lng?: number;
  }) {
    const trip = await this.getActiveTrip(params.tripId, true);
    validateTransition(trip.status, TripStatus.IN_INCIDENT);

    await prisma.$transaction(async (tx) => {
      await tx.trip.update({ where: { id: params.tripId }, data: { status: TripStatus.IN_INCIDENT } });
      await tx.tripEvent.create({
        data: {
          tripId: params.tripId, type: TripEventType.REPORT_INCIDENT, userId: params.userId,
          deviceTimestamp: new Date(params.deviceTimestamp), comment: params.comment,
          metadata: { incidentTypeId: params.incidentTypeId, lat: params.lat, lng: params.lng },
        },
      });
    });

    const t = trip as any;
    fireNotification(() => notificationService.sendIncident({
      tripId: params.tripId, driverName: t.driver?.fullName || 'Motorista',
      vehiclePlate: t.vehicle?.plate || '—', destination: t.destination?.name || '—',
      incidentComment: params.comment, timestamp: new Date(),
    }));

    return await prisma.trip.findUnique({ where: { id: params.tripId } });
  },

  async finishTrip(params: {
    tripId: string; userId: string; closureBranchId?: string;
    comment?: string; deviceTimestamp: string; lat?: number; lng?: number;
  }) {
    const trip = await this.getActiveTrip(params.tripId, true);
    validateTransition(trip.status, TripStatus.FINISHED);

    const finishedAt = new Date();
    const durationMinutes = Math.round((finishedAt.getTime() - trip.startedAt.getTime()) / 60000);

    const updatedTrip = await prisma.$transaction(async (tx) => {
      const updated = await tx.trip.update({
        where: { id: params.tripId },
        data: {
          status: TripStatus.FINISHED, closureType: ClosureType.NORMAL,
          finishedAt, durationMinutes,
          closureBranchId: params.closureBranchId,
          comment: params.comment || trip.comment,
          endLat: params.lat, endLng: params.lng,
        },
        include: {
          driver: { select: { fullName: true } },
          vehicle: { select: { plate: true } },
          originBranch: { select: { name: true } },
          destination: { select: { name: true } },
        },
      });
      await tx.vehicle.update({ where: { id: trip.vehicleId }, data: { currentTripId: null } });
      await tx.tripEvent.create({
        data: {
          tripId: params.tripId, type: TripEventType.FINISH_TRIP, userId: params.userId,
          deviceTimestamp: new Date(params.deviceTimestamp), comment: params.comment,
          metadata: params.lat ? { lat: params.lat, lng: params.lng } : null,
        },
      });
      return updated;
    });

    // Telegram: resumen completo
    setImmediate(async () => {
      try {
        const results = await notificationService.sendTripFinished({
          tripId: updatedTrip.id, driverName: updatedTrip.driver.fullName,
          vehiclePlate: updatedTrip.vehicle.plate, origin: updatedTrip.originBranch.name,
          destination: updatedTrip.destination.name, startedAt: updatedTrip.startedAt,
          finishedAt, durationMinutes, comment: params.comment,
        });

        const r = results[0];
        const deliveryStatus = r?.success
          ? TelegramDeliveryStatus.SENT
          : r?.error?.includes('no configurado') ? TelegramDeliveryStatus.NOT_CONFIGURED : TelegramDeliveryStatus.FAILED;

        await prisma.$transaction(async (tx) => {
          await tx.trip.update({
            where: { id: updatedTrip.id },
            data: { telegramDeliveryStatus: deliveryStatus, telegramLastAttemptAt: new Date(), telegramLastResult: r?.error || 'OK' },
          });
          await tx.tripEvent.create({
            data: {
              tripId: updatedTrip.id,
              type: r?.success ? TripEventType.TELEGRAM_SENT : TripEventType.TELEGRAM_FAILED,
              userId: params.userId, deviceTimestamp: new Date(),
              comment: r?.error || 'Resumen enviado',
              metadata: { channel: 'telegram', messageId: r?.messageId },
            },
          });
        });
      } catch (err) {
        console.error('[TELEGRAM] Error:', err);
        await prisma.trip.update({
          where: { id: updatedTrip.id },
          data: { telegramDeliveryStatus: TelegramDeliveryStatus.FAILED, telegramLastAttemptAt: new Date(), telegramLastResult: err instanceof Error ? err.message : 'Error' },
        });
      }
    });

    return updatedTrip;
  },

  async forceClose(params: { tripId: string; adminId: string; reason: string; closureBranchId?: string }) {
    const trip = await prisma.trip.findUnique({
      where: { id: params.tripId },
      include: {
        driver: { select: { fullName: true } }, vehicle: { select: { plate: true } },
        originBranch: { select: { name: true } }, destination: { select: { name: true } },
      },
    });
    if (!trip) throw new AppError('Viaje no encontrado', 404);
    if (trip.status === TripStatus.FINISHED || trip.status === TripStatus.CANCELLED) throw new AppError('El viaje ya está finalizado', 400);

    const finishedAt = new Date();
    const durationMinutes = Math.round((finishedAt.getTime() - trip.startedAt.getTime()) / 60000);

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.trip.update({
        where: { id: params.tripId },
        data: { status: TripStatus.FINISHED, closureType: ClosureType.FORCED, forcedCloseFlag: true, finishedAt, durationMinutes, closureBranchId: params.closureBranchId },
      });
      await tx.vehicle.update({ where: { id: trip.vehicleId }, data: { currentTripId: null } });
      await tx.tripEvent.create({
        data: { tripId: params.tripId, type: TripEventType.FORCE_CLOSE, userId: params.adminId, deviceTimestamp: new Date(), comment: params.reason, metadata: { adminId: params.adminId } },
      });
      await tx.auditLog.create({
        data: { entityName: 'Trip', entityId: params.tripId, adminId: params.adminId, action: 'FORCE_CLOSE', oldValue: { status: trip.status }, newValue: { status: 'FINISHED', closureType: 'FORCED', finishedAt }, reason: params.reason },
      });
      return result;
    });

    fireNotification(() => notificationService.sendTripFinished({
      tripId: params.tripId, driverName: trip.driver.fullName, vehiclePlate: trip.vehicle.plate,
      origin: trip.originBranch.name, destination: trip.destination.name,
      startedAt: trip.startedAt, finishedAt, durationMinutes,
      comment: `⚡ CIERRE FORZOSO — ${params.reason}`,
    }));

    return updated;
  },

  async adminCorrection(params: {
    tripId: string; adminId: string; reason: string;
    corrections: { finishedAt?: string; closureBranchId?: string; comment?: string };
  }) {
    const trip = await prisma.trip.findUnique({ where: { id: params.tripId } });
    if (!trip) throw new AppError('Viaje no encontrado', 404);

    const updateData: Record<string, unknown> = { correctionFlag: true, closureType: ClosureType.ADMIN_CORRECTION };
    if (params.corrections.finishedAt) {
      updateData.finishedAt = new Date(params.corrections.finishedAt);
      updateData.durationMinutes = Math.round((new Date(params.corrections.finishedAt).getTime() - trip.startedAt.getTime()) / 60000);
    }
    if (params.corrections.closureBranchId) updateData.closureBranchId = params.corrections.closureBranchId;
    if (params.corrections.comment !== undefined) updateData.comment = params.corrections.comment;

    return await prisma.$transaction(async (tx) => {
      const updated = await tx.trip.update({ where: { id: params.tripId }, data: updateData });
      await tx.tripEvent.create({
        data: { tripId: params.tripId, type: TripEventType.ADMIN_CORRECTION, userId: params.adminId, deviceTimestamp: new Date(), comment: params.reason, metadata: { corrections: params.corrections } },
      });
      await tx.auditLog.create({
        data: { entityName: 'Trip', entityId: params.tripId, adminId: params.adminId, action: 'ADMIN_CORRECTION', oldValue: { finishedAt: trip.finishedAt, closureBranchId: trip.closureBranchId, comment: trip.comment }, newValue: params.corrections, reason: params.reason },
      });
      return updated;
    });
  },

  async retryTelegram(tripId: string, adminId: string) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        driver: { select: { fullName: true } }, vehicle: { select: { plate: true } },
        originBranch: { select: { name: true } }, destination: { select: { name: true } },
      },
    });
    if (!trip) throw new AppError('Viaje no encontrado', 404);
    if (trip.status !== TripStatus.FINISHED) throw new AppError('Solo se puede reintentar en viajes finalizados', 400);

    const results = await notificationService.sendTripFinished({
      tripId: trip.id, driverName: trip.driver.fullName, vehiclePlate: trip.vehicle.plate,
      origin: trip.originBranch.name, destination: trip.destination.name,
      startedAt: trip.startedAt, finishedAt: trip.finishedAt!, durationMinutes: trip.durationMinutes || 0, comment: trip.comment,
    });

    const r = results[0];
    const deliveryStatus = r?.success ? TelegramDeliveryStatus.SENT : TelegramDeliveryStatus.FAILED;

    await prisma.$transaction(async (tx) => {
      await tx.trip.update({ where: { id: tripId }, data: { telegramDeliveryStatus: deliveryStatus, telegramLastAttemptAt: new Date(), telegramLastResult: r?.error || 'OK' } });
      await tx.tripEvent.create({
        data: { tripId, type: r?.success ? TripEventType.TELEGRAM_SENT : TripEventType.TELEGRAM_FAILED, userId: adminId, deviceTimestamp: new Date(), comment: `Reintento manual: ${r?.error || 'OK'}` },
      });
    });

    return { success: r?.success, result: r };
  },

  async getActiveTrip(tripId: string, includeRelations = false) {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: includeRelations ? {
        driver: { select: { fullName: true } }, vehicle: { select: { plate: true } },
        originBranch: { select: { name: true } }, destination: { select: { name: true } },
      } : undefined,
    });
    if (!trip) throw new AppError('Viaje no encontrado', 404);
    if (trip.status === TripStatus.FINISHED || trip.status === TripStatus.CANCELLED) throw new AppError('Este viaje ya está finalizado', 400);
    return trip;
  },
};
