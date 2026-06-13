import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { AppError } from '../lib/http';
import { authenticate, requireAdmin } from '../middleware/auth';
import { hashPassword } from '../lib/crypto';
import { requireFields, isEmail, normalizeEmail } from '../lib/validate';
import { geocodeBest } from '../lib/geocode';

const catalogs = new Hono<AppEnv>();

// Fotos como data URL JPEG reducidas en el cliente; límite defensivo de tamaño.
function validPhoto(value: unknown): string | null {
  if (!value) return null;
  if (typeof value !== 'string' || value.length > 300_000) {
    throw new AppError('La foto es demasiado grande');
  }
  return value;
}

// ─── BRANCHES ───
catalogs.get('/branches', authenticate, async (c) => {
  const branches = await c.get('prisma').branch.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  return c.json({ success: true, data: branches });
});

catalogs.post('/branches', authenticate, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ['name', 'code']);
  // Auto-geocodifica las coordenadas a partir de la dirección si no se enviaron.
  let lat = body.lat != null ? Number(body.lat) : null;
  let lng = body.lng != null ? Number(body.lng) : null;
  if ((lat == null || lng == null) && body.address) {
    const hit = await geocodeBest(c.env, body.address);
    if (hit) { lat = hit.lat; lng = hit.lng; }
  }
  const branch = await c.get('prisma').branch.create({
    data: { name: body.name, code: body.code, address: body.address, lat, lng },
  });
  return c.json({ success: true, data: branch }, 201);
});

catalogs.patch('/branches/:id', authenticate, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  // Si cambian la dirección y no envían coords, re-geocodifica automáticamente.
  let lat = body.lat !== undefined ? (body.lat != null ? Number(body.lat) : null) : undefined;
  let lng = body.lng !== undefined ? (body.lng != null ? Number(body.lng) : null) : undefined;
  if (body.address && body.lat == null && body.lng == null) {
    const hit = await geocodeBest(c.env, body.address);
    if (hit) { lat = hit.lat; lng = hit.lng; }
  }
  const branch = await c.get('prisma').branch.update({
    where: { id: c.req.param('id') },
    data: { name: body.name, code: body.code, address: body.address, lat, lng, isActive: body.isActive },
  });
  return c.json({ success: true, data: branch });
});

// Rellena coordenadas de todas las sucursales con dirección pero sin geocodificar.
catalogs.post('/branches/geocode-all', authenticate, requireAdmin, async (c) => {
  const prisma = c.get('prisma');
  const pending = await prisma.branch.findMany({
    where: { OR: [{ lat: null }, { lng: null }], address: { not: null } },
  });
  let updated = 0;
  const failed: string[] = [];
  for (const b of pending) {
    const hit = await geocodeBest(c.env, b.address!);
    if (hit) {
      await prisma.branch.update({ where: { id: b.id }, data: { lat: hit.lat, lng: hit.lng } });
      updated++;
    } else {
      failed.push(b.name);
    }
  }
  return c.json({ success: true, data: { updated, failed, total: pending.length } });
});

// ─── VEHICLES ───
catalogs.get('/vehicles', authenticate, async (c) => {
  const where: any = { isActive: true };
  if (c.req.query('available') === 'true') where.currentTripId = null;
  const vehicles = await c.get('prisma').vehicle.findMany({
    where,
    include: { branch: true },
    orderBy: { plate: 'asc' },
  });
  return c.json({ success: true, data: vehicles });
});

catalogs.post('/vehicles', authenticate, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ['plate', 'model', 'brand']);
  const vehicle = await c.get('prisma').vehicle.create({
    data: {
      plate: body.plate,
      model: body.model,
      brand: body.brand,
      year: body.year,
      vehicleType: body.vehicleType,
      serviceClass: body.serviceClass || (body.isAmbulance ? 'AMBULANCE' : 'ADMIN'),
      branchId: body.branchId,
      fuelType: body.fuelType,
      color: body.color,
      isAmbulance: body.isAmbulance ?? false,
      hasStretcher: body.hasStretcher ?? false,
      hasOxygen: body.hasOxygen ?? false,
      photoUrl: validPhoto(body.photoUrl),
    },
  });
  return c.json({ success: true, data: vehicle }, 201);
});

