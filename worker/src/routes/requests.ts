import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { AppError } from '../lib/http';
import { authenticate, requireDispatcher } from '../middleware/auth';
import { requireFields } from '../lib/validate';
import { RequestService } from '../services/requestService';
import { AvailabilityService } from '../services/availabilityService';

const requests = new Hono<AppEnv>();

// ─── Availability (consumed by the requester's form widget) ───
requests.get('/availability', authenticate, async (c) => {
  const q = c.req.query();
  const svc = new AvailabilityService(c.get('prisma'));
  const summary = await svc.getAvailabilitySummary({
    serviceType: q.serviceType === 'AMBULANCE' ? 'AMBULANCE' : 'STANDARD',
    at: q.at ? new Date(q.at) : new Date(),
    estimatedMinutes: q.estimatedMinutes ? parseInt(q.estimatedMinutes) : undefined,
    requiresStretcher: q.requiresStretcher === 'true',
    requiresOxygen: q.requiresOxygen === 'true',
    branchId: q.branchId,
  });
  return c.json({ success: true, data: summary });
});

// ─── Available resources for assignment (dispatcher) ───
requests.get('/availability/resources', authenticate, requireDispatcher, async (c) => {
  const q = c.req.query();
  const svc = new AvailabilityService(c.get('prisma'));
  const resources = await svc.getAvailableResources({
    serviceType: q.serviceType === 'AMBULANCE' ? 'AMBULANCE' : 'STANDARD',
    at: q.at ? new Date(q.at) : new Date(),
    estimatedMinutes: q.estimatedMinutes ? parseInt(q.estimatedMinutes) : undefined,
    requiresStretcher: q.requiresStretcher === 'true',
    requiresOxygen: q.requiresOxygen === 'true',
    branchId: q.branchId,
  });
  return c.json({ success: true, data: resources });
});

// ─── Create a request (any authenticated user) ───
requests.post('/', authenticate, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ['originId', 'destinationId', 'scheduledAt']);
  const user = c.get('user');
  const svc = new RequestService(c.get('prisma'));

  const data = await svc.create({
    serviceType: body.serviceType,
    priority: body.priority,
    requesterId: user.userId,
    requesterName: body.requesterName || user.email,
    requesterPhone: body.requesterPhone,
    requesterDept: body.requesterDept,
    originId: body.originId,
    destinationId: body.destinationId,
    scheduledAt: new Date(body.scheduledAt),
    windowMinutes: body.windowMinutes,
    estimatedMinutes: body.estimatedMinutes,
    passengerCount: body.passengerCount,
    reason: body.reason,
    patientName: body.patientName,
    patientCondition: body.patientCondition,
    requiresStretcher: body.requiresStretcher,
    requiresOxygen: body.requiresOxygen,
    clinicalNotes: body.clinicalNotes,
  });
  return c.json({ success: true, data }, 201);
});

// ─── My requests ───
requests.get('/my', authenticate, async (c) => {
  const svc = new RequestService(c.get('prisma'));
  const result = await svc.list({
    requesterId: c.get('user').userId,
    page: parseInt(c.req.query('page') || '') || 1,
    limit: parseInt(c.req.query('limit') || '') || 20,
  });
  return c.json({ success: true, data: result });
});

// ─── Driver: my assigned appointments (today by default) ───
requests.get('/my/assigned', authenticate, async (c) => {
  const q = c.req.query();
  const svc = new RequestService(c.get('prisma'));
  const result = await svc.list({
    assignedDriverId: c.get('user').userId,
    statusIn: q.statusIn ? q.statusIn.split(',') : ['SCHEDULED', 'DISPATCHED'],
    dateFrom: q.dateFrom,
    dateTo: q.dateTo,
    page: 1,
    limit: 50,
  });
  return c.json({ success: true, data: result });
});

