import type { PrismaClient } from '@prisma/client';
import type { Bindings } from '../types';
import { AppError } from '../lib/http';
import { toJson, fromJson } from '../lib/json';
import { makeCode } from '../lib/codes';

// ─────────────────────────────────────────────
// Routing — turns a pool of tasks into an optimized multi-stop order.
//
// Design principle: the OPTIMAL ORDER is computed by a deterministic engine,
// not an LLM. We call a free OSM-based routing engine (OSRM "trip" service)
// when configured; otherwise we fall back to a nearest-neighbor heuristic over
// haversine distances. A Claude/MCP layer can sit on top for natural-language
// reasoning, but the geometry stays deterministic.
//
// Config (optional env vars):
//   OSRM_URL  e.g. https://router.project-osrm.org
// ─────────────────────────────────────────────

interface Point {
  id: string;
  lat: number;
  lng: number;
}

function haversineKm(a: Point, b: Point): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Nearest-neighbor ordering starting from the first point (or a given start).
function nearestNeighborOrder(points: Point[], start?: Point): { order: string[]; distanceKm: number } {
  if (points.length === 0) return { order: [], distanceKm: 0 };
  const remaining = [...points];
  const order: string[] = [];
  let current = start ?? remaining.shift()!;
  if (start) {
    // start is not part of the visit list output, just the anchor
  } else {
    order.push(current.id);
  }
  let distance = 0;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    distance += bestDist;
    current = remaining.splice(bestIdx, 1)[0];
    order.push(current.id);
  }
  return { order, distanceKm: Math.round(distance * 10) / 10 };
}

// Try OSRM's trip service (solves TSP roundtrip) for an exact order.
async function osrmTrip(env: Bindings, points: Point[]): Promise<{ order: string[]; distanceKm: number; durationMin: number } | null> {
  const base = (env as any).OSRM_URL as string | undefined;
  if (!base || points.length < 2) return null;
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `${base.replace(/\/$/, '')}/trip/v1/driving/${coords}?source=first&roundtrip=false`;
  try {
    const res = await fetch(url);
    const data = (await res.json()) as any;
    if (data.code !== 'Ok' || !data.waypoints) return null;
    // waypoints[i].waypoint_index gives visit order of input point i
    const ordered = points
      .map((p, i) => ({ id: p.id, idx: data.waypoints[i].waypoint_index }))
      .sort((a, b) => a.idx - b.idx)
      .map((x) => x.id);
    const trip = data.trips?.[0];
    return {
      order: ordered,
      distanceKm: trip ? Math.round((trip.distance / 1000) * 10) / 10 : 0,
      durationMin: trip ? Math.round(trip.duration / 60) : 0,
    };
  } catch {
    return null;
  }
}

export class RoutingService {
  constructor(private prisma: PrismaClient, private env: Bindings) {}

  // Optimize a set of pool tasks into an ordered RoutePlan.
  async optimize(taskIds: string[], opts: { driverId?: string; vehicleId?: string; date?: Date; createdById: string }) {
    if (taskIds.length === 0) throw new AppError('Selecciona al menos una tarea', 400);

    const tasks = await this.prisma.transportTask.findMany({
      where: { id: { in: taskIds }, status: 'POOL' },
      include: { location: { select: { lat: true, lng: true, name: true } } },
    });
    if (tasks.length === 0) throw new AppError('No hay tareas válidas en el pool', 400);

    // Resolve coordinates (task.lat/lng override location).
    const points: Point[] = [];
    const missing: string[] = [];
    for (const t of tasks) {
      const lat = t.lat ?? t.location?.lat ?? null;
      const lng = t.lng ?? t.location?.lng ?? null;
      if (lat == null || lng == null) missing.push(t.code);
      else points.push({ id: t.id, lat, lng });
    }
    if (points.length < tasks.length) {
      throw new AppError(`Tareas sin coordenadas: ${missing.join(', ')}. Geocodifícalas primero.`, 400);
    }

    // Engine first, heuristic fallback.
    const osrm = await osrmTrip(this.env, points);
    const result = osrm ?? {
      ...nearestNeighborOrder(points),
      durationMin: 0,
    };
    const engine = osrm ? 'osrm' : 'nearest-neighbor';
    // Estimate duration from distance if engine didn't provide it (~30km/h urban + service time).
    const serviceMin = tasks.reduce((s, t) => s + (t.serviceTimeMin || 0), 0);
    const durationMin = result.durationMin || Math.round((result.distanceKm / 30) * 60) + serviceMin;

    const id = crypto.randomUUID();
    await this.prisma.$transaction([
      this.prisma.routePlan.create({
        data: {
          id,
          code: makeCode('RTE'),
          driverId: opts.driverId,
          vehicleId: opts.vehicleId,
          status: 'DRAFT',
          plannedDate: opts.date ?? new Date(),
          totalDistanceKm: result.distanceKm,
          totalDurationMin: durationMin,
          optimizedOrder: toJson(result.order),
          optimizerMeta: toJson({ engine, stops: result.order.length, serviceMin }),
          createdById: opts.createdById,
        },
      }),
      this.prisma.transportTask.updateMany({
        where: { id: { in: result.order } },
        data: { status: 'ASSIGNED', routeId: id },
      }),
      // Persist the visiting order on each task.
      ...result.order.map((taskId, idx) =>
        this.prisma.transportTask.update({ where: { id: taskId }, data: { sortOrder: idx } })
      ),
    ]);

    return this.getRoute(id);
  }

