import { Hono } from 'hono';
import type { AppEnv, Bindings } from '../types';
import { authenticate } from '../middleware/auth';

// ─────────────────────────────────────────────
// Geocodificación multiproveedor (búsqueda de direcciones).
// El proveedor se elige por la configuración disponible:
//   1. Google Places  (GOOGLE_MAPS_API_KEY)  ← mejor cobertura en El Salvador
//   2. Mapbox         (MAPBOX_TOKEN)
//   3. Nominatim/OSM  (sin clave, fallback)
// Resultados sesgados a El Salvador (countrycode SV).
// Se cachean 24h en el edge (la clave de caché NO incluye la API key).
// ─────────────────────────────────────────────

const geo = new Hono<AppEnv>();

interface GeoResult { name: string; lat: number; lng: number }

async function googlePlaces(q: string, key: string): Promise<GeoResult[]> {
  const url =
    'https://maps.googleapis.com/maps/api/place/textsearch/json?region=sv&language=es' +
    `&query=${encodeURIComponent(q + ', El Salvador')}&key=${key}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data: any = await res.json();
  if (!Array.isArray(data.results)) return [];
  return data.results.slice(0, 6).map((r: any) => ({
    name: r.name + (r.formatted_address ? ` — ${r.formatted_address}` : ''),
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
  }));
}

async function mapbox(q: string, token: string): Promise<GeoResult[]> {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
    `?country=sv&limit=6&language=es&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data: any = await res.json();
  if (!Array.isArray(data.features)) return [];
  return data.features.map((f: any) => ({
    name: f.place_name,
    lat: f.center[1],
    lng: f.center[0],
  }));
}

async function nominatim(q: string): Promise<GeoResult[]> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=sv&q=' +
    encodeURIComponent(q);
  const res = await fetch(url, { headers: { 'User-Agent': 'FleetOps/1.0 (fleet management app)' } });
  if (!res.ok) return [];
  const data: any = await res.json();
  return (Array.isArray(data) ? data : []).map((r: any) => ({
    name: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }));
}

function activeProvider(env: Bindings): string {
  if (env.GOOGLE_MAPS_API_KEY) return 'google';
  if (env.MAPBOX_TOKEN) return 'mapbox';
  return 'nominatim';
}

geo.get('/search', authenticate, async (c) => {
  const q = (c.req.query('q') || '').trim();
  if (q.length < 3) return c.json({ success: true, data: [], provider: activeProvider(c.env) });

  const provider = activeProvider(c.env);

  // Caché por proveedor+consulta, SIN exponer la API key en la clave.
  const cache = (caches as any).default as Cache;
  const cacheKey = new Request(
    `https://geo.fleetops.cache/${provider}?q=${encodeURIComponent(q.toLowerCase())}`
  );
  const cached = await cache.match(cacheKey);
  if (cached) {
    const data = await cached.json();
    return c.json({ success: true, data, provider, cached: true });
  }

  let results: GeoResult[] = [];
  try {
    if (provider === 'google') results = await googlePlaces(q, c.env.GOOGLE_MAPS_API_KEY!);
    else if (provider === 'mapbox') results = await mapbox(q, c.env.MAPBOX_TOKEN!);
    else results = await nominatim(q);
  } catch {
    results = [];
  }

  // Guardar en caché 24h.
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
