export interface TripMapPoint {
  lat: number;
  lng: number;
  label: string;
  kind: 'start' | 'last' | 'end';
}

export interface LatLng { lat: number; lng: number }

export const MAP_COLORS: Record<TripMapPoint['kind'], string> = {
  start: '#10b981', // verde: inicio
  last: '#3b82f6', // azul: posición actual
  end: '#ef4444', // rojo: fin
};
