import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { AppError } from '../lib/http';
import { authenticate, requireDispatcher } from '../middleware/auth';
import { requireFields } from '../lib/validate';

// External providers (outsourcing) + referrals.
const providers = new Hono<AppEnv>();

// ─── Providers catalog ───
providers.get('/providers', authenticate, async (c) => {
  const where: any = { isActive: true };
  const st = c.req.query('serviceType');
  if (st) where.OR = [{ serviceType: st }, { serviceType: 'BOTH' }];
  const list = await c.get('prisma').externalProvider.findMany({ where, orderBy: { name: 'asc' } });
  return c.json({ success: true, data: list });
});

providers.post('/providers', authenticate, requireDispatcher, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ['name']);
  const p = await c.get('prisma').externalProvider.create({
    data: {
      name: body.name,
      serviceType: body.serviceType || 'AMBULANCE',
      phone: body.phone,
      contactName: body.contactName,
      coverageNote: body.coverageNote,
    },
  });
  return c.json({ success: true, data: p }, 201);
});

providers.patch('/providers/:id', authenticate, requireDispatcher, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const p = await c.get('prisma').externalProvider.update({
    where: { id: c.req.param('id') },
    data: {
      name: body.name,
      serviceType: body.serviceType,
      phone: body.phone,
      contactName: body.contactName,
      coverageNote: body.coverageNote,
      isActive: body.isActive,
    },
  });
  return c.json({ success: true, data: p });
});

// ─── Referrals (fallback to outsourcing when no internal unit) ───
providers.get('/referrals', authenticate, requireDispatcher, async (c) => {
  const list = await c.get('prisma').externalReferral.findMany({
    include: { provider: { select: { name: true, phone: true } }, request: { select: { code: true } } },
    orderBy: { referredAt: 'desc' },
    take: 100,
  });
  return c.json({ success: true, data: list });
});

providers.post('/referrals', authenticate, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  requireFields(body, ['providerName', 'reason']);
  const prisma = c.get('prisma');

  const referral = await prisma.externalReferral.create({
    data: {
      requestId: body.requestId || null,
      serviceType: body.serviceType || 'AMBULANCE',
      providerId: body.providerId || null,
      providerName: body.providerName,
      reason: body.reason,
      patientName: body.patientName,
      notes: body.notes,
      referredById: c.get('user').userId,
    },
  });

  // Leave a trace on the originating request, if any.
  if (body.requestId) {
    await prisma.requestEvent.create({
      data: {
        requestId: body.requestId,
        type: 'REFERRED_EXTERNAL',
        userId: c.get('user').userId,
        comment: `Derivado a ${body.providerName} (${body.reason})`,
      },
    });
  }

  return c.json({ success: true, data: referral }, 201);
});

providers.patch('/referrals/:id', authenticate, requireDispatcher, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.status) throw new AppError('status requerido');
  const r = await c.get('prisma').externalReferral.update({
    where: { id: c.req.param('id') },
    data: { status: body.status, notes: body.notes },
  });
  return c.json({ success: true, data: r });
});

export default providers;
