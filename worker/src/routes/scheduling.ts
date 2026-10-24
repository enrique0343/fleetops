import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { AppError } from '../lib/http';
import { authenticate, requireDispatcher } from '../middleware/auth';
import { requireFields } from '../lib/validate';

const scheduling = new Hono<AppEnv>();

// ─────────────────────────────────────────────
// Service windows (configurable service hours)
// ─────────────────────────────────────────────
scheduling.get('/service-windows', authenticate, async (c) => {
  const where: any = {};
  const st = c.req.query('serviceType');
  if (st) where.serviceType = st;
  const windows = await c.get('prisma').serviceWindow.findMany({
    where,
    orderBy: [{ serviceType: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  return c.json({ success: true, data: windows });
});

scheduling.post('/service-windows', authenticate, requireDispatcher, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ['serviceType', 'startTime', 'endTime']);
  if (body.dayOfWeek == null) throw new AppError('dayOfWeek es requerido');
  const w = await c.get('prisma').serviceWindow.create({
    data: {
      serviceType: body.serviceType,
      branchId: body.branchId || null,
      dayOfWeek: Number(body.dayOfWeek),
      startTime: body.startTime,
      endTime: body.endTime,
      slotMinutes: body.slotMinutes ? Number(body.slotMinutes) : 30,
    },
  });
  return c.json({ success: true, data: w }, 201);
});

scheduling.patch('/service-windows/:id', authenticate, requireDispatcher, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const w = await c.get('prisma').serviceWindow.update({
    where: { id: c.req.param('id') },
    data: {
      startTime: body.startTime,
      endTime: body.endTime,
      slotMinutes: body.slotMinutes != null ? Number(body.slotMinutes) : undefined,
      isActive: body.isActive,
    },
  });
  return c.json({ success: true, data: w });
});

scheduling.delete('/service-windows/:id', authenticate, requireDispatcher, async (c) => {
  await c.get('prisma').serviceWindow.delete({ where: { id: c.req.param('id') } });
  return c.json({ success: true });
});

// ─────────────────────────────────────────────
// Schedule blocks (maintenance / shifts / reservations)
// ─────────────────────────────────────────────
scheduling.get('/schedule-blocks', authenticate, requireDispatcher, async (c) => {
  const q = c.req.query();
  const where: any = {};
  if (q.vehicleId) where.vehicleId = q.vehicleId;
  if (q.driverId) where.driverId = q.driverId;
  if (q.from || q.to) {
    where.AND = [];
    if (q.from) where.AND.push({ endAt: { gte: new Date(q.from) } });
    if (q.to) where.AND.push({ startAt: { lte: new Date(q.to) } });
  }
  const blocks = await c.get('prisma').scheduleBlock.findMany({
    where,
    include: { vehicle: { select: { plate: true } }, driver: { select: { fullName: true } } },
    orderBy: { startAt: 'asc' },
  });
  return c.json({ success: true, data: blocks });
});

scheduling.post('/schedule-blocks', authenticate, requireDispatcher, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ['resourceType', 'reason', 'startAt', 'endAt']);
  if (body.resourceType === 'VEHICLE' && !body.vehicleId) throw new AppError('vehicleId requerido');
  if (body.resourceType === 'DRIVER' && !body.driverId) throw new AppError('driverId requerido');
  const block = await c.get('prisma').scheduleBlock.create({
    data: {
      resourceType: body.resourceType,
      vehicleId: body.vehicleId || null,
      driverId: body.driverId || null,
      reason: body.reason,
      startAt: new Date(body.startAt),
      endAt: new Date(body.endAt),
      note: body.note,
      createdById: c.get('user').userId,
    },
  });
  return c.json({ success: true, data: block }, 201);
});

scheduling.delete('/schedule-blocks/:id', authenticate, requireDispatcher, async (c) => {
  await c.get('prisma').scheduleBlock.delete({ where: { id: c.req.param('id') } });
  return c.json({ success: true });
});

export default scheduling;
