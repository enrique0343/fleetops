import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { authenticate } from '../middleware/auth';

// Geocodificación de direcciones (búsqueda tipo Google Maps/Waze) usando
// OpenStreetMap Nominatim (gratuito). Se cachea 24h en el edge para respetar
// el rate-limit del servicio público (~1 req/s).
const geo = new Hono<AppEnv>();

geo.get('/search', authenticate, async (c) => {
  const q = (c.req.query('q') || '').trim();
  if (q.length < 3) return c.json({ success: true, data: [] });

  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=5&q=' + encodeURIComponent(q);

  const cache = (caches as any).default as Cache;
  const cacheKey = new Request(url);
  let res = await cache.match(cacheKey);

  if (!res) {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'FleetOps/1.0 (fleet management app)' },
    });
    if (!upstream.ok) {
      return c.json({ success: true, data: [], warning: 'Servicio de búsqueda no disponible' });
    }
    res = new Response(upstream.body, upstream);
    res.headers.set('Cache-Control', 'public, max-age=86400');
    c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
  }

  const raw = (await res.json()) as any[];
  const data = (Array.isArray(raw) ? raw : []).map((r) => ({
    name: r.display_name as string,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }));

  return c.json({ success: true, data });
});

export default geo;
