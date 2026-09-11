import { coordinates, POSITION_MAX_AGE_MS, type DriverPosition } from './tripProgress';

export type GpsState = 'locating' | 'live' | 'denied' | 'unavailable' | 'imprecise';
export type SyncState = 'waiting' | 'saving' | 'saved' | 'error';
export const REPORT_INTERVAL_MS = 30_000;

interface Options {
  geolocation?: Pick<Geolocation, 'watchPosition' | 'clearWatch' | 'getCurrentPosition'>;
  report: (position: DriverPosition) => Promise<unknown>;
  onPosition: (position: DriverPosition) => void;
  onGps: (state: GpsState) => void;
  onSync: (state: SyncState) => void;
  now?: () => number;
}

// One controller per active trip. Local fixes update immediately; network
// reports are rate-limited and never replay a stale fix as a new breadcrumb.
export function startDriverLocation({ geolocation, report, onPosition, onGps, onSync,
  now = Date.now }: Options) {
  let disposed = false;
  let denied = false;
  let pending = false;
  let latest: DriverPosition | null = null;
  let lastAttempt = -Infinity;
  let lastReported = -Infinity;
  let watchId: number | undefined;
  const settings: PositionOptions = { enableHighAccuracy: true, timeout: 12_000, maximumAge: 10_000 };

  function publish() {
    if (disposed || pending || !latest || latest.capturedAt <= lastReported ||
        now() - latest.capturedAt > POSITION_MAX_AGE_MS || now() - lastAttempt < REPORT_INTERVAL_MS) return;
    const fix = latest;
    pending = true;
    lastAttempt = now();
    onSync('saving');
    Promise.resolve().then(() => disposed ? undefined : report(fix)).then(() => {
      if (disposed) return;
      lastReported = fix.capturedAt;
      onSync('saved');
    }).catch(() => {
      if (!disposed) onSync('error');
    }).finally(() => { pending = false; });
  }

  function accept(position: GeolocationPosition) {
    if (disposed || denied) return;
    const point = coordinates(position.coords.latitude, position.coords.longitude);
    if (!point || !Number.isFinite(position.timestamp) || position.timestamp > now() + 5_000 ||
        now() - position.timestamp > POSITION_MAX_AGE_MS) { onGps('unavailable'); return; }
    if (!Number.isFinite(position.coords.accuracy) || position.coords.accuracy < 0 || position.coords.accuracy > 200) {
      onGps('imprecise'); return;
    }
    if (latest && position.timestamp < latest.capturedAt) return;
    latest = { ...point, accuracy: position.coords.accuracy, capturedAt: position.timestamp };
    onGps('live');
    onPosition(latest);
    publish();
  }

  function fail(error: GeolocationPositionError) {
    if (disposed) return;
    denied = error.code === 1;
    onGps(denied ? 'denied' : 'unavailable');
  }

  function refresh() {
    if (disposed || denied || !geolocation) return;
    try { geolocation.getCurrentPosition(accept, fail, settings); }
    catch { onGps('unavailable'); }
  }

  if (!geolocation) onGps('unavailable');
  else {
    onGps('locating');
    try { watchId = geolocation.watchPosition(accept, fail, settings); }
    catch { onGps('unavailable'); }
  }
  return {
    refresh,
    stop() {
      disposed = true;
      if (watchId !== undefined) geolocation?.clearWatch(watchId);
    },
  };
}
