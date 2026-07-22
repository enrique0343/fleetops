import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { authenticate } from '../middleware/auth';
import { geocodeSearch, activeProvider, type GeoResult } from '../lib/geocode';

// Búsqueda de direcciones (geocodificación). Cachea 24h en el edge sin
// exponer la API key en la clave de caché.
const geo = new Hono<AppEnv>();

geo.get('/search', authenticate, async (c) => {
  const q = (c.req.query('q') || '').trim();
  const provider = activeProvider(c.env);
  if (q.length < 3) return c.json({ success: true, data: [], provider });

  const cache = (caches as any).default as Cache;
  const cacheKey = new Request(
    `https://geo.fleetops.cache/${provider}?q=${encodeURIComponent(q.toLowerCase())}`
  );
  const cached = await cache.match(cacheKey);
  if (cached) {
    const data = (await cached.json()) as GeoResult[];
    return c.json({ success: true, data, provider, cached: true });
  }

  const results = await geocodeSearch(c.env, q);
  c.executionCtx.waitUntil(
    cache.put(
      cacheKey,
      new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
      })
    )
  );
  return c.json({ success: true, data: results, provider });
});

export default geo;
