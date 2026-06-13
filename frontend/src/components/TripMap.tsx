import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TripMapPoint, LatLng } from './mapTypes';

export type { TripMapPoint } from './mapTypes';

// Mapa OSM (gratuito) con la posición del conductor, los puntos del viaje y
// la línea del recorrido real (breadcrumbs). Lazy para no inflar el bundle.
export default function TripMap({ points, path = [] }: { points: TripMapPoint[]; path?: LatLng[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!ref.current || points.length === 0) return;

    if (!mapRef.current) {
      mapRef.current = L.map(ref.current, { zoomControl: true, attributionControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(mapRef.current);
    }
    const map = mapRef.current;

    // Limpiar marcadores y trazos previos (refresh)
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    // Línea del recorrido real
    if (path.length >= 2) {
      L.polyline(path.map((p) => [p.lat, p.lng] as [number, number]), {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.75,
      }).addTo(map);
    }

    const colors: Record<TripMapPoint['kind'], string> = {
      start: '#10b981', // verde: inicio
      last: '#3b82f6',  // azul: posición actual
      end: '#ef4444',   // rojo: fin
    };

    for (const p of points) {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: p.kind === 'last' ? 10 : 7,
        color: colors[p.kind],
        fillColor: colors[p.kind],
        fillOpacity: 0.85,
        weight: p.kind === 'last' ? 3 : 2,
      }).addTo(map);
      marker.bindPopup(p.label);
      if (p.kind === 'last') marker.openPopup();
    }

    const all = [
      ...points.map((p) => [p.lat, p.lng] as [number, number]),
      ...path.map((p) => [p.lat, p.lng] as [number, number]),
    ];
    const bounds = L.latLngBounds(all);
    map.fitBounds(bounds.pad(0.3), { maxZoom: 15 });
  }, [points, path]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  return <div ref={ref} className="w-full h-72 rounded-2xl overflow-hidden border border-slate-700 z-0" />;
}
