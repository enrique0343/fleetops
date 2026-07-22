import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import type { AppEnv } from '../types';
import { AppError } from '../lib/http';
import { hashPassword, verifyPassword } from '../lib/crypto';
import { authenticate } from '../middleware/auth';
import { requireFields, isEmail, normalizeEmail } from '../lib/validate';

const auth = new Hono<AppEnv>();

function expiresInSeconds(spec?: string): number {
  if (!spec) return 60 * 60 * 24 * 7;
  const m = /^(\d+)([smhd])?$/.exec(spec.trim());
  if (!m) return 60 * 60 * 24 * 7;
  const n = parseInt(m[1], 10);
  const unit = m[2] || 's';
  const mult = unit === 'd' ? 86400 : unit === 'h' ? 3600 : unit === 'm' ? 60 : 1;
  return n * mult;
}

async function signToken(c: any, payload: object): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds(c.env.JWT_EXPIRES_IN);
  return sign({ ...payload, exp }, c.env.JWT_SECRET);
}

// POST /api/auth/register
auth.post('/register', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!isEmail(body.email)) throw new AppError('Datos inválidos: email');
  if (!body.password || String(body.password).length < 8) throw new AppError('La contraseña debe tener al menos 8 caracteres');
  requireFields(body, ['fullName']);

  const prisma = c.get('prisma');
  const email = normalizeEmail(body.email);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError('Ya existe una cuenta con ese correo', 409);

  const passwordHash = await hashPassword(body.password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: body.fullName,
      phone: body.phone || null,
      branchId: body.branchId || null,
      role: 'DRIVER', // Self-registration always creates DRIVER
    },
  });

  const token = await signToken(c, { userId: user.id, email: user.email, role: user.role });

  return c.json(
    {
      success: true,
      data: { token, user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } },
    },
    201
  );
});

// POST /api/auth/login
auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!isEmail(body.email) || !body.password) throw new AppError('Datos inválidos');

  const prisma = c.get('prisma');
  const email = normalizeEmail(body.email);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) throw new AppError('Credenciales inválidas', 401);

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) throw new AppError('Credenciales inválidas', 401);

  const token = await signToken(c, { userId: user.id, email: user.email, role: user.role });

  return c.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        branchId: user.branchId,
      },
    },
  });
});

// GET /api/auth/me
auth.get('/me', authenticate, async (c) => {
  const prisma = c.get('prisma');
  const user = await prisma.user.findUnique({
    where: { id: c.get('user').userId },
    include: { branch: true },
  });
  if (!user) throw new AppError('Usuario no encontrado', 404);

  return c.json({
    success: true,
    data: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone,
      photoUrl: user.photoUrl,
      branchId: user.branchId,
      branch: user.branch,
    },
  });
});

// PATCH /api/auth/me/profile — el usuario actualiza su propio perfil (foto, teléfono)
auth.patch('/me/profile', authenticate, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  // La foto viaja como data URL JPEG ya reducida en el cliente; límite defensivo.
  if (body.photoUrl && (typeof body.photoUrl !== 'string' || body.photoUrl.length > 300_000)) {
    throw new AppError('La foto es demasiado grande');
  }
  const user = await c.get('prisma').user.update({
    where: { id: c.get('user').userId },
    data: {
      photoUrl: body.photoUrl !== undefined ? body.photoUrl || null : undefined,
      phone: body.phone !== undefined ? body.phone || null : undefined,
    },
  });
  return c.json({
    success: true,
    data: { id: user.id, photoUrl: user.photoUrl, phone: user.phone },
  });
});

// PATCH /api/auth/change-password
auth.patch('/change-password', authenticate, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!body.currentPassword || !body.newPassword || String(body.newPassword).length < 6) {
    throw new AppError('Datos inválidos');
  }

  const prisma = c.get('prisma');
  const user = await prisma.user.findUnique({ where: { id: c.get('user').userId } });
  if (!user) throw new AppError('Usuario no encontrado', 404);

  const valid = await verifyPassword(body.currentPassword, user.passwordHash);
  if (!valid) throw new AppError('Contraseña actual incorrecta', 401);

  const passwordHash = await hashPassword(body.newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return c.json({ success: true, message: 'Contraseña actualizada correctamente' });
});

export default auth;
