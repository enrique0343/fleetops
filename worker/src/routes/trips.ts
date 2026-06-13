import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { AppError } from '../lib/http';
import { authenticate, requireAdmin, requireDispatcher } from '../middleware/auth';
import { TripService } from '../services/tripService';
import { notifyTripFinished } from '../services/notification';
import { requireFields } from '../lib/validate';

const trips = new Hono<AppEnv>();

const dt = (v: any) => (v ? new Date(v) : new Date());

// ─── DRIVER ROUTES ───

trips.post('/start', authenticate, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ['vehicleId', 'originBranchId', 'destinationId']);

  // Urgent self-dispatch (no appointment) requires a stated reason for traceability.
  const priority = body.priority === 'URGENT' || body.priority === 'EMERGENCY' ? body.priority : 'NORMAL';
  if (priority !== 'NORMAL' && !body.comment?.trim()) {
    throw new AppError('Un viaje urgente requiere un motivo (comment)');
  }

  const svc = new TripService(c.get('prisma'));
  const trip = await svc.startTrip({
    driverId: c.get('user').userId,
    vehicleId: body.vehicleId,
    originBranchId: body.originBranchId,
    destinationId: body.destinationId,
    startLat: body.startLat,
    startLng: body.startLng,
    comment: body.comment,
    deviceTimestamp: dt(body.deviceTimestamp),
    priority,
  });

  // Audit-trail urgent self-dispatch.
  if (priority !== 'NORMAL') {
    await c.get('prisma').tripEvent.create({
      data: {
        tripId: trip.id,
        type: 'REPORT_INCIDENT',
        userId: c.get('user').userId,
        deviceTimestamp: dt(body.deviceTimestamp),
        comment: `AUTO-DESPACHO ${priority}: ${body.comment}`,
      },
    });
  }

  return c.json({ success: true, data: trip }, 201);
});

trips.get('/my/active', authenticate, async (c) => {
  const svc = new TripService(c.get('prisma'));
  const trip = await svc.getActiveTrip(c.get('user').userId);
  return c.json({ success: true, data: trip });
});

trips.get('/my/history', authenticate, async (c) => {
  const page = parseInt(c.req.query('page') || '') || 1;
  const limit = parseInt(c.req.query('limit') || '') || 20;
  const svc = new TripService(c.get('prisma'));
  const result = await svc.getDriverHistory(c.get('user').userId, page, limit);
  return c.json({ success: true, data: result });
});

trips.post('/:tripId/stop', authenticate, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const svc = new TripService(c.get('prisma'));
  const trip = await svc.registerStop(c.req.param('tripId'), c.get('user').userId, {
    comment: body.comment,
    lat: body.lat,
    lng: body.lng,
    deviceTimestamp: dt(body.deviceTimestamp),
  });
  return c.json({ success: true, data: trip });
});

trips.post('/:tripId/resume', authenticate, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const svc = new TripService(c.get('prisma'));
  const trip = await svc.resumeTrip(c.req.param('tripId'), c.get('user').userId, {
    comment: body.comment,
    lat: body.lat,
    lng: body.lng,
    deviceTimestamp: dt(body.deviceTimestamp),
  });
  return c.json({ success: true, data: trip });
});

trips.post('/:tripId/incident', authenticate, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.comment || String(body.comment).trim() === '') throw new AppError('El comentario es requerido');
  const svc = new TripService(c.get('prisma'));
  const trip = await svc.reportIncident(c.req.param('tripId'), c.get('user').userId, {
    comment: body.comment,
    incidentTypeId: body.incidentTypeId,
    lat: body.lat,
    lng: body.lng,
    deviceTimestamp: dt(body.deviceTimestamp),
  });
  return c.json({ success: true, data: trip });
});

// Ping de ubicación durante el viaje (rastreo en vivo). Solo el conductor
// dueño del viaje activo puede reportar su posición. No genera eventos para
// no inundar la bitácora; solo actualiza la última posición conocida.
trips.post('/:tripId/ping', authenticate, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new AppError('Coordenadas inválidas');
  }
  const prisma = c.get('prisma');
  const trip = await prisma.trip.findUnique({ where: { id: c.req.param('tripId') } });
  if (!trip) throw new AppError('Viaje no encontrado', 404);
  if (trip.driverId !== c.get('user').userId) {
    throw new AppError('No eres el conductor de este viaje', 403);
  }
  if (!['IN_TRANSIT', 'IN_STOP', 'IN_INCIDENT'].includes(trip.status)) {
    throw new AppError('El viaje no está activo', 400);
  }
  // Actualiza la última posición Y guarda el punto del recorrido (breadcrumb)
  // para poder dibujar la ruta real recorrida.
  await prisma.$transaction([
    prisma.trip.update({
      where: { id: trip.id },
      data: { lastLat: lat, lastLng: lng, lastPingAt: new Date() },
    }),
    prisma.tripTrackPoint.create({
      data: { tripId: trip.id, lat, lng },
    }),
  ]);
  return c.json({ success: true });
});

