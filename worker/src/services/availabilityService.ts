import type { PrismaClient } from '@prisma/client';

// ─────────────────────────────────────────────
// Availability engine — answers "what vehicles/drivers are free for this
// window?" and "is the service open then?". Feeds the requester's live
// availability widget and the dispatcher's assignment screen.
// ─────────────────────────────────────────────

const ACTIVE_TRIP_STATUSES = ['IN_TRANSIT', 'IN_STOP', 'IN_INCIDENT'];
const BUSY_REQUEST_STATUSES = ['SCHEDULED', 'DISPATCHED'];

export interface AvailabilityQuery {
  serviceType: string; // STANDARD | AMBULANCE
  at: Date;
  estimatedMinutes?: number;
  requiresStretcher?: boolean;
  requiresOxygen?: boolean;
  branchId?: string;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export class AvailabilityService {
  constructor(private prisma: PrismaClient) {}

  // Is the requested service open at the given moment (per ServiceWindow)?
  async isWithinServiceHours(serviceType: string, at: Date, branchId?: string): Promise<boolean> {
    const windows = await this.prisma.serviceWindow.findMany({
      where: { serviceType, isActive: true, dayOfWeek: at.getDay() },
    });
    if (windows.length === 0) return true; // no windows configured => always open
    const minutes = at.getHours() * 60 + at.getMinutes();
    return windows.some((w) => {
      if (branchId && w.branchId && w.branchId !== branchId) return false;
      return minutes >= timeToMinutes(w.startTime) && minutes <= timeToMinutes(w.endTime);
    });
  }

  // Vehicles + drivers free for the window, honoring capability requirements.
  async getAvailableResources(q: AvailabilityQuery) {
    const est = q.estimatedMinutes ?? 60;
    const winStart = q.at;
    const winEnd = new Date(q.at.getTime() + est * 60000);

    // Candidate vehicles (filtered by service capability)
    const vehicleWhere: any = { isActive: true };
    if (q.serviceType === 'AMBULANCE') {
      vehicleWhere.isAmbulance = true;
      if (q.requiresStretcher) vehicleWhere.hasStretcher = true;
      if (q.requiresOxygen) vehicleWhere.hasOxygen = true;
    }
    if (q.branchId) vehicleWhere.branchId = q.branchId;

    const [vehicles, drivers, busyRequests, scheduleBlocks] = await Promise.all([
      this.prisma.vehicle.findMany({ where: vehicleWhere }),
      this.prisma.user.findMany({
        where: { isActive: true, role: { in: ['DRIVER', 'DISPATCHER', 'ADMIN'] } },
        select: { id: true, fullName: true, role: true },
      }),
      this.prisma.transportRequest.findMany({
        where: { status: { in: BUSY_REQUEST_STATUSES } },
        select: {
          assignedVehicleId: true,
          assignedDriverId: true,
          scheduledAt: true,
          estimatedMinutes: true,
        },
      }),
      this.prisma.scheduleBlock.findMany({
        where: { endAt: { gt: winStart }, startAt: { lt: winEnd } },
      }),
    ]);

    const blockedVehicleIds = new Set(
      scheduleBlocks.filter((b) => b.vehicleId).map((b) => b.vehicleId!)
    );
    const blockedDriverIds = new Set(
      scheduleBlocks.filter((b) => b.driverId).map((b) => b.driverId!)
    );

    // Mark resources busy when an existing scheduled request overlaps.
    const busyVehicleIds = new Set<string>();
    const busyDriverIds = new Set<string>();
    for (const r of busyRequests) {
      const rStart = r.scheduledAt;
      const rEnd = new Date(rStart.getTime() + (r.estimatedMinutes ?? 60) * 60000);
      if (overlaps(winStart, winEnd, rStart, rEnd)) {
        if (r.assignedVehicleId) busyVehicleIds.add(r.assignedVehicleId);
        if (r.assignedDriverId) busyDriverIds.add(r.assignedDriverId);
      }
    }

    const availableVehicles = vehicles.filter(
      (v) => !v.currentTripId && !busyVehicleIds.has(v.id) && !blockedVehicleIds.has(v.id)
    );
    const availableDrivers = drivers.filter(
      (d) => !busyDriverIds.has(d.id) && !blockedDriverIds.has(d.id)
    );

    return {
      vehicles: availableVehicles,
      drivers: availableDrivers,
      counts: { vehicles: availableVehicles.length, drivers: availableDrivers.length },
    };
  }

  // Compact summary for the requester widget (traffic-light).
  async getAvailabilitySummary(q: AvailabilityQuery) {
    const [withinHours, resources] = await Promise.all([
      this.isWithinServiceHours(q.serviceType, q.at, q.branchId),
      this.getAvailableResources(q),
    ]);

    const hasUnit = resources.counts.vehicles > 0 && resources.counts.drivers > 0;
    let level: 'GREEN' | 'YELLOW' | 'RED';
    if (!withinHours) level = 'RED';
    else if (hasUnit) level = 'GREEN';
    else level = 'RED';

    // Next free slots (today + next 2 days) within service hours.
    const slots = await this.getNextSlots(q, 3);
    if (level === 'RED' && slots.length > 0) level = 'YELLOW';

    return {
      level,
      withinHours,
      availableVehicles: resources.counts.vehicles,
      availableDrivers: resources.counts.drivers,
      canFallbackExternal: q.serviceType === 'AMBULANCE' && !hasUnit,
      nextSlots: slots,
    };
  }

  // Suggest bookable slots over the next `days`, respecting ServiceWindow grid.
  async getNextSlots(q: AvailabilityQuery, days: number) {
    const windows = await this.prisma.serviceWindow.findMany({
      where: { serviceType: q.serviceType, isActive: true },
    });
    const slots: { at: string; vehicles: number }[] = [];
    const now = new Date();

    for (let d = 0; d < days && slots.length < 6; d++) {
      const day = new Date(now);
      day.setDate(day.getDate() + d);
      const dow = day.getDay();
      const dayWindows = windows.filter((w) => w.dayOfWeek === dow);
      // If no windows configured, probe every 2h from now (fallback grid).
      const probes: Date[] = [];
      if (dayWindows.length === 0) {
        for (let h = 6; h <= 20; h += 2) {
          const t = new Date(day);
          t.setHours(h, 0, 0, 0);
          probes.push(t);
        }
      } else {
        for (const w of dayWindows) {
          const start = timeToMinutes(w.startTime);
          const end = timeToMinutes(w.endTime);
          for (let m = start; m < end; m += w.slotMinutes) {
            const t = new Date(day);
            t.setHours(Math.floor(m / 60), m % 60, 0, 0);
            probes.push(t);
          }
        }
      }

      for (const t of probes) {
        if (t <= now || slots.length >= 6) continue;
        const res = await this.getAvailableResources({ ...q, at: t });
        if (res.counts.vehicles > 0 && res.counts.drivers > 0) {
          slots.push({ at: t.toISOString(), vehicles: res.counts.vehicles });
        }
      }
    }
    return slots;
  }
}
