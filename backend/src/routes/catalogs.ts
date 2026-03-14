import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, requireAdmin } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { prisma } from '../config/database';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';

const router = Router();
router.use(authenticate);

// ════════════════════════════════════════
// BRANCHES
// ════════════════════════════════════════

router.get('/branches', asyncHandler(async (req: Request, res: Response) => {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: branches });
}));

router.post('/branches', requireAdmin, [
  body('name').trim().notEmpty(),
  body('code').trim().notEmpty().toUpperCase(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }

  const branch = await prisma.branch.create({
    data: {
      name: req.body.name,
      code: req.body.code.toUpperCase(),
      address: req.body.address,
    },
  });
  res.status(201).json({ success: true, data: branch });
}));

router.patch('/branches/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const branch = await prisma.branch.update({
    where: { id: req.params.id },
    data: {
      name: req.body.name,
      address: req.body.address,
      isActive: req.body.isActive,
    },
  });
  res.json({ success: true, data: branch });
}));

// ════════════════════════════════════════
// VEHICLES
// ════════════════════════════════════════

router.get('/vehicles', asyncHandler(async (req: Request, res: Response) => {
  const { available } = req.query;
  const where: Record<string, unknown> = { isActive: true };
  if (available === 'true') where.currentTripId = null;

  const vehicles = await prisma.vehicle.findMany({
    where,
    orderBy: { plate: 'asc' },
    include: {
      branch: { select: { id: true, name: true } },
    },
  });
  res.json({ success: true, data: vehicles });
}));

router.post('/vehicles', requireAdmin, [
  body('plate').trim().notEmpty(),
  body('model').trim().notEmpty(),
  body('brand').trim().notEmpty(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      plate: req.body.plate.toUpperCase(),
      model: req.body.model,
      brand: req.body.brand,
      year: req.body.year,
      vehicleType: req.body.vehicleType,
      branchId: req.body.branchId,
      fuelType: req.body.fuelType,
      color: req.body.color,
    },
  });

  await prisma.auditLog.create({
    data: {
      entityName: 'Vehicle',
      entityId: vehicle.id,
      adminId: req.user!.userId,
      action: 'CREATE',
      newValue: vehicle,
      reason: 'Alta de vehículo',
    },
  });

  res.status(201).json({ success: true, data: vehicle });
}));

router.patch('/vehicles/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const old = await prisma.vehicle.findUnique({ where: { id: req.params.id } });
  if (!old) throw new AppError('Vehículo no encontrado', 404);

  const vehicle = await prisma.vehicle.update({
    where: { id: req.params.id },
    data: {
      plate: req.body.plate,
      model: req.body.model,
      brand: req.body.brand,
      year: req.body.year,
      vehicleType: req.body.vehicleType,
      branchId: req.body.branchId,
      fuelType: req.body.fuelType,
      color: req.body.color,
      isActive: req.body.isActive,
    },
  });

  await prisma.auditLog.create({
    data: {
      entityName: 'Vehicle',
      entityId: vehicle.id,
      adminId: req.user!.userId,
      action: 'UPDATE',
      oldValue: old,
      newValue: vehicle,
      reason: req.body.reason || 'Edición de vehículo',
    },
  });

  res.json({ success: true, data: vehicle });
}));

// ════════════════════════════════════════
// LOCATIONS / DESTINATIONS
// ════════════════════════════════════════

router.get('/locations', asyncHandler(async (req: Request, res: Response) => {
  const { type, branchId, active } = req.query;
  const where: Record<string, unknown> = {};
  if (active !== 'false') where.isActive = true;
  if (type) where.type = type;
  if (branchId) where.branchId = branchId;

  const locations = await prisma.location.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { branch: { select: { id: true, name: true } } },
  });
  res.json({ success: true, data: locations });
}));

