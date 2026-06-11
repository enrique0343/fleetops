import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface TripMapPoint {
  lat: number;
  lng: number;
  label: string;
  kind: 'start' | 'last' | 'end';
}

// Mapa OSM (gratuito) con la posición del conductor y los puntos del viaje.
// Se carga lazy para no llevar Leaflet al bundle principal.
export default function TripMap({ points }: { points: TripMapPoint[] }) {
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

    // Limpiar marcadores previos (refresh)
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) map.removeLayer(layer);
    });

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

    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.3), { maxZoom: 15 });
  }, [points]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  return <div ref={ref} className="w-full h-72 rounded-2xl overflow-hidden border border-slate-700 z-0" />;
}
