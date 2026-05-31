import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { authenticate, requireAdmin } from '../middleware/auth';
import { fromJson } from '../lib/json';

const audit = new Hono<AppEnv>();

// GET /api/audit
audit.get('/', authenticate, requireAdmin, async (c) => {
  const q = c.req.query();
  const pageNum = parseInt(q.page || '') || 1;
  const limitNum = parseInt(q.limit || '') || 50;

  const where: any = {};
  if (q.entityName) where.entityName = q.entityName;
  if (q.entityId) where.entityId = q.entityId;
  if (q.adminId) where.adminId = q.adminId;
  if (q.action) where.action = q.action;

  const prisma = c.get('prisma');
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { admin: { select: { fullName: true, email: true } } },
      orderBy: { timestamp: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Decode JSON-encoded old/new values for the response.
  const decoded = logs.map((l: any) => ({
    ...l,
    oldValue: fromJson(l.oldValue),
    newValue: fromJson(l.newValue),
  }));

  return c.json({
    success: true,
    data: { data: decoded, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
  });
});

export default audit;
