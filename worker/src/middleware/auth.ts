import type { MiddlewareHandler } from 'hono';
import { verify } from 'hono/jwt';
import type { AppEnv, JwtPayload } from '../types';

export const authenticate: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Token de acceso requerido' }, 401);
  }
  const token = authHeader.slice(7);
  try {
    const payload = (await verify(token, c.env.JWT_SECRET, 'HS256')) as JwtPayload;
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ success: false, error: 'Token inválido o expirado' }, 401);
  }
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get('user');
  if (!user) return c.json({ success: false, error: 'No autenticado' }, 401);
  if (user.role !== 'ADMIN') {
    return c.json({ success: false, error: 'No tienes permisos para esta acción' }, 403);
  }
  await next();
};

// Allow any of the given roles. Used for dispatcher-style endpoints where
// ADMIN and DISPATCHER share responsibilities.
export const requireRoles =
  (...roles: string[]): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const user = c.get('user');
    if (!user) return c.json({ success: false, error: 'No autenticado' }, 401);
    if (!roles.includes(user.role)) {
      return c.json({ success: false, error: 'No tienes permisos para esta acción' }, 403);
    }
    await next();
  };

// Coordination = ADMIN or DISPATCHER.
export const requireDispatcher = requireRoles('ADMIN', 'DISPATCHER');
