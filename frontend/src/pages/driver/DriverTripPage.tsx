import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../store/AuthContext';
import api, { getErrorMessage } from '../../services/api';
import { Trip, Branch, Vehicle, Location, IncidentType } from '../../types';
import {
  Button, Select, Alert, Card, Modal, Textarea, StatusBadge
} from '../../components/ui';
import {
  Play, Square, MapPin, AlertTriangle, Navigation,
  Clock, Truck, Building2, Zap, ChevronRight
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

type Phase = 'setup' | 'active';

export default function DriverTripPage() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>('setup');
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  // Catalogs
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);

  // Setup form
  const [originBranchId, setOriginBranchId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [tripComment, setTripComment] = useState('');

  // Modals
  const [stopModal, setStopModal] = useState(false);
  const [incidentModal, setIncidentModal] = useState(false);
  const [finishModal, setFinishModal] = useState(false);
  const [stopComment, setStopComment] = useState('');
  const [incidentTypeId, setIncidentTypeId] = useState('');
  const [incidentComment, setIncidentComment] = useState('');
  const [finishBranchId, setFinishBranchId] = useState('');
  const [finishComment, setFinishComment] = useState('');

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
      setBranches(brRes.data.data || []);
      setVehicles(vRes.data.data || []);
      setLocations(lRes.data.data || []);
      setIncidentTypes(iRes.data.data || []);
      // Pre-fill origin branch if user has one
      if (user?.branch?.id) setOriginBranchId(user.branch.id);
    } catch (err) {
      console.error('Error loading catalogs:', err);
    }
  }, [user]);

  useEffect(() => {
    loadActiveTrip();
    loadCatalogs();
  }, [loadActiveTrip, loadCatalogs]);

  // ─── Actions ───

  const getGeoLocation = (): Promise<{ lat?: number; lng?: number }> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({});
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
      const res = await api.post('/trips/start', {
        vehicleId,
        originBranchId,
        destinationId,
        comment: tripComment || undefined,
        deviceTimestamp: new Date().toISOString(),
        ...geo,
      });
      setActiveTrip(res.data.data);
      setPhase('active');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const handleStop = async () => {
    setActionLoading('stop');
    try {
      const geo = await getGeoLocation();
      const res = await api.post(`/trips/${activeTrip!.id}/stop`, {
        comment: stopComment || undefined,
        deviceTimestamp: new Date().toISOString(),
        ...geo,
      });
      setActiveTrip(prev => prev ? { ...prev, status: res.data.data.status } : null);
      setStopModal(false);
      setStopComment('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const handleResume = async () => {
    setActionLoading('resume');
    try {
      await api.post(`/trips/${activeTrip!.id}/resume`, {
        deviceTimestamp: new Date().toISOString(),
      });
      setActiveTrip(prev => prev ? { ...prev, status: 'IN_TRANSIT' } : null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const handleIncident = async () => {
    if (!incidentComment.trim()) return;
    setActionLoading('incident');
    try {
      const geo = await getGeoLocation();
      await api.post(`/trips/${activeTrip!.id}/incident`, {
        incidentTypeId: incidentTypeId || undefined,
        comment: incidentComment,
        deviceTimestamp: new Date().toISOString(),
        ...geo,
      });
      setActiveTrip(prev => prev ? { ...prev, status: 'IN_INCIDENT' } : null);
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
    setActionLoading('finish');
    try {
      const geo = await getGeoLocation();
      await api.post(`/trips/${activeTrip!.id}/finish`, {
        closureBranchId: finishBranchId || undefined,
        comment: finishComment || undefined,
        deviceTimestamp: new Date().toISOString(),
        ...geo,
      });
      setActiveTrip(null);
      setPhase('setup');
      setFinishModal(false);
      setVehicleId('');
      setDestinationId('');
      setTripComment('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  // ─── Render ───

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
      {error && (
        <Alert type="error" message={error} />
      )}

      {/* ── SETUP PHASE ── */}
      {phase === 'setup' && (
        <>
          <div className="pt-2">
            <h2 className="text-xl font-bold text-white">Nuevo viaje</h2>
            <p className="text-slate-400 text-sm mt-1">Selecciona los datos del viaje</p>
          </div>

          <Card>
            <div className="space-y-4">
              <Select
                label="Sucursal de origen"
                value={originBranchId}
                onChange={e => setOriginBranchId(e.target.value)}
                placeholder="Seleccionar sucursal..."
                options={branches.map(b => ({ value: b.id, label: b.name }))}
              />
              <Select
                label="Vehículo"
                value={vehicleId}
                onChange={e => setVehicleId(e.target.value)}
                placeholder="Seleccionar vehículo disponible..."
                options={vehicles.map(v => ({
                  value: v.id,
                  label: `${v.plate} — ${v.brand} ${v.model}`,
                }))}
                hint={vehicles.length === 0 ? 'No hay vehículos disponibles' : undefined}
              />
              <Select
                label="Destino"
                value={destinationId}
                onChange={e => setDestinationId(e.target.value)}
                placeholder="Seleccionar destino..."
                options={locations.map(l => ({ value: l.id, label: l.name }))}
              />
              <Textarea
                label="Comentario (opcional)"
                value={tripComment}
                onChange={e => setTripComment(e.target.value)}
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

      {/* ── ACTIVE TRIP PHASE ── */}
      {phase === 'active' && activeTrip && (
        <>
          {/* Status header */}
          <div className="pt-2 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Viaje activo</h2>
              <p className="text-slate-400 text-sm mt-0.5">
                Iniciado {formatDistanceToNow(new Date(activeTrip.startedAt), { locale: es, addSuffix: true })}
              </p>
            </div>
            <StatusBadge status={activeTrip.status} />
          </div>

          {/* Trip info card */}
          <Card>
            <div className="space-y-3">
              <TripInfoRow icon={<Truck className="w-4 h-4 text-slate-400" />} label="Vehículo" value={
                activeTrip.vehicle
                  ? `${activeTrip.vehicle.plate} — ${activeTrip.vehicle.brand} ${activeTrip.vehicle.model}`
                  : vehicleId
              } />
              <TripInfoRow icon={<Building2 className="w-4 h-4 text-slate-400" />} label="Origen" value={activeTrip.originBranch?.name || '—'} />
              <TripInfoRow icon={<MapPin className="w-4 h-4 text-slate-400" />} label="Destino" value={activeTrip.destination?.name || '—'} />
              <TripInfoRow icon={<Clock className="w-4 h-4 text-slate-400" />} label="Inicio" value={
                format(new Date(activeTrip.startedAt), 'dd/MM/yyyy HH:mm', { locale: es })
              } />
              {activeTrip.comment && (
                <TripInfoRow icon={<ChevronRight className="w-4 h-4 text-slate-400" />} label="Nota" value={activeTrip.comment} />
              )}
            </div>
          </Card>

          {/* Status-specific alert */}
          {activeTrip.status === 'IN_STOP' && (
            <Alert type="warning" message="Viaje en parada. Cuando estés listo, continúa la ruta." />
          )}
          {activeTrip.status === 'IN_INCIDENT' && (
            <Alert type="error" message="Incidencia registrada. Resuelve el problema y continúa la ruta." />
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            {/* IN_TRANSIT: can stop or report incident */}
            {activeTrip.status === 'IN_TRANSIT' && (
              <>
                <Button
                  fullWidth
                  variant="secondary"
                  size="lg"
                  icon={<Square className="w-5 h-5" />}
                  onClick={() => setStopModal(true)}
                  loading={actionLoading === 'stop'}
                >
                  Registrar parada
                </Button>
                <Button
                  fullWidth
                  variant="warning"
                  size="lg"
                  icon={<AlertTriangle className="w-5 h-5" />}
                  onClick={() => setIncidentModal(true)}
                >
                  Reportar incidencia
                </Button>
              </>
            )}

            {/* IN_STOP or IN_INCIDENT: can resume */}
            {(activeTrip.status === 'IN_STOP' || activeTrip.status === 'IN_INCIDENT') && (
              <>
                <Button
                  fullWidth
                  variant="primary"
                  size="lg"
                  icon={<Navigation className="w-5 h-5" />}
                  onClick={handleResume}
                  loading={actionLoading === 'resume'}
                >
                  Continuar ruta
                </Button>
                {activeTrip.status === 'IN_TRANSIT' || activeTrip.status === 'IN_INCIDENT' ? null : (
                  <Button
                    fullWidth
                    variant="warning"
                    size="lg"
                    icon={<AlertTriangle className="w-5 h-5" />}
                    onClick={() => setIncidentModal(true)}
                  >
                    Reportar incidencia
                  </Button>
                )}
              </>
            )}

            {/* Always: finish trip */}
            <Button
              fullWidth
              variant="success"
              size="lg"
              icon={<Zap className="w-5 h-5" />}
              onClick={() => setFinishModal(true)}
            >
              Finalizar viaje
            </Button>
          </div>
        </>
      )}

      {/* ── MODALS ── */}

      {/* Stop modal */}
      <Modal
        open={stopModal}
        onClose={() => setStopModal(false)}
        title="Registrar parada"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setStopModal(false)}>Cancelar</Button>
            <Button
              fullWidth
              variant="warning"
              onClick={handleStop}
              loading={actionLoading === 'stop'}
            >
              Confirmar parada
            </Button>
          </div>
        }
      >
        <Textarea
          label="Comentario (opcional)"
          value={stopComment}
          onChange={e => setStopComment(e.target.value)}
          placeholder="¿Por qué haces esta parada?"
          rows={3}
        />
      </Modal>

      {/* Incident modal */}
      <Modal
        open={incidentModal}
        onClose={() => setIncidentModal(false)}
        title="Reportar incidencia"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setIncidentModal(false)}>Cancelar</Button>
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
          <Select
            label="Tipo de incidencia"
            value={incidentTypeId}
            onChange={e => setIncidentTypeId(e.target.value)}
            placeholder="Seleccionar tipo..."
            options={incidentTypes.map(t => ({ value: t.id, label: `${t.name} (${severityLabel(t.severity)})` }))}
          />
          <Textarea
            label="Descripción *"
            value={incidentComment}
            onChange={e => setIncidentComment(e.target.value)}
            placeholder="Describe detalladamente la incidencia..."
            rows={4}
          />
        </div>
      </Modal>

      {/* Finish modal */}
      <Modal
        open={finishModal}
        onClose={() => setFinishModal(false)}
        title="Finalizar viaje"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setFinishModal(false)}>Cancelar</Button>
            <Button
              fullWidth
              variant="success"
              onClick={handleFinish}
              loading={actionLoading === 'finish'}
            >
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
            onChange={e => setFinishBranchId(e.target.value)}
            placeholder="Seleccionar sucursal de llegada..."
            options={branches.map(b => ({ value: b.id, label: b.name }))}
          />
          <Textarea
            label="Comentario final (opcional)"
            value={finishComment}
            onChange={e => setFinishComment(e.target.value)}
            placeholder="Observaciones del viaje..."
            rows={3}
          />
        </div>
      </Modal>
    </div>
  );
}

function TripInfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-slate-200 text-sm mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}

function severityLabel(s: string) {
  const map: Record<string, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica' };
  return map[s] || s;
}