catalogs.patch('/vehicles/:id', authenticate, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const vehicle = await c.get('prisma').vehicle.update({
    where: { id: c.req.param('id') },
    data: {
      plate: body.plate,
      model: body.model,
      brand: body.brand,
      year: body.year,
      vehicleType: body.vehicleType,
      serviceClass: body.serviceClass,
      branchId: body.branchId,
      fuelType: body.fuelType,
      color: body.color,
      isActive: body.isActive,
      isAmbulance: body.isAmbulance,
      hasStretcher: body.hasStretcher,
      hasOxygen: body.hasOxygen,
      photoUrl: body.photoUrl !== undefined ? validPhoto(body.photoUrl) : undefined,
    },
  });
  return c.json({ success: true, data: vehicle });
});

// ─── LOCATIONS ───
catalogs.get('/locations', authenticate, async (c) => {
  const q = c.req.query();
  const where: any = {};
  if (q.active !== 'false') where.isActive = true;
  if (q.type) where.type = q.type;
  if (q.branchId) where.branchId = q.branchId;
  const locations = await c.get('prisma').location.findMany({
    where,
    include: { branch: true },
    orderBy: { name: 'asc' },
  });
  return c.json({ success: true, data: locations });
});

catalogs.post('/locations', authenticate, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ['name']);
  const location = await c.get('prisma').location.create({
    data: {
      name: body.name,
      type: body.type,
      branchId: body.branchId,
      description: body.description,
      addressRef: body.addressRef,
      lat: body.lat,
      lng: body.lng,
    },
  });
  return c.json({ success: true, data: location }, 201);
});

catalogs.patch('/locations/:id', authenticate, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const location = await c.get('prisma').location.update({
    where: { id: c.req.param('id') },
    data: {
      name: body.name,
      type: body.type,
      branchId: body.branchId,
      description: body.description,
      addressRef: body.addressRef,
      lat: body.lat,
      lng: body.lng,
      isActive: body.isActive,
    },
  });
  return c.json({ success: true, data: location });
});

// ─── INCIDENT TYPES ───
catalogs.get('/incident-types', authenticate, async (c) => {
  const types = await c.get('prisma').incidentType.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });
  return c.json({ success: true, data: types });
});

catalogs.post('/incident-types', authenticate, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ['name']);
  const type = await c.get('prisma').incidentType.create({
    data: { name: body.name, description: body.description, severity: body.severity },
  });
  return c.json({ success: true, data: type }, 201);
});

// ─── USERS (admin) ───
catalogs.get('/users', authenticate, requireAdmin, async (c) => {
  const where: any = {};
  const role = c.req.query('role');
  if (role) where.role = role;
  const users = await c.get('prisma').user.findMany({
    where,
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      phone: true,
      photoUrl: true,
      isActive: true,
      branchId: true,
      branch: true,
      createdAt: true,
    },
    orderBy: { fullName: 'asc' },
  });
  return c.json({ success: true, data: users });
});

catalogs.post('/users', authenticate, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!isEmail(body.email)) throw new AppError('Datos inválidos: email');
  if (!body.password || String(body.password).length < 6) throw new AppError('Datos inválidos: password (min 6)');
  requireFields(body, ['fullName']);

  const passwordHash = await hashPassword(body.password);
  const user = await c.get('prisma').user.create({
    data: {
      email: normalizeEmail(body.email),
      passwordHash,
      fullName: body.fullName,
      role: body.role || 'DRIVER',
      phone: body.phone,
      branchId: body.branchId,
    },
  });
  return c.json({ success: true, data: { id: user.id, email: user.email } }, 201);
});

catalogs.patch('/users/:id', authenticate, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const user = await c.get('prisma').user.update({
    where: { id: c.req.param('id') },
    data: {
      fullName: body.fullName,
      role: body.role,
      phone: body.phone,
      branchId: body.branchId,
      isActive: body.isActive,
    },
  });
  return c.json({ success: true, data: { id: user.id } });
});

export default catalogs;
