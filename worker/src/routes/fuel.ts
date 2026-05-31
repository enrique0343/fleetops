import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { AppError } from '../lib/http';
import { authenticate, requireAdmin } from '../middleware/auth';
import { requireFields, positiveNumber } from '../lib/validate';
import { toJson } from '../lib/json';

const fuel = new Hono<AppEnv>();

// POST /api/fuel
fuel.post('/', authenticate, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ['vehicleId', 'stationName', 'fuelType']);
  if (!positiveNumber(body.quantity) || !positiveNumber(body.totalAmount)) {
    throw new AppError('Datos inválidos: quantity y totalAmount deben ser mayores a 0');
  }

  const record = await c.get('prisma').fuelRecord.create({
    data: {
      vehicleId: body.vehicleId,
      driverId: c.get('user').userId,
      tripId: body.tripId || null,
      branchId: body.branchId || null,
      stationName: body.stationName,
      fuelType: body.fuelType,
      quantity: parseFloat(body.quantity),
      unit: body.unit || 'LITERS',
      totalAmount: parseFloat(body.totalAmount),
      currency: body.currency || 'USD',
      odometerKm: body.odometerKm ? parseFloat(body.odometerKm) : null,
      paymentMethod: body.paymentMethod,
      receiptNumber: body.receiptNumber,
      isFullTank: body.isFullTank !== false,
      observation: body.observation,
      recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date(),
    },
  });

  return c.json({ success: true, data: record }, 201);
});

// GET /api/fuel
fuel.get('/', authenticate, async (c) => {
  const q = c.req.query();
  const pageNum = parseInt(q.page || '') || 1;
  const limitNum = parseInt(q.limit || '') || 20;
  const user = c.get('user');

  const where: any = {};
  if (user.role !== 'ADMIN') {
    where.driverId = user.userId;
  } else {
    if (q.vehicleId) where.vehicleId = q.vehicleId;
    if (q.driverId) where.driverId = q.driverId;
  }

  const prisma = c.get('prisma');
  const [records, total] = await Promise.all([
    prisma.fuelRecord.findMany({
      where,
      include: {
        vehicle: { select: { plate: true, brand: true, model: true } },
        driver: { select: { fullName: true } },
      },
      orderBy: { recordedAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.fuelRecord.count({ where }),
  ]);

  return c.json({
    success: true,
    data: { data: records, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
  });
});

// GET /api/fuel/admin/kpis  (before '/:id')
fuel.get('/admin/kpis', authenticate, requireAdmin, async (c) => {
  const records = await c.get('prisma').fuelRecord.groupBy({
    by: ['vehicleId'],
    _sum: { quantity: true, totalAmount: true },
    _count: { id: true },
    _avg: { totalAmount: true },
  });
  return c.json({ success: true, data: records });
});

// GET /api/fuel/:id
fuel.get('/:id', authenticate, async (c) => {
  const record = await c.get('prisma').fuelRecord.findUnique({
    where: { id: c.req.param('id') },
    include: {
      vehicle: true,
      driver: { select: { fullName: true, email: true } },
      branch: true,
      trip: { select: { id: true, status: true } },
    },
  });
  if (!record) throw new AppError('Registro no encontrado', 404);
  return c.json({ success: true, data: record });
});

// PATCH /api/fuel/:id (admin correction)
fuel.patch('/:id', authenticate, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.correctionNote || String(body.correctionNote).trim() === '') {
    throw new AppError('La nota de corrección es requerida');
  }

  const prisma = c.get('prisma');
  const existing = await prisma.fuelRecord.findUnique({ where: { id: c.req.param('id') } });
  if (!existing) throw new AppError('Registro no encontrado', 404);

  const record = await prisma.fuelRecord.update({
    where: { id: c.req.param('id') },
    data: {
      quantity: body.quantity !== undefined ? parseFloat(body.quantity) : existing.quantity,
      totalAmount: body.totalAmount !== undefined ? parseFloat(body.totalAmount) : existing.totalAmount,
      odometerKm: body.odometerKm !== undefined ? parseFloat(body.odometerKm) : existing.odometerKm,
      correctedBy: c.get('user').userId,
      correctionNote: body.correctionNote,
      correctedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      entityName: 'FuelRecord',
      entityId: record.id,
      adminId: c.get('user').userId,
      action: 'CORRECTION',
      oldValue: toJson({
        quantity: existing.quantity,
        totalAmount: existing.totalAmount,
        odometerKm: existing.odometerKm,
      }),
      newValue: toJson({
        quantity: record.quantity,
        totalAmount: record.totalAmount,
        odometerKm: record.odometerKm,
      }),
      reason: body.correctionNote,
    },
  });

  return c.json({ success: true, data: record });
});

export default fuel;
