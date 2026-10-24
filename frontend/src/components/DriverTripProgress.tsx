import { useId } from 'react';
import { Truck, MapPin, Timer, LocateFixed, Signal, SignalZero } from 'lucide-react';
import type { Trip, Location } from '../types';
import type { GpsState, SyncState } from '../services/driverLocation';
import { coordinates, formatDistance, tripProgress, POSITION_MAX_AGE_MS, type DriverPosition } from '../services/tripProgress';
import './DriverTripProgress.css';

interface Props {
  trip: Trip;
  destination?: Location;
  position: DriverPosition | null;
  firstPosition: DriverPosition | null;
  gps: GpsState;
  sync: SyncState;
  elapsed: string;
  onRetry: () => void;
}

export function DriverTripProgress({ trip, destination, position, firstPosition, gps, sync, elapsed, onRetry }: Props) {
  const id = useId().replace(/:/g, '');
  const saved = coordinates(trip.lastLat, trip.lastLng);
  const start = coordinates(trip.startLat, trip.startLng) || firstPosition;
  const target = coordinates(trip.destination?.lat, trip.destination?.lng) || coordinates(destination?.lat, destination?.lng);
  const current = position || saved;
  const rawCapturedAt = position?.capturedAt ?? (trip.lastPingAt ? new Date(trip.lastPingAt).getTime() : null);
  const capturedAt = rawCapturedAt != null && Number.isFinite(rawCapturedAt) ? rawCapturedAt : null;
  const age = capturedAt == null ? null : Math.max(0, Date.now() - capturedAt);
  const fresh = position != null && age != null && age <= POSITION_MAX_AGE_MS && gps === 'live';
  const progress = tripProgress(start, target, current, trip.status === 'FINISHED');
  const percent = progress.percent;
  const t = (percent ?? 0) / 100;
  const x = 24 + 272 * t;
  const y = 82 - 136 * t * (1 - t);
  const status = trip.status === 'IN_STOP' ? 'En parada' : trip.status === 'IN_INCIDENT' ? 'Incidencia activa' : 'En ruta';
  const tone = trip.status === 'IN_STOP' ? 'stop' : trip.status === 'IN_INCIDENT' ? 'incident' : 'transit';
  const signalText = gps === 'denied' ? 'Ubicación sin permiso' : gps === 'imprecise' ? 'Señal GPS imprecisa' : fresh ? 'GPS activo' : current ? 'Sin GPS reciente' : gps === 'locating' ? 'Buscando ubicación' : 'GPS no disponible';
  const ageText = age == null ? 'Aún sin ubicación' : age < 60_000 ? `Hace ${Math.floor(age / 1000)} s` : `Hace ${Math.floor(age / 60_000)} min`;
  const startTime = new Date(trip.startedAt).toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit', hour12: false });
  const pendingText = !target ? 'Destino sin coordenadas' : !start || !current ? 'Esperando ubicación' : 'Origen y destino muy cercanos';

  return (
    <section className="driver-progress" aria-label="Seguimiento de tu viaje">
      <div className="driver-progress-heading">
        <div><p className="driver-progress-eyebrow">TU VIAJE</p><h2>Así va tu recorrido</h2></div>
        <span className={`driver-progress-status ${tone}`}>{status}</span>
      </div>
      <div className={`driver-progress-route ${tone}`}>
        <div className="driver-progress-endpoints">
          <div><span>Origen</span><strong>{trip.originBranch?.name || 'Punto de inicio GPS'}</strong><small>Salida {startTime}</small></div>
          <div><span>Destino</span><strong>{trip.destination?.name || destination?.name || 'Destino del viaje'}</strong><small>{progress.nearDestination && fresh ? 'Cerca del destino' : 'Llegada por confirmar'}</small></div>
        </div>
        <div className="driver-progress-figure" role="img" aria-label={percent == null ? `Avance pendiente: ${pendingText}` : `${percent}% de aproximación al destino, calculado en línea recta${fresh ? '' : ', última ubicación disponible'}`}>
          <svg viewBox="0 0 320 110" aria-hidden="true">
            <defs><linearGradient id={`route-${id}`}><stop stopColor="#effbff" /><stop offset="1" stopColor="#5edaff" /></linearGradient></defs>
            <path d="M24 82 Q160 14 296 82" pathLength="100" className="driver-progress-track" />
            {percent != null && <path d="M24 82 Q160 14 296 82" pathLength="100" className="driver-progress-fill" stroke={`url(#route-${id})`} strokeDasharray={`${percent} 100`} />}
            <circle cx="24" cy="82" r="4" fill="#e2f3ff" /><circle cx="296" cy="82" r="4" fill="#728492" />
            {percent != null && <g className="driver-progress-vehicle" style={{ transform: `translate(${x}px, ${y}px)` }}>
              <circle r="23" fill={fresh ? '#51d3f526' : '#94a3b826'} /><circle r="16" fill={fresh ? '#6cdef7' : '#b0c2d0'} />
              <Truck x="-11" y="-11" width="22" height="22" color="#062137" strokeWidth="1.8" />
            </g>}
          </svg>
        </div>
        <div className="driver-progress-amount"><strong>{percent == null ? 'Avance pendiente' : `${percent}%`}</strong><span>{percent == null ? pendingText : fresh ? 'hacia el destino · aprox.' : 'último avance estimado'}</span></div>
      </div>
      <div className="driver-progress-metrics">
        <div><span><Timer size={16} /> Tiempo transcurrido</span><strong className="driver-progress-timer">{elapsed}</strong></div>
        <div><span><MapPin size={16} /> Al destino · aprox.</span><strong>{formatDistance(progress.remaining)}</strong></div>
      </div>
      <p className="driver-progress-disclaimer">Distancia y avance en línea recta; pueden variar con la ruta. El viaje termina cuando confirmas la llegada.</p>
      <div className="driver-progress-signal">
        <div>{fresh ? <Signal size={18} /> : <SignalZero size={18} />}<span><strong>{signalText}</strong><small>{ageText}{sync === 'saving' ? ' · guardando' : sync === 'saved' ? ' · último envío guardado' : ''}</small></span></div>
        {!fresh && <button type="button" onClick={onRetry} aria-label="Reintentar ubicación GPS"><LocateFixed size={17} /> Reintentar</button>}
      </div>
      {gps === 'denied' && <p className="driver-progress-notice">Permite el acceso a tu ubicación en los ajustes de este sitio y vuelve a intentarlo.</p>}
      {sync === 'error' && <p className="driver-progress-notice">No se pudo guardar la última ubicación. Se reintentará con una posición reciente.</p>}
      <div className="driver-progress-footer"><Truck size={17} /><span>{trip.vehicle?.plate || 'Vehículo asignado'}{trip.vehicle?.brand ? ` · ${trip.vehicle.brand} ${trip.vehicle.model}` : ''}</span></div>
      {trip.comment && <p className="driver-progress-comment">{trip.comment}</p>}
      <p className="driver-progress-open-hint">Mantén FleetOps abierto para actualizar el seguimiento.</p>
    </section>
  );
}
