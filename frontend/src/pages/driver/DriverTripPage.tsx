import { useState, useEffect, useCallback, useMemo, lazy, Suspense, type ReactNode } from 'react';
import { useAuth } from '../../store/AuthContext';
import api, { getErrorMessage } from '../../services/api';
import { Trip, Branch, Vehicle, Location, IncidentType } from '../../types';
import { Button, Select, Alert, Card, Modal, Textarea, Input } from '../../components/ui';
import { parseVehicleQr } from '../../components/vehicleQr';
import { DriverTripProgress } from '../../components/DriverTripProgress';
import { useDriverTracking } from '../../hooks/useDriverTracking';
import { coordinates, distanceMeters, POSITION_MAX_AGE_MS } from '../../services/tripProgress';
import type { TripMapPoint } from '../../components/mapTypes';

// El escáner usa html5-qrcode (pesado): se carga solo al abrirlo.
const QrScanner = lazy(() =>
  import('../../components/QrScanner').then((m) => ({ default: m.QrScanner }))
);
// Mapa del recorrido (Google Maps o OSM): se carga solo si el conductor lo abre.
const LiveMap = lazy(() => import('../../components/LiveMap'));
import {
  Play, Square, MapPin, AlertTriangle, Navigation,
  Truck, CheckCircle2, History, ScanLine,
} from 'lucide-react';

type Phase = 'setup' | 'active';

const LAST_TRIP_KEY = 'fleetops_last_trip_setup';

