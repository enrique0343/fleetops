// ─────────────────────────────────────────────
// Deterministic routing engine.
//
// IMPORTANT: distances and visit order are computed here, NOT by an LLM.
// The MCP tools expose this engine so an agent (Claude) can ORCHESTRATE it —
// decide what to group and explain the result — while the geometry stays exact
// and reproducible.
//
// Two backends:
//   - OSRM "trip" service (real road network) when OSRM_URL is set
//   - Haversine + nearest-neighbor heuristic as an offline fallback
// ─────────────────────────────────────────────

export interface Stop {
  id: string;
  label?: string;
  lat: number;
  lng: number;
  serviceTimeMin?: number;
}

export interface OptimizeOptions {
  osrmUrl?: string;
  roundtrip?: boolean; // return to the start point
  fixedStart?: boolean; // keep the first stop as the origin
  avgSpeedKmh?: number; // used to estimate duration when OSRM is unavailable
}

export interface OptimizeResult {
  engine: 'osrm' | 'nearest-neighbor';
  order: string[]; // stop ids in visiting order
  orderedStops: Stop[];
  totalDistanceKm: number;
  totalDurationMin: number;
  legs: { from: string; to: string; distanceKm: number }[];
}

export function haversineKm(a: Stop, b: Stop): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function nearestNeighbor(stops: Stop[], fixedStart: boolean, roundtrip: boolean): OptimizeResult {
  if (stops.length === 0) {
    return { engine: 'nearest-neighbor', order: [], orderedStops: [], totalDistanceKm: 0, totalDurationMin: 0, legs: [] };
  }
  const remaining = [...stops];
  const ordered: Stop[] = [];
  // Anchor: keep first stop if requested, otherwise start from the first.
  let current = fixedStart ? remaining.shift()! : remaining.shift()!;
  ordered.push(current);

  const legs: OptimizeResult['legs'] = [];
  let distance = 0;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    legs.push({ from: current.id, to: next.id, distanceKm: round1(bestDist) });
    distance += bestDist;
    current = next;
    ordered.push(current);
  }

  if (roundtrip && ordered.length > 1) {
    const back = haversineKm(current, ordered[0]);
    legs.push({ from: current.id, to: ordered[0].id, distanceKm: round1(back) });
    distance += back;
  }

  const serviceMin = stops.reduce((s, st) => s + (st.serviceTimeMin || 0), 0);
  return {
    engine: 'nearest-neighbor',
    order: ordered.map((s) => s.id),
    orderedStops: ordered,
    totalDistanceKm: round1(distance),
    totalDurationMin: serviceMin, // duration filled by caller using avg speed
    legs,
  };
}

async function osrmTrip(stops: Stop[], osrmUrl: string, roundtrip: boolean, fixedStart: boolean): Promise<OptimizeResult | null> {
  if (stops.length < 2) return null;
  const coords = stops.map((s) => `${s.lng},${s.lat}`).join(';');
  const params = new URLSearchParams({
    source: fixedStart ? 'first' : 'any',
    roundtrip: String(roundtrip),
  });
  if (!roundtrip) params.set('destination', 'last');
  const url = `${osrmUrl.replace(/\/$/, '')}/trip/v1/driving/${coords}?${params}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data: any = await res.json();
  if (data.code !== 'Ok' || !data.waypoints) return null;

  const ordered = stops
    .map((s, i) => ({ stop: s, idx: data.waypoints[i].waypoint_index }))
    .sort((a, b) => a.idx - b.idx)
    .map((x) => x.stop);

  const legs: OptimizeResult['legs'] = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    legs.push({ from: ordered[i].id, to: ordered[i + 1].id, distanceKm: round1(haversineKm(ordered[i], ordered[i + 1])) });
  }

  const trip = data.trips?.[0];
  const serviceMin = stops.reduce((s, st) => s + (st.serviceTimeMin || 0), 0);
  return {
    engine: 'osrm',
    order: ordered.map((s) => s.id),
    orderedStops: ordered,
    totalDistanceKm: trip ? round1(trip.distance / 1000) : 0,
    totalDurationMin: trip ? Math.round(trip.duration / 60) + serviceMin : serviceMin,
    legs,
  };
}

export async function optimizeRoute(stops: Stop[], opts: OptimizeOptions = {}): Promise<OptimizeResult> {
  const roundtrip = opts.roundtrip ?? false;
  const fixedStart = opts.fixedStart ?? true;
  const avgSpeed = opts.avgSpeedKmh ?? 30;

  if (opts.osrmUrl) {
    try {
      const r = await osrmTrip(stops, opts.osrmUrl, roundtrip, fixedStart);
      if (r) return r;
    } catch {
      // fall through to heuristic
    }
  }

  const r = nearestNeighbor(stops, fixedStart, roundtrip);
  const serviceMin = stops.reduce((s, st) => s + (st.serviceTimeMin || 0), 0);
  r.totalDurationMin = Math.round((r.totalDistanceKm / avgSpeed) * 60) + serviceMin;
  return r;
}

// Navigation deep-links (free; open the driver's native app).
export function buildNavigation(orderedStops: Stop[]) {
  const stops = orderedStops.map((s) => ({
    id: s.id,
    label: s.label ?? s.id,
    lat: s.lat,
    lng: s.lng,
    waze: `https://waze.com/ul?ll=${s.lat},${s.lng}&navigate=yes`,
    gmaps: `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`,
  }));

  let multiStop: string | null = null;
  if (stops.length >= 1) {
    const dest = stops[stops.length - 1];
    const waypoints = stops.slice(0, -1).map((s) => `${s.lat},${s.lng}`).join('|');
    multiStop = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}${
      waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''
    }`;
  }
  return { stops, multiStop };
}

// Free OSM geocoding (Nominatim). Caller should cache + respect rate limits.
export async function geocode(query: string, nominatimUrl = 'https://nominatim.openstreetmap.org'): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url = `${nominatimUrl.replace(/\/$/, '')}/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'fleetops-routing-mcp/1.0' } });
  if (!res.ok) return null;
  const data: any = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), displayName: data[0].display_name };
}
