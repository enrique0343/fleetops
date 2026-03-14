import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, requireAdmin } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { prisma } from '../config/database';

const router = Router();
router.use(authenticate);

// ─── List Fuel Records ───
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page) || '1');
  const limit = parseInt(String(req.query.limit) || '20');
  const { vehicleId, driverId, branchId, dateFrom, dateTo } = req.query;

  const where: Record<string, unknown> = {};

  // Drivers only see their own records
  if (req.user!.role === 'DRIVER') {
    where.driverId = req.user!.userId;
  } else {
    if (driverId) where.driverId = driverId;
  }

  if (vehicleId) where.vehicleId = vehicleId;
  if (branchId) where.branchId = branchId;
  if (dateFrom || dateTo) {
    where.recordedAt = {
      ...(dateFrom ? { gte: new Date(String(dateFrom)) } : {}),
      ...(dateTo ? { lte: new Date(String(dateTo)) } : {}),
    };
  }

  const [records, total] = await prisma.$transaction([
    prisma.fuelRecord.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        vehicle: { select: { id: true, plate: true, model: true } },
        driver: { select: { id: true, fullName: true } },
        branch: { select: { id: true, name: true } },
        trip: { select: { id: true } },
      },
    }),
    prisma.fuelRecord.count({ where }),
  ]);

  res.json({
    success: true,
    data: records,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}));

// ─── Create Fuel Record ───
router.post('/', [
  body('vehicleId').notEmpty().withMessage('Vehículo requerido'),
  body('stationName').trim().notEmpty().withMessage('Estación de servicio requerida'),
  body('fuelType').notEmpty().withMessage('Tipo de combustible requerido'),
  body('quantity').isFloat({ min: 0.1 }).withMessage('Cantidad inválida'),
  body('totalAmount').isFloat({ min: 0 }).withMessage('Monto inválido'),
  body('recordedAt').notEmpty().withMessage('Fecha y hora requeridas'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }

  const record = await prisma.fuelRecord.create({
    data: {
      vehicleId: req.body.vehicleId,
      driverId: req.user!.userId,
      tripId: req.body.tripId || null,
      branchId: req.body.branchId || null,
      stationName: req.body.stationName,
      fuelType: req.body.fuelType,
      quantity: parseFloat(req.body.quantity),
      unit: req.body.unit || 'LITERS',
      totalAmount: parseFloat(req.body.totalAmount),
      currency: req.body.currency || 'USD',
      odometerKm: req.body.odometerKm ? parseFloat(req.body.odometerKm) : null,
      paymentMethod: req.body.paymentMethod,
      receiptNumber: req.body.receiptNumber,
      isFullTank: req.body.isFullTank !== false,
      observation: req.body.observation,
      receiptPhotoUrl: req.body.receiptPhotoUrl,
      recordedAt: new Date(req.body.recordedAt),
    },
    include: {
      vehicle: { select: { plate: true, model: true } },
      driver: { select: { fullName: true } },
    },
  });

  res.status(201).json({ success: true, data: record });
}));

// ─── Get Single Fuel Record ───
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const record = await prisma.fuelRecord.findUnique({
    where: { id: req.params.id },
    include: {
      vehicle: { select: { id: true, plate: true, model: true, brand: true } },
      driver: { select: { id: true, fullName: true, email: true } },
      branch: { select: { id: true, name: true } },
      trip: { select: { id: true, startedAt: true, status: true } },
    },
  });

  if (!record) throw new AppError('Registro no encontrado', 404);

  if (req.user!.role === 'DRIVER' && record.driverId !== req.user!.userId) {
    throw new AppError('No tienes acceso a este registro', 403);
  }

  res.json({ success: true, data: record });
}));

// ─── Admin Edit Fuel Record ───
router.patch('/:id', requireAdmin, [
  body('reason').notEmpty().withMessage('Motivo de corrección requerido'),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }

  const old = await prisma.fuelRecord.findUnique({ where: { id: req.params.id } });
  if (!old) throw new AppError('Registro no encontrado', 404);

  const updateData: Record<string, unknown> = {
    correctedBy: req.user!.userId,
    correctionNote: req.body.reason,
    correctedAt: new Date(),
  };

  const editableFields = [
    'stationName', 'fuelType', 'quantity', 'totalAmount', 'odometerKm',
    'paymentMethod', 'receiptNumber', 'isFullTank', 'observation', 'branchId',
    'recordedAt',
  ];
  for (const field of editableFields) {
    if (req.body[field] !== undefined) updateData[field] = req.body[field];
  }

  const record = await prisma.$transaction(async (tx) => {
    const updated = await tx.fuelRecord.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await tx.auditLog.create({
      data: {
        entityName: 'FuelRecord',
        entityId: req.params.id,
        adminId: req.user!.userId,
        action: 'ADMIN_CORRECTION',
        oldValue: old,
        newValue: updated,
        reason: req.body.reason,
      },
    });

    return updated;
  });

  res.json({ success: true, data: record });
}));

// ─── KPIs (Admin) ───
router.get('/admin/kpis', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { dateFrom, dateTo, vehicleId } = req.query;
  const dateFilter = {
    ...(dateFrom ? { gte: new Date(String(dateFrom)) } : {}),
    ...(dateTo ? { lte: new Date(String(dateTo)) } : {}),
  };

  const where: Record<string, unknown> = {};
  if (Object.keys(dateFilter).length) where.recordedAt = dateFilter;
  if (vehicleId) where.vehicleId = vehicleId;

  // Per vehicle aggregation
  const byVehicle = await prisma.fuelRecord.groupBy({
    by: ['vehicleId'],
    where,
    _sum: { quantity: true, totalAmount: true },
    _count: { id: true },
    _avg: { totalAmount: true },
  });

  // Vehicle details
  const vehicleIds = byVehicle.map(v => v.vehicleId);
  const vehicles = await prisma.vehicle.findMany({
    where: { id: { in: vehicleIds } },
    select: { id: true, plate: true, model: true, brand: true },
  });
  const vehicleMap = Object.fromEntries(vehicles.map(v => [v.id, v]));

  // Totals
  const totals = await prisma.fuelRecord.aggregate({
    where,
    _sum: { quantity: true, totalAmount: true },
    _count: { id: true },
    _avg: { totalAmount: true },
  });

  const kpiData = byVehicle.map(v => ({
    vehicle: vehicleMap[v.vehicleId],
    totalQuantity: v._sum.quantity,
    totalAmount: v._sum.totalAmount,
    recordCount: v._count.id,
    avgAmountPerRecord: v._avg.totalAmount,
  }));

  res.json({
    success: true,
    data: {
      summary: {
        totalQuantity: totals._sum.quantity,
        totalAmount: totals._sum.totalAmount,
        recordCount: totals._count.id,
        avgAmountPerRecord: totals._avg.totalAmount,
      },
      byVehicle: kpiData,
    },
  });
}));

export default router;
