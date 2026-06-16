import type { Bindings } from '../types';

export interface LatLng { lat: number; lng: number }

// Ajusta una secuencia de puntos GPS a la red vial (Google Roads API
// "Snap to Roads"). Con interpolate=true rellena la geometría de las calles
// entre puntos, de modo que la línea siga las vías reales (curvas y giros)
// en lugar de líneas rectas. Requiere la "Roads API" habilitada en la key.
// Sin Google configurado, devuelve los puntos crudos (líneas rectas).
export async function snapToRoads(env: Bindings, points: LatLng[]): Promise<LatLng[]> {
  if (!env.GOOGLE_MAPS_API_KEY || points.length < 2) return points;

  const out: LatLng[] = [];
  // La API acepta máx. 100 puntos por llamada; se procesa por lotes con
  // solape de 1 punto para mantener continuidad entre lotes.
  const BATCH = 100;
  for (let i = 0; i < points.length; i += BATCH - 1) {
    const batch = points.slice(i, i + BATCH);
    if (batch.length < 2) {
      if (batch.length === 1 && out.length === 0) out.push(batch[0]);
      break;
    }
    const path = batch.map((p) => `${p.lat},${p.lng}`).join('|');
    const url =
      `https://roads.googleapis.com/v1/snapToRoads?interpolate=true&key=${env.GOOGLE_MAPS_API_KEY}&path=${path}`;
    try {
      const res = await fetch(url);
      if (!res.ok) { out.push(...batch); continue; }
      const data: any = await res.json();
      if (Array.isArray(data.snappedPoints) && data.snappedPoints.length > 0) {
        out.push(...data.snappedPoints.map((sp: any) => ({ lat: sp.location.latitude, lng: sp.location.longitude })));
      } else {
        out.push(...batch);
      }
    } catch {
      out.push(...batch);
    }
  }
  return out;
}
