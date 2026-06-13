import { useState, useEffect, useCallback, lazy, Suspense, type ReactNode } from 'react';
import { useAuth } from '../../store/AuthContext';
import api, { getErrorMessage } from '../../services/api';
import { Trip, Branch, Vehicle, Location, IncidentType } from '../../types';
import { Button, Select, Alert, Card, Modal, Textarea, Input } from '../../components/ui';
import { parseVehicleQr } from '../../components/vehicleQr';

// El escáner usa html5-qrcode (pesado): se carga solo al abrirlo.
const QrScanner = lazy(() =>
  import('../../components/QrScanner').then((m) => ({ default: m.QrScanner }))
);
// Mapa del recorrido (Leaflet): se carga solo si el conductor lo abre.
const TripMap = lazy(() => import('../../components/TripMap'));
import {
  Play, Square, MapPin, AlertTriangle, Navigation,
  Truck, Building2, CheckCircle2, History, Timer, ScanLine,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type Phase = 'setup' | 'active';

const LAST_TRIP_KEY = 'fleetops_last_trip_setup';

// Hero visual por estado del viaje
const statusHero: Record<string, { label: string; sub: string; classes: string; dot: string }> = {
  IN_TRANSIT: {
    label: 'En tránsito',
    sub: 'Conduce con precaución',
    classes: 'from-blue-600/30 to-blue-900/10 border-blue-700/50',
    dot: 'bg-blue-400',
  },
  IN_STOP: {
    label: 'En parada',
    sub: 'Continúa cuando estés listo',
    classes: 'from-amber-600/30 to-amber-900/10 border-amber-700/50',
    dot: 'bg-amber-400',
  },
  IN_INCIDENT: {
    label: 'Incidencia activa',
    sub: 'Resuelve y continúa la ruta',
    classes: 'from-red-600/30 to-red-900/10 border-red-700/50',
    dot: 'bg-red-400',
  },
};

// Distancia great-circle en km (para detectar la sucursal más cercana al GPS).
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180);
  return 2 * R * Math.asin(Math.sqrt(h));
}

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
  const [actionLoading, setActionLoading] = useState('');
  const [justFinished, setJustFinished] = useState(false);

  // Catalogs
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);

  // Setup form
  const [originBranchId, setOriginBranchId] = useState('');
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

  // Autodetección de sucursal por GPS: al preparar el viaje, se selecciona
  // sola la sucursal más cercana a la posición del conductor (evita errores
  // y manipulación manual). Lo mismo para la sucursal de llegada al finalizar.
  const [autoBranch, setAutoBranch] = useState<{ name: string; km: number } | null>(null);
  const [autoFinishBranch, setAutoFinishBranch] = useState<{ name: string; km: number } | null>(null);
  const [originManual, setOriginManual] = useState(false);
  const branchHasCoords = branches.some((b) => b.lat != null && b.lng != null);

  const nearestBranch = useCallback((lat: number, lng: number) => {
    let best: Branch | null = null;
    let bestKm = Infinity;
    for (const b of branches) {
      if (b.lat == null || b.lng == null) continue;
      const d = distanceKm(lat, lng, b.lat, b.lng);
      if (d < bestKm) { bestKm = d; best = b; }
    }
    return best ? { branch: best, km: Math.round(bestKm * 10) / 10 } : null;
  }, [branches]);

  useEffect(() => {
    if (phase !== 'setup' || branches.length === 0 || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const hit = nearestBranch(pos.coords.latitude, pos.coords.longitude);
        if (hit) {
          setOriginBranchId(hit.branch.id);
          setAutoBranch({ name: hit.branch.name, km: hit.km });
        }
      },
      () => { /* sin GPS: queda la selección manual */ },
      { timeout: 8000, maximumAge: 60000 }
    );
  }, [phase, branches, nearestBranch]);

  useEffect(() => {
    if (!finishModal || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const hit = nearestBranch(pos.coords.latitude, pos.coords.longitude);
        if (hit) {
          setFinishBranchId(hit.branch.id);
          setAutoFinishBranch({ name: hit.branch.name, km: hit.km });
        }
      },
      () => {},
      { timeout: 8000, maximumAge: 30000 }
    );
  }, [finishModal, nearestBranch]);

  // Mapa del recorrido del conductor (cerrado por defecto para ahorrar datos).
  const [showMap, setShowMap] = useState(false);
  const [track, setTrack] = useState<{ lat: number; lng: number }[]>([]);
  useEffect(() => {
    if (!showMap || phase !== 'active' || !activeTrip) return;
    const load = () =>
      api.get(`/trips/${activeTrip.id}/track`)
        .then((r) => setTrack(r.data.data || []))
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [showMap, phase, activeTrip?.id]);

  // Rastreo en vivo: mientras el viaje está activo, reporta la posición cada
  // 60s para que el administrador pueda ver al conductor en el mapa.
  useEffect(() => {
    if (phase !== 'active' || !activeTrip) return;
    let stopped = false;
    const sendPing = () => {
      if (!navigator.geolocation || stopped) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (stopped) return;
          api.post(`/trips/${activeTrip.id}/ping`, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }).catch(() => { /* sin red: se reintenta en el siguiente ciclo */ });
        },
        () => { /* sin permiso de ubicación: no bloquear el viaje */ },
        { timeout: 8000, maximumAge: 30000 }
      );
    };
    sendPing();
    const id = setInterval(sendPing, 60_000);
    return () => { stopped = true; clearInterval(id); };
  }, [phase, activeTrip?.id]);

  const loadActiveTrip = useCallback(async () => {
    try {
      const res = await api.get('/trips/my/active');
      if (res.data.data) {
        setActiveTrip(res.data.data);
        setPhase('active');
      } else {
        setPhase('setup');
      }
    } catch {
      setPhase('setup');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalogs = useCallback(async () => {
    try {
      const [brRes, vRes, lRes, iRes] = await Promise.all([
        api.get('/catalogs/branches'),
        api.get('/catalogs/vehicles?available=true'),
        api.get('/catalogs/locations?type=DESTINATION'),
        api.get('/catalogs/incident-types'),
      ]);

      const br = brRes.data.data || [];
      const vs = vRes.data.data || [];
      const ls = lRes.data.data || [];
      setBranches(br);
      setVehicles(vs);
      setLocations(ls);
      setIncidentTypes(iRes.data.data || []);

      if (user?.branch?.id) setOriginBranchId(user.branch.id);
      else if (br.length === 1) setOriginBranchId(br[0].id);
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
      if (last.originBranchId && branches.some((b) => b.id === last.originBranchId)) {
        setOriginBranchId(last.originBranchId);
      }
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
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({}),
        { timeout: 5000 }
      );
    });

  const handleStartTrip = async () => {
    if (!vehicleId || !originBranchId || !destinationId) {
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
        originBranchId,
        destinationId,
        comment: finalComment,
        deviceTimestamp: new Date().toISOString(),
        ...geo,
      });
      localStorage.setItem(LAST_TRIP_KEY, JSON.stringify({ originBranchId, vehicleId, destinationId }));
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
        ...geo,
      });
      setActiveTrip(null);
      setPhase('setup');
      setFinishModal(false);
      setVehicleId('');
      setScannedVehicle(null);
      setVerifyMethod(null);
      setOriginManual(false);
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
              {/* Sucursal de origen: detectada por GPS, no se elige a mano */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Sucursal de origen</label>
                {autoBranch && !originManual ? (
                  <div className="flex items-center gap-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl px-4 py-3">
                    <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white font-medium">{autoBranch.name}</p>
                      <p className="text-xs text-emerald-300/80">Detectada por tu ubicación · a {autoBranch.km} km</p>
                    </div>
                    <button onClick={() => setOriginManual(true)}
                      className="text-xs text-slate-300 hover:text-white bg-slate-700/60 rounded-lg px-2.5 py-1.5">
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <>
                    <Select
                      value={originBranchId}
                      onChange={(e) => { setOriginBranchId(e.target.value); setAutoBranch(null); }}
                      placeholder="Seleccionar sucursal..."
                      options={branches.map((b) => ({ value: b.id, label: b.name }))}
                    />
                    <p className="text-xs text-slate-500 mt-1.5">
                      {branchHasCoords
                        ? 'Activa la ubicación para detectar tu sucursal automáticamente.'
                        : 'Configura las coordenadas de las sucursales (admin) para detección automática.'}
                    </p>
                  </>
                )}
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
                placeholder="Seleccionar destino..."
                options={locations.map((l) => ({ value: l.id, label: l.name }))}
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
            disabled={!vehicleId || !originBranchId || !destinationId}
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
          {/* Hero de estado con cronómetro en vivo */}
          <div className={`rounded-3xl border bg-gradient-to-br p-5 ${(statusHero[activeTrip.status] || statusHero.IN_TRANSIT).classes}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${(statusHero[activeTrip.status] || statusHero.IN_TRANSIT).dot}`} />
                <span className="text-white font-semibold">
                  {(statusHero[activeTrip.status] || statusHero.IN_TRANSIT).label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-white font-mono text-2xl font-bold tabular-nums">
                <Timer className="w-5 h-5 opacity-60" />
                {elapsed}
              </div>
            </div>
            <p className="text-slate-300/80 text-xs mt-1.5">
              {(statusHero[activeTrip.status] || statusHero.IN_TRANSIT).sub} · inicio{' '}
              {format(new Date(activeTrip.startedAt), 'HH:mm', { locale: es })}
            </p>

            {/* Ruta resumida */}
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1.5 text-slate-200 min-w-0">
                <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">{activeTrip.originBranch?.name || '—'}</span>
              </span>
              <span className="text-slate-500 shrink-0">→</span>
              <span className="flex items-center gap-1.5 text-white font-medium min-w-0">
                <MapPin className="w-4 h-4 text-slate-300 shrink-0" />
                <span className="truncate">{activeTrip.destination?.name || '—'}</span>
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
              <Truck className="w-3.5 h-3.5" />
              {activeTrip.vehicle
                ? `${activeTrip.vehicle.plate} · ${activeTrip.vehicle.brand} ${activeTrip.vehicle.model}`
                : '—'}
              {activeTrip.comment && <span className="truncate"> · {activeTrip.comment}</span>}
            </div>
          </div>

          {/* Mi recorrido (trazabilidad visual del conductor) */}
          <div>
            <button
              onClick={() => setShowMap((v) => !v)}
              className="w-full flex items-center justify-center gap-2 text-sm text-slate-300 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 hover:border-slate-500 transition-colors"
            >
              <MapPin className="w-4 h-4 text-blue-400" />
              {showMap ? 'Ocultar mi recorrido' : 'Ver mi recorrido'}
            </button>
            {showMap && (
              <div className="mt-3">
                <Suspense fallback={<div className="w-full h-72 rounded-2xl bg-slate-800 animate-pulse" />}>
                  <TripMap
                    path={track}
                    points={[
                      activeTrip.startLat != null && activeTrip.startLng != null
                        ? { lat: activeTrip.startLat, lng: activeTrip.startLng, label: '🚀 Inicio', kind: 'start' as const }
                        : null,
                      activeTrip.lastLat != null && activeTrip.lastLng != null
                        ? { lat: activeTrip.lastLat, lng: activeTrip.lastLng, label: '🚛 Tú estás aquí', kind: 'last' as const }
                        : null,
                      ...(track.length > 0 && activeTrip.lastLat == null
                        ? [{ lat: track[track.length - 1].lat, lng: track[track.length - 1].lng, label: '🚛 Tú estás aquí', kind: 'last' as const }]
                        : []),
                    ].filter((p): p is NonNullable<typeof p> => p !== null)}
                  />
                </Suspense>
                <p className="text-xs text-slate-500 text-center mt-2">
                  La línea azul es tu trayecto reportado · se actualiza cada minuto
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

          <Select
            label="Sucursal de llegada (opcional)"
            value={finishBranchId}
            onChange={(e) => { setFinishBranchId(e.target.value); setAutoFinishBranch(null); }}
            placeholder="Seleccionar sucursal de llegada..."
            options={branches.map((b) => ({ value: b.id, label: b.name }))}
            hint={autoFinishBranch ? `📍 ${autoFinishBranch.name} detectada por tu ubicación (a ${autoFinishBranch.km} km)` : undefined}
          />

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
