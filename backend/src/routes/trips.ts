import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authenticate, requireAdmin } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { TripService } from '../services/tripService';
import { prisma } from '../config/database';

const router = Router();
router.use(authenticate);

// ─── Get My Active Trip ───
router.get('/my/active', asyncHandler(async (req: Request, res: Response) => {
  const trip = await prisma.trip.findFirst({
    where: {
      driverId: req.user!.userId,
      status: { notIn: ['FINISHED', 'CANCELLED'] },
    },
    include: {
      vehicle: { select: { id: true, plate: true, model: true, brand: true } },
      originBranch: { select: { id: true, name: true } },
      destination: { select: { id: true, name: true, type: true } },
      events: { orderBy: { serverTimestamp: 'asc' } },
    },
  });

  res.json({ success: true, data: trip });
}));

// ─── Get My Trips (history) ───
router.get('/my/history', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page) || '1');
  const limit = parseInt(String(req.query.limit) || '20');

  const [trips, total] = await prisma.$transaction([
    prisma.trip.findMany({
      where: { driverId: req.user!.userId },
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        vehicle: { select: { plate: true, model: true, brand: true } },
        originBranch: { select: { name: true } },
        destination: { select: { name: true } },
        closureBranch: { select: { name: true } },
      },
    }),
    prisma.trip.count({ where: { driverId: req.user!.userId } }),
  ]);

  res.json({
    success: true,
    data: trips,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}));

// ─── Start Trip ───
router.post(
  '/start',
  [
    body('vehicleId').notEmpty().withMessage('Vehículo requerido'),
    body('originBranchId').notEmpty().withMessage('Sucursal de origen requerida'),
    body('destinationId').notEmpty().withMessage('Destino requerido'),
    body('deviceTimestamp').notEmpty().withMessage('Timestamp del dispositivo requerido'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const trip = await TripService.startTrip({
      driverId: req.user!.userId,
      vehicleId: req.body.vehicleId,
      originBranchId: req.body.originBranchId,
      destinationId: req.body.destinationId,
      comment: req.body.comment,
      deviceTimestamp: req.body.deviceTimestamp,
      lat: req.body.lat,
      lng: req.body.lng,
    });

    res.status(201).json({ success: true, data: trip });
  })
);

// ─── Register Stop ───
router.post(
  '/:tripId/stop',
  asyncHandler(async (req: Request, res: Response) => {
    const trip = await TripService.registerStop({
      tripId: req.params.tripId,
      userId: req.user!.userId,
      comment: req.body.comment,
      deviceTimestamp: req.body.deviceTimestamp || new Date().toISOString(),
      lat: req.body.lat,
      lng: req.body.lng,
    });
    res.json({ success: true, data: trip });
  })
);

// ─── Resume Trip ───
router.post(
  '/:tripId/resume',
  asyncHandler(async (req: Request, res: Response) => {
    const trip = await TripService.resumeTrip({
      tripId: req.params.tripId,
      userId: req.user!.userId,
      comment: req.body.comment,
      deviceTimestamp: req.body.deviceTimestamp || new Date().toISOString(),
    });
    res.json({ success: true, data: trip });
  })
);

// ─── Report Incident ───
router.post(
  '/:tripId/incident',
  [body('comment').notEmpty().withMessage('Descripción de la incidencia requerida')],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const trip = await TripService.reportIncident({
      tripId: req.params.tripId,
      userId: req.user!.userId,
      incidentTypeId: req.body.incidentTypeId,
      comment: req.body.comment,
      deviceTimestamp: req.body.deviceTimestamp || new Date().toISOString(),
      lat: req.body.lat,
      lng: req.body.lng,
    });
    res.json({ success: true, data: trip });
  })
);

// ─── Finish Trip ───
router.post(
  '/:tripId/finish',
  asyncHandler(async (req: Request, res: Response) => {
    const trip = await TripService.finishTrip({
      tripId: req.params.tripId,
      userId: req.user!.userId,
      closureBranchId: req.body.closureBranchId,
      comment: req.body.comment,
      deviceTimestamp: req.body.deviceTimestamp || new Date().toISOString(),
      lat: req.body.lat,
      lng: req.body.lng,
    });
    res.json({ success: true, data: trip });
  })
);