  async getRoute(id: string) {
    const route = await this.prisma.routePlan.findUnique({
      where: { id },
      include: {
        driver: { select: { id: true, fullName: true } },
        vehicle: { select: { id: true, plate: true } },
        tasks: { orderBy: { sortOrder: 'asc' }, include: { location: { select: { name: true, lat: true, lng: true } } } },
      },
    });
    if (!route) throw new AppError('Ruta no encontrada', 404);
    return {
      ...route,
      optimizedOrder: fromJson(route.optimizedOrder),
      optimizerMeta: fromJson(route.optimizerMeta),
    };
  }

  // Deep-links so the driver navigates with Waze / Google Maps (free).
  async getNavigation(id: string) {
    const route = await this.getRoute(id);
    const stops = (route as any).tasks
      .map((t: any) => {
        const lat = t.lat ?? t.location?.lat;
        const lng = t.lng ?? t.location?.lng;
        if (lat == null || lng == null) return null;
        return {
          taskId: t.id,
          name: t.location?.name || t.addressText || t.code,
          lat,
          lng,
          waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
          gmaps: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        };
      })
      .filter(Boolean);

    // One multi-stop Google Maps link with waypoints.
    let multiStop: string | null = null;
    if (stops.length >= 1) {
      const dest = stops[stops.length - 1];
      const waypoints = stops
        .slice(0, -1)
        .map((s: any) => `${s.lat},${s.lng}`)
        .join('|');
      multiStop = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}${
        waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''
      }`;
    }

    return { stops, multiStop };
  }

  async dispatchRoute(id: string, _adminId: string) {
    const route = await this.prisma.routePlan.findUnique({ where: { id } });
    if (!route) throw new AppError('Ruta no encontrada', 404);
    if (route.status !== 'DRAFT') throw new AppError('La ruta ya fue despachada', 400);
    if (!route.driverId || !route.vehicleId) {
      throw new AppError('La ruta necesita conductor y vehículo asignados', 400);
    }

    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: route.vehicleId } });
    if (!vehicle) throw new AppError('Vehículo no encontrado', 404);
    const branchId = vehicle.branchId ?? (await this.prisma.branch.findFirst({ where: { isActive: true } }))?.id;
    if (!branchId) throw new AppError('No hay sucursal configurada', 400);

    // The route's "destination" is its last stop's location, if any.
    const tasks = await this.prisma.transportTask.findMany({
      where: { routeId: id },
      orderBy: { sortOrder: 'asc' },
    });
    const lastWithLoc = [...tasks].reverse().find((t) => t.locationId);
    const destinationId = lastWithLoc?.locationId;
    if (!destinationId) {
      throw new AppError('Las tareas de la ruta necesitan una ubicación de catálogo para despachar', 400);
    }

    const { TripService } = await import('./tripService');
    const tripSvc = new TripService(this.prisma);
    const trip = await tripSvc.startTrip({
      driverId: route.driverId,
      vehicleId: route.vehicleId,
      originBranchId: branchId,
      destinationId,
      comment: `Ruta ${route.code} (${tasks.length} paradas)`,
      deviceTimestamp: new Date(),
    });

    await this.prisma.$transaction([
      this.prisma.routePlan.update({
        where: { id },
        data: { status: 'DISPATCHED', tripId: trip.id },
      }),
      this.prisma.transportTask.updateMany({
        where: { routeId: id },
        data: { status: 'EN_ROUTE', tripId: trip.id },
      }),
    ]);

    return this.getRoute(id);
  }
}
