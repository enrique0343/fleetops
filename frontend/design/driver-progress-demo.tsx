import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DriverTripProgress } from '../src/components/DriverTripProgress';
import type { TripStatus } from '../src/types';
import './driver-progress-demo.css';

function Demo() {
  const [advance, setAdvance] = useState(58);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState<TripStatus>('IN_TRANSIT');
  const [signal, setSignal] = useState('live');
  const [now, setNow] = useState(Date.now());
  const [startedAt] = useState(() => new Date(Date.now() - 18 * 60_000).toISOString());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!playing || signal !== 'live' || status !== 'IN_TRANSIT') return;
    const id = setInterval(() => setAdvance((p) => Math.min(99, p + 1)), 800);
    return () => clearInterval(id);
  }, [playing, signal, status]);
  const start = { lat: 13.703, lng: -89.245 };
  const destination = { lat: 13.675, lng: -89.285 };
  const position = signal === 'denied' || signal === 'missing' ? null : {
    lat: start.lat + (destination.lat - start.lat) * advance / 100,
    lng: start.lng + (destination.lng - start.lng) * advance / 100,
    accuracy: 12,
    capturedAt: now - (signal === 'stale' ? 120_000 : 3000),
  };
  const seconds = Math.floor((now - new Date(startedAt).getTime()) / 1000);
  const elapsed = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return <main className="demo">
    <header className="demo-heading"><span>FLEETOPS</span><h1>Seguimiento del conductor</h1><p>Vista previa interactiva · datos simulados</p></header>
    <div className="demo-layout">
      <div className="demo-phone">
        <div className="demo-app-header"><strong>FleetOps</strong><span>Carlos · Motorista</span></div>
        <div className="demo-content">
          <DriverTripProgress trip={{
            id: 'demo-trip', driverId: 'demo-driver', vehicleId: 'demo-vehicle', originBranchId: 'demo-origin',
            destinationId: 'demo-destination', status, startedAt, createdAt: startedAt,
            startLat: start.lat, startLng: start.lng, originBranch: { id: 'demo-origin', name: 'Hospital Avante' },
            destination: { id: 'demo-destination', name: 'Sucursal Santa Tecla', type: 'DESTINATION', ...destination },
            vehicle: { id: 'demo-vehicle', plate: 'P-204310', brand: 'Toyota', model: 'Hiace' },
            correctionFlag: false, forcedCloseFlag: false, telegramDeliveryStatus: 'PENDING',
          }} position={position} firstPosition={null}
            gps={signal === 'denied' ? 'denied' : signal === 'missing' ? 'locating' : 'live'}
            sync={signal === 'offline' ? 'error' : 'saved'} elapsed={elapsed} onRetry={() => setSignal('live')} />
          <div className="demo-existing-actions"><span>Ver mapa del recorrido</span><div><span>Parada</span><span>Incidencia</span></div><span>Finalizar viaje</span></div>
        </div>
      </div>
      <aside className="demo-controls">
        <h2>Prueba el seguimiento</h2><p>Estos controles simulan lo que recibiría el conductor durante un viaje.</p>
        <label>Avance simulado <strong>{advance}%</strong><input type="range" min="0" max="99" value={advance} onChange={(e) => { setPlaying(false); setAdvance(Number(e.target.value)); }} /></label>
        <button onClick={() => { if (advance === 99) setAdvance(0); setPlaying((v) => !v); }}>{playing ? 'Pausar simulación' : 'Simular movimiento'}</button>
        <label>Estado del viaje<select value={status} onChange={(e) => setStatus(e.target.value as TripStatus)}><option value="IN_TRANSIT">En ruta</option><option value="IN_STOP">En parada</option><option value="IN_INCIDENT">Incidencia activa</option></select></label>
        <label>Ubicación y conexión<select value={signal} onChange={(e) => setSignal(e.target.value)}><option value="live">GPS activo</option><option value="stale">Última ubicación hace 2 minutos</option><option value="denied">Permiso de ubicación denegado</option><option value="missing">Esperando la primera ubicación</option><option value="offline">GPS activo, envío sin conexión</option></select></label>
        <p className="demo-note">La tarjeta usa el mismo componente que la aplicación. Esta vista no accede a tu GPS, no guarda viajes ni se conecta al servidor.</p>
      </aside>
    </div>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Demo />);
