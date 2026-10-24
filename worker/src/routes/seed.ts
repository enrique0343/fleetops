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

  // ─── Requester (professional) + Dispatcher ───
  await prisma.user.upsert({
    where: { email: 'medico@fleetops.com' },
    update: {},
    create: {
      email: 'medico@fleetops.com',
      passwordHash: await hashPassword('medico123'),
      fullName: 'Dra. Ana Solicitante',
      role: 'REQUESTER',
      department: 'Urgencias',
      phone: '+1222333444',
      branchId: branchCentral.id,
    },
  });
  await prisma.user.upsert({
    where: { email: 'dispatcher@fleetops.com' },
    update: {},
    create: {
      email: 'dispatcher@fleetops.com',
      passwordHash: await hashPassword('dispatch123'),
      fullName: 'Coordinador de Agenda',
      role: 'DISPATCHER',
      branchId: branchCentral.id,
    },
  });

  // ─── Vehicles (incl. one ambulance) ───
  const vehicles = [
    { plate: 'ABC-123', brand: 'Toyota', model: 'Hilux', year: 2022, fuelType: 'Diesel', color: 'Blanco', serviceClass: 'ADMIN', isAmbulance: false, hasStretcher: false, hasOxygen: false },
    { plate: 'XYZ-789', brand: 'Ford', model: 'Transit', year: 2021, fuelType: 'Diesel', color: 'Gris', serviceClass: 'ADMIN', isAmbulance: false, hasStretcher: false, hasOxygen: false },
    { plate: 'AMB-001', brand: 'Mercedes-Benz', model: 'Sprinter', year: 2023, fuelType: 'Diesel', color: 'Blanco', serviceClass: 'AMBULANCE', isAmbulance: true, hasStretcher: true, hasOxygen: true },
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

  // ─── Service windows ───
  // Standard transport: Mon-Fri 08:00-17:00. Ambulance: 24/7.
  const existingWindows = await prisma.serviceWindow.count();
  if (existingWindows === 0) {
    const windows: any[] = [];
    for (let d = 1; d <= 5; d++) {
      windows.push({ serviceType: 'STANDARD', dayOfWeek: d, startTime: '08:00', endTime: '17:00', slotMinutes: 30 });
    }
    for (let d = 0; d <= 6; d++) {
      windows.push({ serviceType: 'AMBULANCE', dayOfWeek: d, startTime: '00:00', endTime: '23:59', slotMinutes: 30 });
    }
    for (const w of windows) await prisma.serviceWindow.create({ data: w });
  }

  // ─── External providers (outsourcing) ───
  const existingProviders = await prisma.externalProvider.count();
  if (existingProviders === 0) {
    await prisma.externalProvider.create({
      data: {
        name: 'Ambulancias Vida Express',
        serviceType: 'AMBULANCE',
        phone: '+1 800 911 911',
        contactName: 'Central de despacho',
        coverageNote: 'Cobertura metropolitana 24/7',
      },
    });
  }

  return c.json({
    success: true,
    message: 'Seed completado',
    credentials: {
      admin: 'admin@fleetops.com / admin123',
      driver: 'driver@fleetops.com / driver123',
      requester: 'medico@fleetops.com / medico123',
      dispatcher: 'dispatcher@fleetops.com / dispatch123',
    },
  });
});

export default seed;
