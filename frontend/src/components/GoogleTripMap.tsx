import { useEffect, useRef } from 'react';
import { loadGoogleMaps } from '../lib/googleMaps';
import { MAP_COLORS, type TripMapPoint, type LatLng } from './mapTypes';

// Mapa de Google Maps con marcadores del viaje y la línea del recorrido real.
// Mismas props que TripMap (OSM) para ser intercambiable.
export default function GoogleTripMap({
  apiKey,
  points,
  path = [],
}: {
  apiKey: string;
  points: TripMapPoint[];
  path?: LatLng[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then((google) => {
        if (cancelled || !ref.current) return;
        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(ref.current, {
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            zoom: 13,
            center: { lat: points[0]?.lat ?? 13.7, lng: points[0]?.lng ?? -89.2 },
          });
        }
        const map = mapRef.current;

        // Limpiar capas previas (refresh)
        layersRef.current.forEach((l) => l.setMap(null));
        layersRef.current = [];

        const bounds = new google.maps.LatLngBounds();

        if (path.length >= 2) {
          const poly = new google.maps.Polyline({
            path: path.map((p) => ({ lat: p.lat, lng: p.lng })),
            strokeColor: '#3b82f6',
            strokeOpacity: 0.85,
            strokeWeight: 4,
          });
          poly.setMap(map);
          layersRef.current.push(poly);
          path.forEach((p) => bounds.extend(p));
        }

        for (const p of points) {
          const marker = new google.maps.Marker({
            position: { lat: p.lat, lng: p.lng },
            map,
            title: p.label,
            zIndex: p.kind === 'last' ? 999 : 1,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: p.kind === 'last' ? 9 : 6,
              fillColor: MAP_COLORS[p.kind],
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
          });
          const info = new google.maps.InfoWindow({ content: p.label });
          marker.addListener('click', () => info.open({ anchor: marker, map }));
          if (p.kind === 'last') info.open({ anchor: marker, map });
          layersRef.current.push(marker);
          bounds.extend({ lat: p.lat, lng: p.lng });
        }

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, 60);
          if (points.length + path.length === 1) map.setZoom(15);
        }
      })
      .catch(() => { /* si Google falla, el contenedor queda vacío */ });

    return () => { cancelled = true; };
  }, [apiKey, points, path]);

  useEffect(() => () => { mapRef.current = null; }, []);

  return <div ref={ref} className="w-full h-72 rounded-2xl overflow-hidden border border-slate-700 z-0" />;
}
