import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../services/api';
import { Trip, TripEvent } from '../../types';
import {
  Button, StatusBadge, TelegramBadge, Card, Alert, Modal, Textarea, Select, Input
} from '../../components/ui';
import {
  ArrowLeft, RefreshCw, AlertTriangle, Wrench, Send
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const EVENT_ICONS: Record<string, string> = {
  START_TRIP: '🚀',
  ARRIVE_STOP: '🅿️',
  RESUME_TRIP: '▶️',
  REPORT_INCIDENT: '⚠️',
  FINISH_TRIP: '✅',
  FORCE_CLOSE: '⚡',
  ADMIN_CORRECTION: '✏️',
  TELEGRAM_SENT: '📨',
  TELEGRAM_FAILED: '❌',
  FUEL_REGISTERED: '⛽',
};

const EVENT_LABELS: Record<string, string> = {
  START_TRIP: 'Viaje iniciado',
  ARRIVE_STOP: 'Parada registrada',
  RESUME_TRIP: 'Ruta continuada',
  REPORT_INCIDENT: 'Incidencia reportada',
  FINISH_TRIP: 'Viaje finalizado',
  FORCE_CLOSE: 'Cierre forzoso',
  ADMIN_CORRECTION: 'Corrección administrativa',
  TELEGRAM_SENT: 'Notificación enviada',
  TELEGRAM_FAILED: 'Notificación fallida',
  FUEL_REGISTERED: 'Combustible registrado',
};

export default function AdminTripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);

  // Modals
  const [forceModal, setForceModal] = useState(false);
  const [correctionModal, setCorrectionModal] = useState(false);
  const [forceReason, setForceReason] = useState('');
  const [forceBranchId, setForceBranchId] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [corrFinishedAt, setCorrFinishedAt] = useState('');
  const [corrBranchId, setCorrBranchId] = useState('');
  const [corrComment, setCorrComment] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const loadTrip = async () => {
    try {
      const res = await api.get(`/trips/${tripId}`);
      setTrip(res.data.data);
    } catch {
      setError('No se pudo cargar el viaje');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrip();
    api.get('/catalogs/branches').then(r => setBranches(r.data.data || []));
  }, [tripId]);

  const handleForceClose = async () => {
    if (!forceReason.trim()) return;
    setActionLoading('force');
    try {
      await api.post(`/trips/${tripId}/force-close`, {
        reason: forceReason,
        closureBranchId: forceBranchId || undefined,
      });
      setSuccess('Viaje cerrado forzosamente');
      setForceModal(false);
      await loadTrip();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const handleCorrection = async () => {
    if (!correctionReason.trim()) return;
    setActionLoading('correction');
    try {
      const corrections: Record<string, string> = {};
      if (corrFinishedAt) corrections.finishedAt = new Date(corrFinishedAt).toISOString();
      if (corrBranchId) corrections.closureBranchId = corrBranchId;
      if (corrComment) corrections.comment = corrComment;

      await api.patch(`/trips/${tripId}/correction`, {
        reason: correctionReason,
        corrections,
      });
      setSuccess('Corrección aplicada con auditoría');
      setCorrectionModal(false);
      await loadTrip();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  const handleRetryTelegram = async () => {
    setActionLoading('telegram');
    try {
      const res = await api.post(`/trips/${tripId}/retry-telegram`);
      if (res.data.data.success) {
        setSuccess('Notificación enviada correctamente');
      } else {
        setError('Fallo al reenviar: ' + (res.data.data.result?.error || 'Error desconocido'));
      }
      await loadTrip();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return (
    <div className="flex justify-center pt-16">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!trip) return (
    <div className="text-center pt-16">
      <p className="text-red-400">Viaje no encontrado</p>
      <Button variant="ghost" className="mt-4" onClick={() => navigate('/admin/trips')}>
        Volver a viajes
      </Button>
    </div>
  );

  const isActive = !['FINISHED', 'CANCELLED'].includes(trip.status);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigate('/admin/trips')}
        >
          Volver
        </Button>
      </div>

      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Viaje #{trip.id.substring(0, 8)}</h1>
          <div className="flex gap-2 mt-2 flex-wrap">
            <StatusBadge status={trip.status} />
            <TelegramBadge status={trip.telegramDeliveryStatus} />
            {trip.forcedCloseFlag && (
              <span className="text-xs bg-red-900/40 text-red-400 border border-red-800 px-2 py-1 rounded-lg">
                Cierre forzoso
              </span>
            )}
            {trip.correctionFlag && (
              <span className="text-xs bg-amber-900/40 text-amber-400 border border-amber-800 px-2 py-1 rounded-lg">
                Corregido
              </span>
            )}
          </div>
        </div>

        {/* Admin actions */}
        <div className="flex flex-wrap gap-2">
          {isActive && (
            <Button
              size="sm"
              variant="danger"
              icon={<AlertTriangle className="w-4 h-4" />}
              onClick={() => setForceModal(true)}
            >
              Forzar cierre
            </Button>
          )}
          {!isActive && (
            <Button
              size="sm"
              variant="secondary"
              icon={<Wrench className="w-4 h-4" />}
              onClick={() => setCorrectionModal(true)}
            >
              Corrección
            </Button>
          )}
          {!isActive && trip.telegramDeliveryStatus !== 'SENT' && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Send className="w-4 h-4" />}
              onClick={handleRetryTelegram}
              loading={actionLoading === 'telegram'}
            >
              Reintentar Telegram
            </Button>
          )}
          <Button size="sm" variant="ghost" icon={<RefreshCw className="w-4 h-4" />} onClick={loadTrip}>
            Refrescar
          </Button>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}
      {success && <Alert type="success" message={success} />}

      {/* Trip data */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Datos del viaje</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DataField label="Motorista" value={trip.driver?.fullName || '—'} />
          <DataField label="Vehículo" value={trip.vehicle ? `${trip.vehicle.plate} — ${trip.vehicle.brand} ${trip.vehicle.model}` : '—'} />
          <DataField label="Origen" value={trip.originBranch?.name || '—'} />
          <DataField label="Destino" value={trip.destination?.name || '—'} />
          <DataField label="Inicio" value={format(new Date(trip.startedAt), 'dd/MM/yyyy HH:mm:ss', { locale: es })} />
          <DataField
            label="Fin"
            value={trip.finishedAt ? format(new Date(trip.finishedAt), 'dd/MM/yyyy HH:mm:ss', { locale: es }) : '—'}
          />
          <DataField label="Duración" value={trip.durationMinutes ? `${trip.durationMinutes} minutos` : '—'} />
          <DataField label="Sucursal de cierre" value={trip.closureBranch?.name || '—'} />
          {trip.comment && <DataField label="Comentario" value={trip.comment} className="col-span-2" />}
        </div>

        {/* Telegram detail */}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Telegram</p>
          <div className="flex gap-4 flex-wrap">
            <DataField label="Estado" value={trip.telegramDeliveryStatus} />
            {trip.telegramLastAttemptAt && (
              <DataField
                label="Último intento"
                value={format(new Date(trip.telegramLastAttemptAt), 'dd/MM HH:mm:ss')}
              />
            )}
            {trip.telegramLastResult && trip.telegramLastResult !== 'OK' && (
              <DataField label="Resultado" value={trip.telegramLastResult} />
            )}
          </div>
        </div>
      </Card>

      {/* Timeline */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Línea de tiempo de eventos
        </h2>
        {trip.events && trip.events.length > 0 ? (
          <div className="space-y-0">
            {trip.events.map((event, idx) => (
              <TimelineEvent
                key={event.id}
                event={event}
                isLast={idx === trip.events!.length - 1}
              />
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">Sin eventos registrados</p>
        )}
      </Card>

      {/* Force Close Modal */}
      <Modal
        open={forceModal}
        onClose={() => setForceModal(false)}
        title="Forzar cierre del viaje"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setForceModal(false)}>Cancelar</Button>
            <Button
              variant="danger"
              fullWidth
              onClick={handleForceClose}
              loading={actionLoading === 'force'}
              disabled={!forceReason.trim()}
            >
              Confirmar cierre forzoso
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Alert type="warning" message="Esta acción quedará registrada en la auditoría con tu usuario y timestamp." />
          <Textarea
            label="Motivo del cierre forzoso *"
            value={forceReason}
            onChange={e => setForceReason(e.target.value)}
            placeholder="Describe el motivo del cierre administrativo..."
            rows={3}
          />
          <Select
            label="Sucursal de cierre"
            value={forceBranchId}
            onChange={e => setForceBranchId(e.target.value)}
            placeholder="Seleccionar sucursal..."
            options={branches.map(b => ({ value: b.id, label: b.name }))}
          />
        </div>
      </Modal>

      {/* Correction Modal */}
      <Modal
        open={correctionModal}
        onClose={() => setCorrectionModal(false)}
        title="Corrección administrativa"
        footer={
          <div className="flex gap-3">
            <Button variant="ghost" fullWidth onClick={() => setCorrectionModal(false)}>Cancelar</Button>
            <Button
              variant="warning"
              fullWidth
              onClick={handleCorrection}
              loading={actionLoading === 'correction'}
              disabled={!correctionReason.trim()}
            >
              Aplicar corrección
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Alert type="info" message="Solo completa los campos que deseas corregir. Los vacíos no se modificarán." />
          <Textarea
            label="Motivo de la corrección *"
            value={correctionReason}
            onChange={e => setCorrectionReason(e.target.value)}
            placeholder="Describe por qué se realiza esta corrección..."
            rows={2}
          />
          <Input
            label="Corregir hora de finalización"
            type="datetime-local"
            value={corrFinishedAt}
            onChange={e => setCorrFinishedAt(e.target.value)}
          />
          <Select
            label="Corregir sucursal de cierre"
            value={corrBranchId}
            onChange={e => setCorrBranchId(e.target.value)}
            placeholder="No cambiar..."
            options={branches.map(b => ({ value: b.id, label: b.name }))}
          />
          <Textarea
            label="Corregir comentario"
            value={corrComment}
            onChange={e => setCorrComment(e.target.value)}
            placeholder="No cambiar..."
            rows={2}
          />
        </div>
      </Modal>
    </div>
  );
}

function DataField({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
      <p className="text-slate-200 text-sm mt-0.5">{value}</p>
    </div>
  );
}

function TimelineEvent({ event, isLast }: { event: TripEvent; isLast: boolean }) {
  const isAdmin = ['ADMIN_CORRECTION', 'FORCE_CLOSE'].includes(event.type);
  const isError = ['TELEGRAM_FAILED', 'REPORT_INCIDENT'].includes(event.type);

  return (
    <div className="flex gap-3 pb-4">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 border ${
          isAdmin ? 'bg-amber-900/30 border-amber-700' :
          isError ? 'bg-red-900/30 border-red-700' :
          'bg-slate-700 border-slate-600'
        }`}>
          {EVENT_ICONS[event.type] || '•'}
        </div>
        {!isLast && <div className="w-0.5 h-full bg-slate-700 mt-1" />}
      </div>
      <div className="flex-1 pt-1 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-slate-200">
              {EVENT_LABELS[event.type] || event.type}
            </p>
            <p className="text-xs text-slate-500">
              por {event.user?.fullName || 'Sistema'} · {' '}
              {format(new Date(event.serverTimestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
            </p>
          </div>
        </div>
        {event.comment && (
          <p className={`mt-1.5 text-sm px-3 py-2 rounded-lg ${
            isError ? 'bg-red-900/20 text-red-300' :
            isAdmin ? 'bg-amber-900/20 text-amber-300' :
            'bg-slate-800 text-slate-300'
          }`}>
            {event.comment}
          </p>
        )}
        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <pre className="mt-1 text-xs text-slate-600 font-mono overflow-x-auto">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
