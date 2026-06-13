import type { Bindings } from '../types';

// ─────────────────────────────────────────────
// Geocodificación multiproveedor reutilizable.
//   1. Google Places  (GOOGLE_MAPS_API_KEY)  ← mejor cobertura El Salvador
//   2. Mapbox         (MAPBOX_TOKEN)
//   3. Nominatim/OSM  (sin clave, fallback)
// Sesgado a El Salvador (country SV, español).
// ─────────────────────────────────────────────

export interface GeoResult { name: string; lat: number; lng: number }

export function activeProvider(env: Bindings): string {
  if (env.GOOGLE_MAPS_API_KEY) return 'google';
  if (env.MAPBOX_TOKEN) return 'mapbox';
  return 'nominatim';
}

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
  return data.features.map((f: any) => ({ name: f.place_name, lat: f.center[1], lng: f.center[0] }));
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

export async function geocodeSearch(env: Bindings, q: string): Promise<GeoResult[]> {
  const provider = activeProvider(env);
  try {
    if (provider === 'google') return await googlePlaces(q, env.GOOGLE_MAPS_API_KEY!);
    if (provider === 'mapbox') return await mapbox(q, env.MAPBOX_TOKEN!);
    return await nominatim(q);
  } catch {
    return [];
  }
}

// Mejor coincidencia (para autocompletar coordenadas a partir de una dirección).
export async function geocodeBest(env: Bindings, q: string): Promise<GeoResult | null> {
  if (!q || q.trim().length < 3) return null;
  const results = await geocodeSearch(env, q.trim());
  return results[0] || null;
}