// Recorrido completo del viaje (para el mapa). Lo ve el conductor dueño
// del viaje y el personal de coordinación.
trips.get('/:tripId/track', authenticate, async (c) => {
  const prisma = c.get('prisma');
  const trip = await prisma.trip.findUnique({
    where: { id: c.req.param('tripId') },
    select: { id: true, driverId: true },
  });
  if (!trip) throw new AppError('Viaje no encontrado', 404);
  const user = c.get('user');
  if (trip.driverId !== user.userId && !['ADMIN', 'DISPATCHER'].includes(user.role)) {
    throw new AppError('No tienes permiso para ver este recorrido', 403);
  }
  const points = await prisma.tripTrackPoint.findMany({
    where: { tripId: trip.id },
    select: { lat: true, lng: true, recordedAt: true },
    orderBy: { recordedAt: 'asc' },
    take: 2000,
  });
  return c.json({ success: true, data: points });
});

trips.post('/:tripId/finish', authenticate, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const svc = new TripService(c.get('prisma'));
  const trip = await svc.finishTrip(c.req.param('tripId'), c.get('user').userId, {
    comment: body.comment,
    endLat: body.endLat,
    endLng: body.endLng,
    closureBranchId: body.closureBranchId,
    deviceTimestamp: dt(body.deviceTimestamp),
  });

  // Fire notification without blocking the response.
  c.executionCtx.waitUntil(
    notifyTripFinished(c.get('prisma'), c.env, trip.id).catch((err) =>
      console.error('Notification error:', err)
    )
  );

  return c.json({ success: true, data: trip });
});

// ─── ADMIN ROUTES (must precede '/:tripId' GET) ───

trips.get('/', authenticate, requireDispatcher, async (c) => {
  const q = c.req.query();
  const svc = new TripService(c.get('prisma'));
  const result = await svc.getAdminTrips({
    status: q.status,
    branchId: q.branchId,
    driverId: q.driverId,
    vehicleId: q.vehicleId,
    dateFrom: q.dateFrom,
    dateTo: q.dateTo,
    telegramFailed: q.telegramFailed === 'true',
    manualVehicle: q.manualVehicle === 'true',
    page: parseInt(q.page || '') || 1,
    limit: parseInt(q.limit || '') || 20,
  });
  return c.json({ success: true, data: result });
});

trips.get('/admin/dashboard', authenticate, requireDispatcher, async (c) => {
  const svc = new TripService(c.get('prisma'));
  const stats = await svc.getDashboardStats();
  return c.json({ success: true, data: stats });
});

trips.post('/:tripId/force-close', authenticate, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.reason || String(body.reason).trim() === '') throw new AppError('La razón es requerida');
  const svc = new TripService(c.get('prisma'));
  const trip = await svc.forceCloseTrip(
    c.req.param('tripId'),
    c.get('user').userId,
    body.reason,
    body.closureBranchId
  );
  return c.json({ success: true, data: trip });
});

trips.patch('/:tripId/correction', authenticate, requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.reason || String(body.reason).trim() === '') throw new AppError('La razón es requerida');
  const svc = new TripService(c.get('prisma'));
  const trip = await svc.correctTrip(c.req.param('tripId'), c.get('user').userId, {
    reason: body.reason,
    finishedAt: body.finishedAt,
    closureBranchId: body.closureBranchId,
    comment: body.comment,
  });
  return c.json({ success: true, data: trip });
});

trips.post('/:tripId/retry-telegram', authenticate, requireAdmin, async (c) => {
  const result = await notifyTripFinished(c.get('prisma'), c.env, c.req.param('tripId'));
  return c.json({ success: true, data: result });
});

// GET /api/trips/:tripId  (keep last so it doesn't shadow the routes above)
trips.get('/:tripId', authenticate, async (c) => {
  const svc = new TripService(c.get('prisma'));
  const trip = await svc.getTripDetail(c.req.param('tripId'));
  return c.json({ success: true, data: trip });
});

export default trips;