router.post('/locations', requireAdmin, [
  body('name').trim().notEmpty(),
  body('type').notEmpty(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }

  const location = await prisma.location.create({
    data: {
      name: req.body.name,
      type: req.body.type,
      branchId: req.body.branchId || null,
      description: req.body.description,
      addressRef: req.body.addressRef,
      lat: req.body.lat,
      lng: req.body.lng,
    },
  });

  await prisma.auditLog.create({
    data: {
      entityName: 'Location',
      entityId: location.id,
      adminId: req.user!.userId,
      action: 'CREATE',
      newValue: location,
      reason: 'Alta de ubicación',
    },
  });

  res.status(201).json({ success: true, data: location });
}));

router.patch('/locations/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const old = await prisma.location.findUnique({ where: { id: req.params.id } });
  if (!old) throw new AppError('Ubicación no encontrada', 404);

  const location = await prisma.location.update({
    where: { id: req.params.id },
    data: {
      name: req.body.name,
      type: req.body.type,
      branchId: req.body.branchId,
      description: req.body.description,
      addressRef: req.body.addressRef,
      lat: req.body.lat,
      lng: req.body.lng,
      isActive: req.body.isActive,
    },
  });

  await prisma.auditLog.create({
    data: {
      entityName: 'Location',
      entityId: location.id,
      adminId: req.user!.userId,
      action: 'UPDATE',
      oldValue: old,
      newValue: location,
      reason: req.body.reason || 'Edición de ubicación',
    },
  });

  res.json({ success: true, data: location });
}));

// ════════════════════════════════════════
// INCIDENT TYPES
// ════════════════════════════════════════

router.get('/incident-types', asyncHandler(async (req: Request, res: Response) => {
  const types = await prisma.incidentType.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  res.json({ success: true, data: types });
}));

router.post('/incident-types', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const type = await prisma.incidentType.create({
    data: {
      name: req.body.name,
      description: req.body.description,
      severity: req.body.severity || 'MEDIUM',
    },
  });
  res.status(201).json({ success: true, data: type });
}));

// ════════════════════════════════════════
// USERS (Admin only)
// ════════════════════════════════════════

router.get('/users', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    orderBy: { fullName: 'asc' },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      phone: true,
      isActive: true,
      branch: { select: { id: true, name: true } },
      createdAt: true,
    },
  });
  res.json({ success: true, data: users });
}));

router.post('/users', requireAdmin, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('fullName').trim().notEmpty(),
  body('role').isIn(['DRIVER', 'ADMIN']),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (existing) throw new AppError('Ya existe un usuario con ese correo', 409);

  const passwordHash = await bcrypt.hash(req.body.password, 12);
  const user = await prisma.user.create({
    data: {
      email: req.body.email,
      passwordHash,
      fullName: req.body.fullName,
      role: req.body.role as UserRole,
      phone: req.body.phone,
      branchId: req.body.branchId || null,
    },
    select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
  });

  await prisma.auditLog.create({
    data: {
      entityName: 'User',
      entityId: user.id,
      adminId: req.user!.userId,
      action: 'CREATE',
      newValue: { email: user.email, role: user.role },
      reason: 'Alta de usuario por admin',
    },
  });

  res.status(201).json({ success: true, data: user });
}));

router.patch('/users/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const old = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!old) throw new AppError('Usuario no encontrado', 404);

  const updateData: Record<string, unknown> = {};
  if (req.body.fullName !== undefined) updateData.fullName = req.body.fullName;
  if (req.body.phone !== undefined) updateData.phone = req.body.phone;
  if (req.body.role !== undefined) updateData.role = req.body.role;
  if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
  if (req.body.branchId !== undefined) updateData.branchId = req.body.branchId;
  if (req.body.password) {
    updateData.passwordHash = await bcrypt.hash(req.body.password, 12);
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: updateData,
    select: { id: true, email: true, fullName: true, role: true, isActive: true, phone: true },
  });

  await prisma.auditLog.create({
    data: {
      entityName: 'User',
      entityId: user.id,
      adminId: req.user!.userId,
      action: 'UPDATE',
      oldValue: { role: old.role, isActive: old.isActive },
      newValue: { role: user.role, isActive: user.isActive },
      reason: req.body.reason || 'Edición de usuario',
    },
  });

  res.json({ success: true, data: user });
}));

export default router;
