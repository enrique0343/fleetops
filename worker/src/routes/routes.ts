import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { AppError } from '../lib/http';
import { authenticate, requireDispatcher } from '../middleware/auth';
import { requireFields } from '../lib/validate';
import { makeCode } from '../lib/codes';
import { RoutingService } from '../services/routingService';

// Task pool + route optimization.
const routes = new Hono<AppEnv>();

// ─── Task pool ───
routes.get('/tasks', authenticate, requireDispatcher, async (c) => {
  const where: any = {};
  const status = c.req.query('status');
  if (status) where.status = status;
  const tasks = await c.get('prisma').transportTask.findMany({
    where,
    include: { location: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return c.json({ success: true, data: tasks });
});

routes.post('/tasks', authenticate, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ['requesterName']);
  if (!body.locationId && (body.lat == null || body.lng == null) && !body.addressText) {
    throw new AppError('Indica una ubicación (catálogo), coordenadas o dirección');
  }
  const task = await c.get('prisma').transportTask.create({
    data: {
      code: makeCode('TSK'),
      type: body.type || 'DELIVERY',
      requesterId: c.get('user').userId,
      requesterName: body.requesterName,
      locationId: body.locationId || null,
      addressText: body.addressText,
      lat: body.lat != null ? Number(body.lat) : null,
      lng: body.lng != null ? Number(body.lng) : null,
      notes: body.notes,
      priority: body.priority || 'NORMAL',
      windowStart: body.windowStart ? new Date(body.windowStart) : null,
      windowEnd: body.windowEnd ? new Date(body.windowEnd) : null,
      serviceTimeMin: body.serviceTimeMin ? Number(body.serviceTimeMin) : 5,
    },
  });
  return c.json({ success: true, data: task }, 201);
});

routes.delete('/tasks/:id', authenticate, requireDispatcher, async (c) => {
  await c.get('prisma').transportTask.update({
    where: { id: c.req.param('id') },
    data: { status: 'CANCELLED' },
  });
  return c.json({ success: true });
});

// ─── Optimize a route from selected pool tasks ───
routes.post('/optimize', authenticate, requireDispatcher, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!Array.isArray(body.taskIds) || body.taskIds.length === 0) {
    throw new AppError('Selecciona al menos una tarea (taskIds)');
  }
  const svc = new RoutingService(c.get('prisma'), c.env);
  const route = await svc.optimize(body.taskIds, {
    driverId: body.driverId,
    vehicleId: body.vehicleId,
    date: body.date ? new Date(body.date) : undefined,
    createdById: c.get('user').userId,
  });
  return c.json({ success: true, data: route }, 201);
});

routes.get('/:id', authenticate, async (c) => {
  const svc = new RoutingService(c.get('prisma'), c.env);
  return c.json({ success: true, data: await svc.getRoute(c.req.param('id')) });
});

routes.get('/:id/navigation', authenticate, async (c) => {
  const svc = new RoutingService(c.get('prisma'), c.env);
  return c.json({ success: true, data: await svc.getNavigation(c.req.param('id')) });
});

routes.post('/:id/dispatch', authenticate, requireDispatcher, async (c) => {
  const svc = new RoutingService(c.get('prisma'), c.env);
  return c.json({ success: true, data: await svc.dispatchRoute(c.req.param('id'), c.get('user').userId) });
});

export default routes;