// ─── Get Trip Detail ───
router.get('/:tripId', asyncHandler(async (req: Request, res: Response) => {
  const trip = await prisma.trip.findUnique({
    where: { id: req.params.tripId },
    include: {
      driver: { select: { id: true, fullName: true, email: true } },
      vehicle: { select: { id: true, plate: true, model: true, brand: true } },
      originBranch: { select: { id: true, name: true } },
      destination: { select: { id: true, name: true, type: true } },
      closureBranch: { select: { id: true, name: true } },
      events: {
        orderBy: { serverTimestamp: 'asc' },
        include: { user: { select: { id: true, fullName: true, role: true } } },
      },
    },
  });

  if (!trip) throw new AppError('Viaje no encontrado', 404);

  // Drivers can only see their own trips
  if (req.user!.role === 'DRIVER' && trip.driverId !== req.user!.userId) {
    throw new AppError('No tienes acceso a este viaje', 403);
  }

  res.json({ success: true, data: trip });
}));

// ─── ADMIN: List All Trips ───
router.get('/', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page) || '1');
  const limit = parseInt(String(req.query.limit) || '20');
  const { status, branchId, driverId, vehicleId, dateFrom, dateTo, telegramFailed } = req.query;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (branchId) where.originBranchId = branchId;
  if (driverId) where.driverId = driverId;
  if (vehicleId) where.vehicleId = vehicleId;
  if (telegramFailed === 'true') where.telegramDeliveryStatus = 'FAILED';
  if (dateFrom || dateTo) {
    where.startedAt = {
      ...(dateFrom ? { gte: new Date(String(dateFrom)) } : {}),
      ...(dateTo ? { lte: new Date(String(dateTo)) } : {}),
    };
  }

  const [trips, total] = await prisma.$transaction([
    prisma.trip.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        driver: { select: { id: true, fullName: true } },
        vehicle: { select: { id: true, plate: true, model: true } },
        originBranch: { select: { id: true, name: true } },
        destination: { select: { id: true, name: true } },
        closureBranch: { select: { id: true, name: true } },
        _count: { select: { events: true } },
      },
    }),
    prisma.trip.count({ where }),
  ]);

  res.json({
    success: true,
    data: trips,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}));

// ─── ADMIN: Force Close ───
router.post(
  '/:tripId/force-close',
  requireAdmin,
  [body('reason').notEmpty().withMessage('Motivo obligatorio para cierre forzoso')],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const trip = await TripService.forceClose({
      tripId: req.params.tripId,
      adminId: req.user!.userId,
      reason: req.body.reason,
      closureBranchId: req.body.closureBranchId,
    });
    res.json({ success: true, data: trip });
  })
);

// ─── ADMIN: Correction ───
router.patch(
  '/:tripId/correction',
  requireAdmin,
  [body('reason').notEmpty().withMessage('Motivo obligatorio para corrección')],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const trip = await TripService.adminCorrection({
      tripId: req.params.tripId,
      adminId: req.user!.userId,
      reason: req.body.reason,
      corrections: req.body.corrections,
    });
    res.json({ success: true, data: trip });
  })
);

// ─── ADMIN: Retry Telegram ───
router.post(
  '/:tripId/retry-telegram',
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await TripService.retryTelegram(req.params.tripId, req.user!.userId);
    res.json({ success: true, data: result });
  })
);

// ─── ADMIN: Dashboard Stats ───
router.get('/admin/dashboard', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    totalToday,
    activeNow,
    withIncident,
    telegramFailed,
    avgDuration,
    fuelToday,
  ] = await prisma.$transaction([
    prisma.trip.count({ where: { startedAt: { gte: today } } }),
    prisma.trip.count({ where: { status: { notIn: ['FINISHED', 'CANCELLED'] } } }),
    prisma.trip.count({ where: { startedAt: { gte: today }, status: 'IN_INCIDENT' } }),
    prisma.trip.count({ where: { telegramDeliveryStatus: 'FAILED', startedAt: { gte: today } } }),
    prisma.trip.aggregate({
      where: { startedAt: { gte: today }, status: 'FINISHED' },
      _avg: { durationMinutes: true },
    }),
    prisma.fuelRecord.count({ where: { recordedAt: { gte: today } } }),
  ]);

  res.json({
    success: true,
    data: {
      totalToday,
      activeNow,
      withIncident,
      telegramFailed,
      avgDurationMinutes: Math.round(avgDuration._avg.durationMinutes || 0),
      fuelRecordsToday: fuelToday,
    },
  });
}));

export default router;
