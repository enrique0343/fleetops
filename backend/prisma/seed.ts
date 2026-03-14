import { PrismaClient, UserRole, LocationType, IncidentSeverity } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding FleetOps database...');

  // ─── Branches ───
  const branchCentral = await prisma.branch.upsert({
    where: { code: 'CENTRAL' },
    update: {},
    create: {
      name: 'Sucursal Central',
      code: 'CENTRAL',
      address: 'Av. Principal #100, Ciudad',
    },
  });

  const branchNorte = await prisma.branch.upsert({
    where: { code: 'NORTE' },
    update: {},
    create: {
      name: 'Sucursal Norte',
      code: 'NORTE',
      address: 'Zona Norte #200, Ciudad',
    },
  });

  console.log('✅ Branches created');

  // ─── Admin User ───
  const adminPassword = await bcrypt.hash('Admin1234!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@fleetops.com' },
    update: {},
    create: {
      email: 'admin@fleetops.com',
      passwordHash: adminPassword,
      fullName: 'Administrador Sistema',
      role: UserRole.ADMIN,
      branchId: branchCentral.id,
    },
  });

  // ─── Driver Users ───
  const driverPassword = await bcrypt.hash('Driver1234!', 12);
  const driver1 = await prisma.user.upsert({
    where: { email: 'carlos.mendez@fleetops.com' },
    update: {},
    create: {
      email: 'carlos.mendez@fleetops.com',
      passwordHash: driverPassword,
      fullName: 'Carlos Méndez',
      role: UserRole.DRIVER,
      phone: '+50399990001',
      branchId: branchCentral.id,
    },
  });

  const driver2 = await prisma.user.upsert({
    where: { email: 'ana.garcia@fleetops.com' },
    update: {},
    create: {
      email: 'ana.garcia@fleetops.com',
      passwordHash: driverPassword,
      fullName: 'Ana García',
      role: UserRole.DRIVER,
      phone: '+50399990002',
      branchId: branchNorte.id,
    },
  });

  console.log('✅ Users created');

  // ─── Vehicles ───
  const vehicle1 = await prisma.vehicle.upsert({
    where: { plate: 'P-123-456' },
    update: {},
    create: {
      plate: 'P-123-456',
      model: 'Hilux',
      brand: 'Toyota',
      year: 2022,
      vehicleType: 'Pickup',
      branchId: branchCentral.id,
      fuelType: 'Diesel',
      color: 'Blanco',
    },
  });

  const vehicle2 = await prisma.vehicle.upsert({
    where: { plate: 'P-789-012' },
    update: {},
    create: {
      plate: 'P-789-012',
      model: 'Transit',
      brand: 'Ford',
      year: 2021,
      vehicleType: 'Van',
      branchId: branchNorte.id,
      fuelType: 'Gasolina',
      color: 'Gris',
    },
  });

  const vehicle3 = await prisma.vehicle.upsert({
    where: { plate: 'M-321-654' },
    update: {},
    create: {
      plate: 'M-321-654',
      model: 'Corolla',
      brand: 'Toyota',
      year: 2023,
      vehicleType: 'Sedan',
      branchId: branchCentral.id,
      fuelType: 'Gasolina',
      color: 'Negro',
    },
  });

  console.log('✅ Vehicles created');

  // ─── Locations / Destinations ───
  await prisma.location.createMany({
    skipDuplicates: true,
    data: [
      {
        name: 'Hospital Avante - Sede Central',
        type: LocationType.DESTINATION,
        branchId: branchCentral.id,
        description: 'Sede principal del complejo hospitalario',
        addressRef: 'Blvd. Hospitalario #500',
      },
      {
        name: 'Aeropuerto Internacional',
        type: LocationType.DESTINATION,
        description: 'Terminal aérea principal',
        addressRef: 'Carretera al Aeropuerto km 12',
      },
      {
        name: 'Clínica Norte',
        type: LocationType.DESTINATION,
        branchId: branchNorte.id,
        description: 'Clínica subsidiaria zona norte',
        addressRef: 'Calle 15 Norte #80',
      },
      {
        name: 'Proveedor Médico Central',
        type: LocationType.OPERATIONAL,
        description: 'Bodega del proveedor principal de suministros',
        addressRef: 'Zona Industrial #45',
      },
      {
        name: 'Ministerio de Salud',
        type: LocationType.DESTINATION,
        description: 'Sede gubernamental para trámites',
        addressRef: 'Av. Reforma #100',
      },
      {
        name: 'Laboratorio Clínico Nacional',
        type: LocationType.DESTINATION,
        description: 'Laboratorio para muestras y análisis',
        addressRef: 'Col. Centro #22',
      },
    ],
  });

  console.log('✅ Locations created');

  // ─── Incident Types ───
  await prisma.incidentType.createMany({
    skipDuplicates: true,
    data: [
      {
        name: 'Accidente de tráfico',
        description: 'Colisión o accidente vehicular durante el recorrido',
        severity: IncidentSeverity.CRITICAL,
      },
      {
        name: 'Falla mecánica',
        description: 'El vehículo presenta falla mecánica que impide continuar',
        severity: IncidentSeverity.HIGH,
      },
      {
        name: 'Pinchazo / llanta',
        description: 'Llanta ponchada o desinflada',
        severity: IncidentSeverity.MEDIUM,
      },
      {
        name: 'Vía bloqueada',
        description: 'Ruta bloqueada por manifestación, accidente u obra',
        severity: IncidentSeverity.MEDIUM,
      },
      {
        name: 'Retraso por tráfico',
        description: 'Demora significativa por congestión vial',
        severity: IncidentSeverity.LOW,
      },
      {
        name: 'Problema con carga / paquete',
        description: 'Incidencia relacionada con el material transportado',
        severity: IncidentSeverity.MEDIUM,
      },
      {
        name: 'Emergencia médica',
        description: 'El motorista o un acompañante requiere atención médica',
        severity: IncidentSeverity.CRITICAL,
      },
      {
        name: 'Otro',
        description: 'Incidencia no clasificada en las categorías anteriores',
        severity: IncidentSeverity.LOW,
      },
    ],
  });

  console.log('✅ Incident types created');

  console.log(`
╔══════════════════════════════════════════════╗
║        FleetOps - Seed completado            ║
╠══════════════════════════════════════════════╣
║  Admin:   admin@fleetops.com                 ║
║  Pass:    Admin1234!                         ║
╠══════════════════════════════════════════════╣
║  Driver1: carlos.mendez@fleetops.com         ║
║  Driver2: ana.garcia@fleetops.com            ║
║  Pass:    Driver1234!                        ║
╚══════════════════════════════════════════════╝
  `);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Seed error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
