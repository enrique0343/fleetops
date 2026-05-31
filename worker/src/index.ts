import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv } from './types';
import { getPrisma } from './lib/db';
import { handleError } from './lib/http';

import authRoutes from './routes/auth';
import tripsRoutes from './routes/trips';
import catalogsRoutes from './routes/catalogs';
import fuelRoutes from './routes/fuel';
import auditRoutes from './routes/audit';
import seedRoutes from './routes/seed';

const app = new Hono<AppEnv>();

// CORS (origin configurable via CORS_ORIGIN var)
app.use('*', (c, next) => {
  const origin = c.env.CORS_ORIGIN || '*';
  return cors({
    origin,
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-seed-token'],
  })(c, next);
});

// Attach a per-request Prisma client bound to the D1 database.
app.use('*', async (c, next) => {
  c.set('prisma', getPrisma(c.env));
  await next();
});

// Health check
app.get('/health', (c) =>
  c.json({
    status: 'ok',
    service: 'FleetOps API',
    version: '1.0.0',
    runtime: 'cloudflare-workers',
    timestamp: new Date().toISOString(),
  })
);

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/trips', tripsRoutes);
app.route('/api/catalogs', catalogsRoutes);
app.route('/api/fuel', fuelRoutes);
app.route('/api/audit', auditRoutes);
app.route('/api/seed', seedRoutes);

// 404
app.notFound((c) =>
  c.json({ success: false, error: `Ruta no encontrada: ${c.req.method} ${c.req.path}` }, 404)
);

// Centralised error handler
app.onError((err, c) => handleError(err as Error, c));

export default app;
