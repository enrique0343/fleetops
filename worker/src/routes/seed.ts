import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { AppError } from '../lib/http';
import { hashPassword } from '../lib/crypto';

const seed = new Hono<AppEnv>();

// POST /api/seed  — one-time idempotent seeding, guarded by SEED_TOKEN.
// Header:  x-seed-token: <SEED_TOKEN>
// Mirrors backend/prisma/seed.ts. Safe to run multiple times (upserts).
seed.post('/', async (c) => {
  const token = c.req.header('x-seed-token');
  if (!c.env.SEED_TOKEN || token !== c.env.SEED_TOKEN) {
    throw new AppError('No autorizado', 403);
  }

  const prisma = c.get('prisma');

  // ─── Branches ───
  const branchCentral = await prisma.branch.upsert({
    where: { code: 'CENTRAL' },
    update: {},
    create: { name: 'Sucursal Central', code: 'CENTRAL', address: 'Av. Principal 123, Ciudad' },
  });
  const branchNorte = await prisma.branch.upsert({
    where: { code: 'NORTE' },
    update: {},
    create: { name: 'Sucursal Norte', code: 'NORTE', address: 'Calle Norte 456, Ciudad' },
  });

  // ─── Users ───
  await prisma.user.upsert({
    where: { email: 'admin@fleetops.com' },
    update: {},
    create: {
      email: 'admin@fleetops.com',
      passwordHash: await hashPassword('admin123'),
      fullName: 'Administrador General',
      role: 'ADMIN',
      phone: '+1234567890',
      branchId: branchCentral.id,
    },
  });
  await prisma.user.upsert({
    where: { email: 'driver@fleetops.com' },
    update: {},
    create: {
      email: 'driver@fleetops.com',
      passwordHash: await hashPassword('driver123'),
      fullName: 'Juan Conductor',
      role: 'DRIVER',
      phone: '+0987654321',
      branchId: branchCentral.id,
    },
  });

  // ─── Vehicles ───
  const vehicles = [
    { plate: 'ABC-123', brand: 'Toyota', model: 'Hilux', year: 2022, fuelType: 'Diesel', color: 'Blanco' },
    { plate: 'XYZ-789', brand: 'Ford', model: 'Transit', year: 2021, fuelType: 'Diesel', color: 'Gris' },
    { plate: 'DEF-456', brand: 'Chevrolet', model: 'N300', year: 2023, fuelType: 'Gasolina', color: 'Azul' },
  ];
  for (const v of vehicles) {
    await prisma.vehicle.upsert({
      where: { plate: v.plate },
      update: {},
      create: { ...v, branchId: branchCentral.id },
    });
  }

  // ─── Locations ───
  const locations = [
    { name: 'Almacén Central', type: 'OPERATIONAL', branchId: branchCentral.id },
    { name: 'Centro de Distribución Norte', type: 'DESTINATION', branchId: branchNorte.id },
    { name: 'Puerto Marítimo', type: 'DESTINATION' },
    { name: 'Zona Industrial', type: 'DESTINATION' },
    { name: 'Aeropuerto', type: 'DESTINATION' },
    { name: 'Cliente Mayorista A', type: 'OTHER' },
  ];
  for (const loc of locations) {
    const existing = await prisma.location.findFirst({ where: { name: loc.name } });
    if (!existing) await prisma.location.create({ data: loc as any });
  }

  // ─── Incident Types ───
  const incidentTypes = [
    { name: 'Accidente de tránsito', severity: 'CRITICAL', description: 'Colisión o accidente vehicular' },
    { name: 'Falla mecánica', severity: 'HIGH', description: 'Problema mecánico del vehículo' },
    { name: 'Llanta pinchada', severity: 'MEDIUM', description: 'Neumático dañado' },
    { name: 'Vía bloqueada', severity: 'MEDIUM', description: 'Carretera o ruta bloqueada' },
    { name: 'Retraso por tráfico', severity: 'LOW', description: 'Congestión vehicular' },
    { name: 'Problema con carga', severity: 'HIGH', description: 'Inconveniente con la mercancía' },
    { name: 'Emergencia médica', severity: 'CRITICAL', description: 'Situación médica del conductor' },
    { name: 'Otro', severity: 'LOW', description: 'Otro tipo de incidente' },
  ];
  for (const it of incidentTypes) {
    const existing = await prisma.incidentType.findFirst({ where: { name: it.name } });
    if (!existing) await prisma.incidentType.create({ data: it as any });
  }

  return c.json({
    success: true,
    message: 'Seed completado',
    credentials: {
      admin: 'admin@fleetops.com / admin123',
      driver: 'driver@fleetops.com / driver123',
    },
  });
});

export default seed;
