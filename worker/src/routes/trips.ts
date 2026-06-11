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
