import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { prisma } from '../config/database';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(String(req.query.page) || '1');
  const limit = parseInt(String(req.query.limit) || '30');
  const { entityName, entityId, adminId, action } = req.query;

  const where: Record<string, unknown> = {};
  if (entityName) where.entityName = entityName;
  if (entityId) where.entityId = entityId;
  if (adminId) where.adminId = adminId;
  if (action) where.action = action;

  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        admin: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    success: true,
    data: logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}));

export default router;
