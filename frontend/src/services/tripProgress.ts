export interface Coordinates { lat: number; lng: number }
export interface DriverPosition extends Coordinates { accuracy: number; capturedAt: number }

export const POSITION_MAX_AGE_MS = 45_000;

export function coordinates(lat: unknown, lng: unknown): Coordinates | null {
  if (typeof lat !== 'number' || typeof lng !== 'number' ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) *
    Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

// This measures proximity to the destination, not road distance or an ETA.
// Detours may decrease it. Only the driver's explicit finish can reach 100%.
export function tripProgress(start: Coordinates | null, destination: Coordinates | null,
  current: Coordinates | null, finished = false) {
  const remaining = destination && current ? distanceMeters(current, destination) : null;
  if (!start || !destination || !current) return { percent: null, remaining, nearDestination: false };
  const initial = distanceMeters(start, destination);
  if (initial < 100) return { percent: finished ? 100 : null, remaining, nearDestination: remaining! <= 100 };
  return {
    percent: finished ? 100 : Math.min(99, Math.max(0, Math.round((1 - remaining! / initial) * 100))),
    remaining,
    nearDestination: remaining! <= 100,
  };
}

export function formatDistance(meters: number | null): string {
  if (meters == null) return 'Sin dato';
  if (meters < 100) return 'Menos de 100 m';
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toLocaleString('es-SV', { maximumFractionDigits: 1 })} km`;
}
