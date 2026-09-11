import { useEffect, useState } from 'react';
import api from '../services/api';
import { startDriverLocation, REPORT_INTERVAL_MS, type GpsState, type SyncState } from '../services/driverLocation';
import type { DriverPosition } from '../services/tripProgress';

interface TrackingState {
  tripId: string | null;
  position: DriverPosition | null;
  firstPosition: DriverPosition | null;
  gps: GpsState;
  sync: SyncState;
}
const initial = (tripId: string | null): TrackingState => ({
  tripId, position: null, firstPosition: null, gps: 'locating', sync: 'waiting',
});

export function useDriverTracking(tripId: string | null) {
  const [state, setState] = useState(() => initial(tripId));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setState((old) => old.tripId === tripId ? { ...old, gps: 'locating' } : initial(tripId));
    if (!tripId) return;
    const controller = startDriverLocation({
      geolocation: navigator.geolocation,
      report: (position) => api.post(`/trips/${tripId}/ping`, { lat: position.lat, lng: position.lng }),
      onPosition: (position) => setState((s) => ({ ...s, position, firstPosition: s.firstPosition || position })),
      onGps: (gps) => setState((s) => ({ ...s, gps })),
      onSync: (sync) => setState((s) => ({ ...s, sync })),
    });
    const refresh = () => { if (document.visibilityState !== 'hidden') controller.refresh(); };
    const timer = window.setInterval(refresh, REPORT_INTERVAL_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => {
      controller.stop();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [tripId, attempt]);
  return { ...(state.tripId === tripId ? state : initial(tripId)), retry: () => setAttempt((n) => n + 1) };
}