// ─── Dispatcher: calendar feed for a date range ───
requests.get('/calendar', authenticate, requireDispatcher, async (c) => {
  const q = c.req.query();
  const from = q.from ? new Date(q.from) : new Date();
  const to = q.to ? new Date(q.to) : new Date(from.getTime() + 7 * 86400000);
  const svc = new RequestService(c.get('prisma'));
  return c.json({ success: true, data: await svc.calendar(from, to) });
});

// ─── Admin/Dispatcher: list with filters ───
requests.get('/', authenticate, requireDispatcher, async (c) => {
  const q = c.req.query();
  const svc = new RequestService(c.get('prisma'));
  const result = await svc.list({
    status: q.status,
    serviceType: q.serviceType,
    priority: q.priority,
    dateFrom: q.dateFrom,
    dateTo: q.dateTo,
    page: parseInt(q.page || '') || 1,
    limit: parseInt(q.limit || '') || 20,
  });
  return c.json({ success: true, data: result });
});

requests.get('/admin/stats', authenticate, requireDispatcher, async (c) => {
  const svc = new RequestService(c.get('prisma'));
  return c.json({ success: true, data: await svc.getStats() });
});

// ─── Detail ───
requests.get('/:id', authenticate, async (c) => {
  const svc = new RequestService(c.get('prisma'));
  const req = await svc.getDetail(c.req.param('id'));
  const user = c.get('user');
  // Requesters see their own; the assigned driver sees theirs; staff see all.
  if (
    !['ADMIN', 'DISPATCHER'].includes(user.role) &&
    req.requesterId !== user.userId &&
    req.assignedDriverId !== user.userId
  ) {
    throw new AppError('No tienes permiso para ver esta solicitud', 403);
  }
  return c.json({ success: true, data: req });
});

// ─── Lifecycle actions ───
requests.post('/:id/cancel', authenticate, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const svc = new RequestService(c.get('prisma'));
  const data = await svc.cancel(c.req.param('id'), c.get('user').userId, body.reason);
  return c.json({ success: true, data });
});

// Driver starts their own assigned appointment (generates the Trip).
requests.post('/:id/start', authenticate, async (c) => {
  const svc = new RequestService(c.get('prisma'));
  const data = await svc.startByDriver(c.req.param('id'), c.get('user').userId);
  return c.json({ success: true, data });
});

requests.post('/:id/approve', authenticate, requireDispatcher, async (c) => {
  const svc = new RequestService(c.get('prisma'));
  return c.json({ success: true, data: await svc.approve(c.req.param('id'), c.get('user').userId) });
});

requests.post('/:id/reject', authenticate, requireDispatcher, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.reason?.trim()) throw new AppError('La razón de rechazo es requerida');
  const svc = new RequestService(c.get('prisma'));
  return c.json({ success: true, data: await svc.reject(c.req.param('id'), c.get('user').userId, body.reason) });
});

requests.post('/:id/assign', authenticate, requireDispatcher, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ['vehicleId', 'driverId']);
  const svc = new RequestService(c.get('prisma'));
  return c.json({
    success: true,
    data: await svc.assign(c.req.param('id'), c.get('user').userId, body.vehicleId, body.driverId),
  });
});

requests.post('/:id/reschedule', authenticate, requireDispatcher, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ['scheduledAt']);
  const svc = new RequestService(c.get('prisma'));
  return c.json({
    success: true,
    data: await svc.reschedule(c.req.param('id'), c.get('user').userId, new Date(body.scheduledAt), body.reason),
  });
});

requests.post('/:id/dispatch', authenticate, requireDispatcher, async (c) => {
  const svc = new RequestService(c.get('prisma'));
  return c.json({ success: true, data: await svc.dispatch(c.req.param('id'), c.get('user').userId) });
});

requests.post('/:id/emergency-dispatch', authenticate, requireDispatcher, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ['vehicleId', 'driverId']);
  const svc = new RequestService(c.get('prisma'));
  return c.json({
    success: true,
    data: await svc.emergencyDispatch(c.req.param('id'), c.get('user').userId, body.vehicleId, body.driverId),
  });
});

export default requests;
