import { lazy, Suspense, useEffect, useState } from 'react';
import api from '../services/api';
import type { TripMapPoint, LatLng } from './mapTypes';

const GoogleTripMap = lazy(() => import('./GoogleTripMap'));
const TripMap = lazy(() => import('./TripMap'));

// Cache a nivel de módulo: se consulta /config una sola vez por sesión.
// undefined = aún no consultado; null = sin clave (usar OSM); string = clave Google.
let cachedKey: string | null | undefined = undefined;

// Selector de mapa: usa Google Maps si hay clave de navegador configurada;
// si no, cae al mapa OSM/Leaflet. Interfaz idéntica para ambos.
export default function LiveMap({ points, path = [] }: { points: TripMapPoint[]; path?: LatLng[] }) {
  const [key, setKey] = useState<string | null | undefined>(cachedKey);

  useEffect(() => {
    if (cachedKey !== undefined) { setKey(cachedKey); return; }
    api
      .get('/config')
      .then((r) => { cachedKey = r.data.data.googleMapsKey || null; setKey(cachedKey); })
      .catch(() => { cachedKey = null; setKey(null); });
  }, []);

  const fallback = <div className="w-full h-72 rounded-2xl bg-slate-700 animate-pulse" />;
  if (key === undefined) return fallback;

  return (
    <Suspense fallback={fallback}>
      {key ? <GoogleTripMap apiKey={key} points={points} path={path} /> : <TripMap points={points} path={path} />}
    </Suspense>
  );
}