function useElapsed(startedAt?: string) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return '';
  const sec = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export default function DriverTripPage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>('setup');
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [justFinished, setJustFinished] = useState(false);

  // Catalogs
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);

  // Setup form (sin sucursal de origen: el origen es la ubicación GPS al iniciar)
  const [vehicleId, setVehicleId] = useState('');
  const [scannedVehicle, setScannedVehicle] = useState<Vehicle | null>(null);
  const [verifyMethod, setVerifyMethod] = useState<'scan' | 'manual' | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  // Respaldo manual (cuando la cámara falla): teclear placa + confirmar
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPlate, setManualPlate] = useState('');
  const [manualMatch, setManualMatch] = useState<Vehicle | null>(null);
  const [destinationId, setDestinationId] = useState('');
  const [tripComment, setTripComment] = useState('');
  const [hasLastSetup, setHasLastSetup] = useState(false);

  // Modals
  const [stopModal, setStopModal] = useState(false);
  const [incidentModal, setIncidentModal] = useState(false);
  const [finishModal, setFinishModal] = useState(false);
  const [stopComment, setStopComment] = useState('');
  const [incidentTypeId, setIncidentTypeId] = useState('');
  const [incidentComment, setIncidentComment] = useState('');
  const [finishBranchId, setFinishBranchId] = useState('');
  const [finishComment, setFinishComment] = useState('');

  const elapsed = useElapsed(phase === 'active' ? activeTrip?.startedAt : undefined);
  const tracking = useDriverTracking(phase === 'active' ? activeTrip?.id || null : null);

  // Mapa del recorrido del conductor (cerrado por defecto para ahorrar datos).
  const [showMap, setShowMap] = useState(false);
  const [track, setTrack] = useState<{ lat: number; lng: number }[]>([]);
  const [trackError, setTrackError] = useState('');
  useEffect(() => {
    setTrack([]);
    setTrackError('');
    setShowMap(false);
  }, [activeTrip?.id]);
  useEffect(() => {
    if (!showMap || phase !== 'active' || !activeTrip) return;
    const controller = new AbortController();
    const load = () => api.get(`/trips/${activeTrip.id}/track`, { signal: controller.signal })
      .then((r) => {
        if (controller.signal.aborted) return;
        setTrack(r.data.data.path || []);
        setTrackError('');
      }).catch(() => {
        if (!controller.signal.aborted) setTrackError('No se pudo actualizar el recorrido guardado.');
      });
    load();
    const id = setInterval(load, 60_000);
    return () => { controller.abort(); clearInterval(id); };
  }, [showMap, phase, activeTrip?.id]);

  const hasFreshFix = tracking.position != null && tracking.gps === 'live' &&
    Date.now() - tracking.position.capturedAt <= POSITION_MAX_AGE_MS;
  const mapPoints = useMemo(() => {
    const start = coordinates(activeTrip?.startLat, activeTrip?.startLng) || tracking.firstPosition;
    const last = tracking.position || coordinates(activeTrip?.lastLat, activeTrip?.lastLng) || track[track.length - 1];
    const points: TripMapPoint[] = [];
    if (start) points.push({ ...start, kind: 'start', label: 'Inicio del viaje' });
    if (last) points.push({ ...last, kind: 'last', label: hasFreshFix ? 'Tu ubicación actual' : 'Última ubicación conocida' });
    return points;
  }, [activeTrip?.startLat, activeTrip?.startLng, activeTrip?.lastLat, activeTrip?.lastLng, tracking.firstPosition, tracking.position, hasFreshFix, track]);
  const mapPath = useMemo(() => {
    const last = tracking.position;
    if (!last || !track.length || distanceMeters(track[track.length - 1], last) < 3) return track;
    return [...track, { lat: last.lat, lng: last.lng }];
  }, [track, tracking.position]);

  const loadActiveTrip = useCallback(async () => {
    setLoadError('');
    try {
      const res = await api.get('/trips/my/active');
      if (res.data.data) {
        setActiveTrip(res.data.data);
        setPhase('active');
      } else {
        setActiveTrip(null);
        setPhase('setup');
      }
    } catch {
      setLoadError('No pudimos comprobar si tienes un viaje activo. Reintenta para continuar.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalogs = useCallback(async () => {
    try {
      const [brRes, vRes, lRes, iRes] = await Promise.all([
        api.get('/catalogs/branches'),
        api.get('/catalogs/vehicles?available=true'),
        api.get('/catalogs/locations'),
        api.get('/catalogs/incident-types'),
      ]);

      const br = brRes.data.data || [];
      const vs = vRes.data.data || [];
      const ls = lRes.data.data || [];
      setBranches(br);
      setVehicles(vs);
      setLocations(ls);
      setIncidentTypes(iRes.data.data || []);

      // Con una sola opción disponible, pre-selecciona para ahorrar toques
      if (vs.length === 1) setVehicleId(vs[0].id);
      if (ls.length === 1) setDestinationId(ls[0].id);

      setHasLastSetup(Boolean(localStorage.getItem(LAST_TRIP_KEY)));
    } catch (err) {
      console.error('Error loading catalogs:', err);
    }
  }, [user]);

  useEffect(() => {
    loadActiveTrip();
    loadCatalogs();
  }, [loadActiveTrip, loadCatalogs]);

  const applyLastSetup = () => {
    try {
      const last = JSON.parse(localStorage.getItem(LAST_TRIP_KEY) || '{}');
      if (last.destinationId && locations.some((l) => l.id === last.destinationId)) {
        setDestinationId(last.destinationId);
      }
      // El vehículo NO se rellena del historial: debe escanearse cada vez para
      // garantizar que la unidad seleccionada es la que el conductor tiene enfrente.
    } catch { /* setup previo corrupto: ignorar */ }
  };

  // Resultado del escaneo del QR del vehículo.
  const handleVehicleScan = (text: string) => {
    setScanOpen(false);
    const parsed = parseVehicleQr(text);
    if (!parsed) {
      setError('Código QR no válido. Escanea el código del vehículo.');
      return;
    }
    const vehicle = vehicles.find((v) => v.id === parsed.id);
    if (!vehicle) {
      setError(`El vehículo ${parsed.plate} no está disponible o no existe.`);
      return;
    }
    setError('');
    setVehicleId(vehicle.id);
    setScannedVehicle(vehicle);
    setVerifyMethod('scan');
  };

  // Placas normalizadas para comparar sin importar mayúsculas/guiones/espacios.
  const normalizePlate = (p: string) => p.toUpperCase().replace(/[\s-]/g, '');

  const handleManualLookup = (value: string) => {
    setManualPlate(value);
    const target = normalizePlate(value);
    if (target.length < 3) {
      setManualMatch(null);
      return;
    }
    setManualMatch(vehicles.find((v) => normalizePlate(v.plate) === target) || null);
  };

  const confirmManualVehicle = () => {
    if (!manualMatch) return;
    setVehicleId(manualMatch.id);
    setScannedVehicle(manualMatch);
    setVerifyMethod('manual');
    setManualOpen(false);
    setManualPlate('');
    setManualMatch(null);
    setError('');
  };

  const getGeoLocation = (): Promise<{ lat?: number; lng?: number }> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({});
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const point = coordinates(pos.coords.latitude, pos.coords.longitude);
          resolve(point && Number.isFinite(pos.coords.accuracy) && pos.coords.accuracy <= 200 ? point : {});
        },
        () => resolve({}),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 }
      );
    });

  const handleStartTrip = async () => {
    if (!vehicleId || !destinationId) {
      setError('Completa todos los campos requeridos');
      return;
    }
    setError('');
    setActionLoading('start');
    try {
      const geo = await getGeoLocation();
      // Trazabilidad: dejar constancia si el vehículo se ingresó a mano
      // (respaldo de cámara) en lugar de escanearse.
      const manualNote = verifyMethod === 'manual' ? '[Vehículo ingresado manualmente — cámara no disponible]' : '';
      const finalComment = [tripComment, manualNote].filter(Boolean).join(' ') || undefined;

      const res = await api.post('/trips/start', {
        vehicleId,
        destinationId,
        comment: finalComment,
        deviceTimestamp: new Date().toISOString(),
        startLat: geo.lat,
        startLng: geo.lng,
      });
      localStorage.setItem(LAST_TRIP_KEY, JSON.stringify({ destinationId }));
      setActiveTrip(res.data.data);
      setJustFinished(false);
      setPhase('active');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const handleStop = async () => {
    if (!activeTrip) return;
    setActionLoading('stop');
    try {
      const geo = await getGeoLocation();
      const res = await api.post(`/trips/${activeTrip.id}/stop`, {
        comment: stopComment || undefined,
        deviceTimestamp: new Date().toISOString(),
        ...geo,
      });
      setActiveTrip((prev) => (prev ? { ...prev, status: res.data.data.status } : null));
      setStopModal(false);
      setStopComment('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const handleResume = async () => {
    if (!activeTrip) return;
    setActionLoading('resume');
    try {
      await api.post(`/trips/${activeTrip.id}/resume`, {
        deviceTimestamp: new Date().toISOString(),
      });
      setActiveTrip((prev) => (prev ? { ...prev, status: 'IN_TRANSIT' } : null));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const handleIncident = async () => {
    if (!activeTrip || !incidentComment.trim()) return;
    setActionLoading('incident');
    try {
      const geo = await getGeoLocation();
      await api.post(`/trips/${activeTrip.id}/incident`, {
        incidentTypeId: incidentTypeId || undefined,
        comment: incidentComment,
        deviceTimestamp: new Date().toISOString(),
        ...geo,
      });
      setActiveTrip((prev) => (prev ? { ...prev, status: 'IN_INCIDENT' } : null));
      setIncidentModal(false);
      setIncidentComment('');
      setIncidentTypeId('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const handleFinish = async () => {
    if (!activeTrip) return;
    setActionLoading('finish');
    try {
      const geo = await getGeoLocation();
      await api.post(`/trips/${activeTrip.id}/finish`, {
        closureBranchId: finishBranchId || undefined,
        comment: finishComment || undefined,
        deviceTimestamp: new Date().toISOString(),
        endLat: geo.lat,
        endLng: geo.lng,
      });
      setActiveTrip(null);
      setPhase('setup');
      setFinishModal(false);
      setVehicleId('');
      setScannedVehicle(null);
      setVerifyMethod(null);
      setDestinationId('');
      setTripComment('');
      setFinishBranchId('');
      setFinishComment('');
      setJustFinished(true);
      loadCatalogs();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-slate-400 text-sm">Verificando viaje activo...</p>
      </div>
    );
  }

  if (loadError && !activeTrip) return (
    <div className="p-4 space-y-4">
      <Alert type="error" message={loadError} />
      <Button fullWidth onClick={() => { setLoading(true); loadActiveTrip(); }}>Reintentar</Button>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {scanOpen && (
        <Suspense fallback={null}>
          <QrScanner
            open={scanOpen}
            onClose={() => setScanOpen(false)}
            onScan={handleVehicleScan}
            title="Escanear vehículo"
            hint="Apunta la cámara al código QR del vehículo"
          />
        </Suspense>
      )}

      {/* Respaldo manual: teclear placa + confirmación del vehículo */}
      <Modal
        open={manualOpen}
        onClose={() => { setManualOpen(false); setManualPlate(''); setManualMatch(null); }}
        title="Ingresar placa manualmente"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => { setManualOpen(false); setManualPlate(''); setManualMatch(null); }}>
              Cancelar
            </Button>
            <Button fullWidth variant="warning" onClick={confirmManualVehicle} disabled={!manualMatch}>
              Confirmar vehículo
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Alert type="warning" message="Usa esta opción solo si la cámara no funciona. Quedará registrado que el vehículo se ingresó manualmente." />
          <Input
            label="Placa del vehículo"
            value={manualPlate}
            onChange={(e) => handleManualLookup(e.target.value)}
            placeholder="Ej. ABC-123"
            autoFocus
            autoCapitalize="characters"
          />
          {manualPlate.trim().length >= 3 && (
            manualMatch ? (
              <div className="flex items-center gap-3 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3">
                <Truck className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <p className="text-sm text-white font-medium">
                    {manualMatch.plate} — {manualMatch.brand} {manualMatch.model}
                  </p>
                  <p className="text-xs text-slate-400">
                    {manualMatch.color ? `${manualMatch.color} · ` : ''}{manualMatch.fuelType || ''}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">¿Es este el vehículo que tienes enfrente?</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-red-400">No hay ningún vehículo disponible con esa placa.</p>
            )
          )}
        </div>
      </Modal>

      {error && <Alert type="error" message={error} />}

      {phase === 'setup' && (
        <>
          {justFinished && (
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-emerald-700/50 bg-emerald-900/30">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-sm text-emerald-300">Viaje finalizado correctamente. ¡Buen trabajo!</p>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Nuevo viaje</h2>
              <p className="text-slate-400 text-sm mt-1">Hola, {user?.fullName?.split(' ')[0]} 👋</p>
            </div>
            {hasLastSetup && (
              <button
                onClick={applyLastSetup}
                className="flex items-center gap-1.5 text-xs font-medium text-blue-400 bg-blue-950/50 border border-blue-800/50 rounded-xl px-3 py-2 hover:bg-blue-900/50 transition-colors"
              >
                <History className="w-3.5 h-3.5" /> Repetir último
              </button>
            )}
          </div>

          <Card>
            <div className="space-y-4">
              {/* El origen se captura del GPS al iniciar; no se selecciona. */}
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2.5">
                <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                El punto de origen se registra automáticamente con tu ubicación al iniciar.
              </div>

              {/* Vehículo por escaneo de QR (evita elegir la unidad equivocada) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Vehículo</label>
                {scannedVehicle ? (
                  <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                    verifyMethod === 'scan'
                      ? 'bg-emerald-950/40 border-emerald-800/50'
                      : 'bg-amber-950/40 border-amber-800/50'
                  }`}>
                    <CheckCircle2 className={`w-5 h-5 shrink-0 ${verifyMethod === 'scan' ? 'text-emerald-400' : 'text-amber-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white font-medium">
                        {scannedVehicle.plate} — {scannedVehicle.brand} {scannedVehicle.model}
                      </p>
                      <p className={`text-xs ${verifyMethod === 'scan' ? 'text-emerald-300/80' : 'text-amber-300/80'}`}>
                        {verifyMethod === 'scan' ? 'Vehículo verificado por escaneo' : 'Ingresado manualmente — verifica que la placa coincida'}
                      </p>
                    </div>
                    <button
                      onClick={() => { setScannedVehicle(null); setVehicleId(''); setVerifyMethod(null); setScanOpen(true); }}
                      className="text-xs text-slate-300 hover:text-white bg-slate-700/60 rounded-lg px-2.5 py-1.5"
                    >
                      Reescanear
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => { setError(''); setScanOpen(true); }}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-3.5 font-medium transition-colors active:scale-[0.98]"
                    >
                      <ScanLine className="w-5 h-5" /> Escanear vehículo
                    </button>
                    <button
                      onClick={() => { setError(''); setManualOpen(true); }}
                      className="w-full text-center text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 mt-2 py-1"
                    >
                      ¿La cámara no funciona? Ingresar placa manualmente
                    </button>
                  </>
                )}
                <p className="text-xs text-slate-500 mt-1.5">
                  Escanea el código QR pegado en el vehículo para seleccionarlo.
                </p>
              </div>

              <Select
                label="Destino"
                value={destinationId}
                onChange={(e) => setDestinationId(e.target.value)}
                placeholder="Seleccionar ubicación de destino..."
                options={locations.map((l) => ({
                  value: l.id,
                  label: l.branch?.name ? `${l.name} (${l.branch.name})` : l.name,
                }))}
                hint={locations.length === 0 ? 'No hay ubicaciones. Configúralas en el panel admin.' : undefined}
              />

              <Textarea
                label="Comentario (opcional)"
                value={tripComment}
                onChange={(e) => setTripComment(e.target.value)}
                placeholder="Motivo del viaje, instrucciones especiales..."
                rows={2}
              />
            </div>
          </Card>

          <Button
            fullWidth
            size="lg"
            onClick={handleStartTrip}
            loading={actionLoading === 'start'}
            disabled={!vehicleId || !destinationId}
            icon={<Play className="w-5 h-5" />}
          >
            Iniciar viaje
          </Button>

          <p className="text-xs text-slate-600 text-center">
            La geolocalización se capturará automáticamente si tienes permisos habilitados
          </p>
        </>
      )}

      {phase === 'active' && activeTrip && (
        <>
          <DriverTripProgress
            trip={activeTrip}
            destination={locations.find((location) => location.id === activeTrip.destinationId)}
            position={tracking.position}
            firstPosition={tracking.firstPosition}
            gps={tracking.gps}
            sync={tracking.sync}
            elapsed={elapsed}
            onRetry={tracking.retry}
          />

          {/* Mi recorrido (trazabilidad visual del conductor) */}
          <div>
            <button
              onClick={() => setShowMap((v) => !v)}
              className="w-full flex items-center justify-center gap-2 text-sm text-slate-300 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 hover:border-slate-500 transition-colors"
            >
              <MapPin className="w-4 h-4 text-blue-400" />
              {showMap ? 'Ocultar mapa del recorrido' : 'Ver mapa del recorrido'}
            </button>
            {trackError && showMap && <div className="mt-3"><Alert type="warning" message={trackError} /></div>}
            {showMap && (
              <div className="mt-3">
                <Suspense fallback={<div className="w-full h-72 rounded-2xl bg-slate-800 animate-pulse" />}>
                  <LiveMap path={mapPath} points={mapPoints} />
                </Suspense>
                <p className="text-xs text-slate-500 text-center mt-2">
                  Tu ubicación cambia con el GPS. El recorrido guardado se consulta cada minuto.
                </p>
              </div>
            )}
          </div>

          {/* Acciones grandes según estado */}
          {activeTrip.status === 'IN_TRANSIT' && (
            <div className="grid grid-cols-2 gap-3">
              <BigAction
                icon={<Square className="w-6 h-6" />}
                label="Parada"
                sub="Registrar parada"
                tone="amber"
                onClick={() => setStopModal(true)}
              />
              <BigAction
                icon={<AlertTriangle className="w-6 h-6" />}
                label="Incidencia"
                sub="Reportar problema"
                tone="red"
                onClick={() => setIncidentModal(true)}
              />
            </div>
          )}

          {(activeTrip.status === 'IN_STOP' || activeTrip.status === 'IN_INCIDENT') && (
            <div className="grid grid-cols-2 gap-3">
              <BigAction
                icon={<Navigation className="w-6 h-6" />}
                label="Continuar"
                sub="Reanudar ruta"
                tone="blue"
                loading={actionLoading === 'resume'}
                onClick={handleResume}
              />
              <BigAction
                icon={<AlertTriangle className="w-6 h-6" />}
                label="Incidencia"
                sub="Reportar problema"
                tone="red"
                disabled={activeTrip.status === 'IN_INCIDENT'}
                onClick={() => setIncidentModal(true)}
              />
            </div>
          )}

          <Button
            fullWidth
            variant="success"
            size="lg"
            icon={<CheckCircle2 className="w-5 h-5" />}
            onClick={() => setFinishModal(true)}
          >
            Finalizar viaje
          </Button>
        </>
      )}

      {/* Modal: parada */}
      <Modal
        open={stopModal}
        onClose={() => setStopModal(false)}
        title="Registrar parada"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setStopModal(false)}>
              Cancelar
            </Button>
            <Button fullWidth variant="warning" onClick={handleStop} loading={actionLoading === 'stop'}>
              Confirmar parada
            </Button>
          </div>
        }
      >
        <Textarea
          label="Comentario (opcional)"
          value={stopComment}
          onChange={(e) => setStopComment(e.target.value)}
          placeholder="¿Por qué haces esta parada? (puedes dejarlo vacío)"
          rows={3}
        />
      </Modal>

      {/* Modal: incidencia — tipos como chips de un toque */}
      <Modal
        open={incidentModal}
        onClose={() => setIncidentModal(false)}
        title="Reportar incidencia"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setIncidentModal(false)}>
              Cancelar
            </Button>
            <Button
              fullWidth
              variant="danger"
              onClick={handleIncident}
              loading={actionLoading === 'incident'}
              disabled={!incidentComment.trim()}
            >
              Reportar
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="block text-sm font-medium text-slate-300 mb-2">Tipo de incidencia</p>
            <div className="flex flex-wrap gap-2">
              {incidentTypes.map((t) => {
                const selected = incidentTypeId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setIncidentTypeId(selected ? '' : t.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                      selected
                        ? severityChipSelected(t.severity)
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          <Textarea
            label="Descripción *"
            value={incidentComment}
            onChange={(e) => setIncidentComment(e.target.value)}
            placeholder="Describe brevemente lo ocurrido..."
            rows={3}
          />
        </div>
      </Modal>

      {/* Modal: finalizar */}
      <Modal
        open={finishModal}
        onClose={() => setFinishModal(false)}
        title="Finalizar viaje"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setFinishModal(false)}>
              Cancelar
            </Button>
            <Button fullWidth variant="success" onClick={handleFinish} loading={actionLoading === 'finish'}>
              Confirmar finalización
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Alert type="info" message="Al finalizar el viaje se enviará notificación automática." />

          {/* El punto de llegada es el GPS: no se elige sucursal a mano. */}
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2.5">
            <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
            El punto de llegada se registra automáticamente con tu ubicación actual.
          </div>

          <Textarea
            label="Comentario final (opcional)"
            value={finishComment}
            onChange={(e) => setFinishComment(e.target.value)}
            placeholder="Observaciones del viaje..."
            rows={3}
          />
        </div>
      </Modal>
    </div>
  );
}

const bigActionTones: Record<string, string> = {
  amber: 'border-amber-700/60 bg-amber-950/40 text-amber-300 active:bg-amber-900/50',
  red: 'border-red-700/60 bg-red-950/40 text-red-300 active:bg-red-900/50',
  blue: 'border-blue-700/60 bg-blue-950/40 text-blue-300 active:bg-blue-900/50',
};

function BigAction({ icon, label, sub, tone, onClick, loading, disabled }: {
  icon: ReactNode;
  label: string;
  sub: string;
  tone: keyof typeof bigActionTones;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`flex flex-col items-center gap-2 p-5 rounded-2xl border transition-all active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed ${bigActionTones[tone]}`}
    >
      {loading ? (
        <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-[11px] opacity-70 -mt-1.5">{sub}</span>
    </button>
  );
}

function severityChipSelected(severity: string): string {
  const map: Record<string, string> = {
    LOW: 'bg-slate-600 border-slate-500 text-white',
    MEDIUM: 'bg-amber-600 border-amber-500 text-white',
    HIGH: 'bg-orange-600 border-orange-500 text-white',
    CRITICAL: 'bg-red-600 border-red-500 text-white',
  };
  return map[severity] || map.MEDIUM;
}
