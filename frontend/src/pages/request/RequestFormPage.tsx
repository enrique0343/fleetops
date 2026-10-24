import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../store/AuthContext';
import api, { getErrorMessage } from '../../services/api';
import { Location, AvailabilitySummary, ExternalProvider } from '../../types';
import { Button, Select, Alert, Card, Textarea, Input } from '../../components/ui';
import { Ambulance, Package, CheckCircle2, Clock, Phone, ExternalLink, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type Service = 'STANDARD' | 'AMBULANCE';

export default function RequestFormPage() {
  const { user } = useAuth();
  const [serviceType, setServiceType] = useState<Service>('STANDARD');
  const [locations, setLocations] = useState<Location[]>([]);
  const [providers, setProviders] = useState<ExternalProvider[]>([]);

  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [scheduledAt, setScheduledAt] = useState(defaultDateTimeLocal());
  const [reason, setReason] = useState('');
  const [passengerCount, setPassengerCount] = useState('');

  // Ambulance fields
  const [patientName, setPatientName] = useState('');
  const [patientCondition, setPatientCondition] = useState('');
  const [requiresStretcher, setRequiresStretcher] = useState(false);
  const [requiresOxygen, setRequiresOxygen] = useState(false);
  const [priority, setPriority] = useState<'SCHEDULED' | 'URGENT' | 'EMERGENCY'>('SCHEDULED');

  const [availability, setAvailability] = useState<AvailabilitySummary | null>(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/catalogs/locations').then((r) => setLocations(r.data.data || []));
  }, []);

  // Live availability whenever service/time/capabilities change.
  const checkAvailability = useCallback(async () => {
    if (!scheduledAt) return;
    setLoadingAvail(true);
    try {
      const params = new URLSearchParams({
        serviceType,
        at: new Date(scheduledAt).toISOString(),
        requiresStretcher: String(requiresStretcher),
        requiresOxygen: String(requiresOxygen),
      });
      const r = await api.get(`/requests/availability?${params}`);
      setAvailability(r.data.data);
      if (r.data.data.canFallbackExternal && providers.length === 0) {
        api.get('/outsourcing/providers?serviceType=AMBULANCE').then((rp) => setProviders(rp.data.data || []));
      }
    } catch {
      setAvailability(null);
    } finally {
      setLoadingAvail(false);
    }
  }, [serviceType, scheduledAt, requiresStretcher, requiresOxygen, providers.length]);

  useEffect(() => {
    const t = setTimeout(checkAvailability, 350);
    return () => clearTimeout(t);
  }, [checkAvailability]);

  const submit = async () => {
    if (!originId || !destinationId || !scheduledAt) {
      setError('Completa origen, destino y fecha/hora');
      return;
    }
    if (serviceType === 'AMBULANCE' && !patientName.trim()) {
      setError('El nombre del paciente es requerido para ambulancia');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const payload: any = {
        serviceType,
        originId,
        destinationId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        reason: reason || undefined,
        requesterName: user?.fullName,
        requesterDept: (user as any)?.department,
      };
      if (serviceType === 'STANDARD') {
        payload.passengerCount = passengerCount ? Number(passengerCount) : undefined;
      } else {
        payload.priority = priority;
        payload.patientName = patientName;
        payload.patientCondition = patientCondition || undefined;
        payload.requiresStretcher = requiresStretcher;
        payload.requiresOxygen = requiresOxygen;
      }
      const r = await api.post('/requests', payload);
      setSuccess(`Solicitud ${r.data.data.code} creada (${labelStatus(r.data.data.status)})`);
      // Reset the lighter fields
      setReason('');
      setPatientName('');
      setPatientCondition('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const referExternal = async (provider: ExternalProvider) => {
    try {
      await api.post('/referrals', {
        serviceType: 'AMBULANCE',
        providerId: provider.id,
        providerName: provider.name,
        reason: availability?.withinHours ? 'ALL_BUSY' : 'OUT_OF_HOURS',
        patientName: patientName || undefined,
      });
      setSuccess(`Derivado a proveedor externo: ${provider.name}. Contacto registrado.`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="pt-2">
        <h2 className="text-xl font-bold text-white">Solicitar transporte</h2>
        <p className="text-slate-400 text-sm mt-1">Sujeto a disponibilidad de agenda</p>
      </div>

      {success && (
        <div className="flex items-center gap-3 p-4 rounded-2xl border border-emerald-700/50 bg-emerald-900/30">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-300">{success}</p>
        </div>
      )}
      {error && <Alert type="error" message={error} />}

      {/* Tipo de servicio */}
      <div className="grid grid-cols-2 gap-3">
        <ServiceCard
          active={serviceType === 'STANDARD'}
          onClick={() => setServiceType('STANDARD')}
          icon={<Package className="w-5 h-5" />}
          title="Administrativo"
          sub="Diligencias, documentos"
        />
        <ServiceCard
          active={serviceType === 'AMBULANCE'}
          onClick={() => setServiceType('AMBULANCE')}
          icon={<Ambulance className="w-5 h-5" />}
          title="Ambulancia"
          sub="Traslado de paciente"
        />
      </div>

      {/* Widget de disponibilidad */}
      <AvailabilityWidget
        availability={availability}
        loading={loadingAvail}
        onPickSlot={(iso) => setScheduledAt(toLocalInput(iso))}
        serviceType={serviceType}
      />

      <Card>
        <div className="space-y-4">
          <Select label="Origen" value={originId} onChange={(e) => setOriginId(e.target.value)}
            placeholder="Seleccionar origen..." options={locations.map((l) => ({ value: l.id, label: l.name }))} />
          <Select label="Destino" value={destinationId} onChange={(e) => setDestinationId(e.target.value)}
            placeholder="Seleccionar destino..." options={locations.map((l) => ({ value: l.id, label: l.name }))} />
          <Input label="Fecha y hora" type="datetime-local" value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)} />

          {serviceType === 'STANDARD' ? (
            <>
              <Input label="Nº de pasajeros (opcional)" type="number" min={0} value={passengerCount}
                onChange={(e) => setPassengerCount(e.target.value)} />
              <Textarea label="Motivo / instrucciones" value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. Entregar documentos en..." rows={2} />
            </>
          ) : (
            <>
              <Select label="Prioridad" value={priority} onChange={(e) => setPriority(e.target.value as any)}
                options={[
                  { value: 'SCHEDULED', label: 'Programada' },
                  { value: 'URGENT', label: 'Urgente' },
                  { value: 'EMERGENCY', label: 'Emergencia' },
                ]} />
              <Input label="Paciente *" value={patientName} onChange={(e) => setPatientName(e.target.value)}
                placeholder="Nombre del paciente" />
              <Input label="Condición" value={patientCondition} onChange={(e) => setPatientCondition(e.target.value)}
                placeholder="Ej. Estable, requiere monitoreo" />
              <div className="flex gap-4">
                <Toggle label="Camilla" checked={requiresStretcher} onChange={setRequiresStretcher} />
                <Toggle label="Oxígeno" checked={requiresOxygen} onChange={setRequiresOxygen} />
              </div>
              <Textarea label="Notas clínicas" value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="Información relevante para el traslado" rows={2} />
            </>
          )}
        </div>
      </Card>

      <Button fullWidth size="lg" onClick={submit} loading={submitting}
        disabled={!originId || !destinationId}>
        Enviar solicitud
      </Button>

      {/* Fallback a outsourcing */}
      {availability?.canFallbackExternal && (
        <Card className="border-amber-800/50 bg-amber-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-300">No hay ambulancia interna disponible</p>
              <p className="text-xs text-amber-400/80 mt-1">
                Puedes esperar a un horario libre o derivar a un proveedor externo:
              </p>
              <div className="mt-3 space-y-2">
                {providers.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl border border-slate-700">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{p.name}</p>
                      {p.phone && (
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {p.phone}
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="warning" icon={<ExternalLink className="w-3.5 h-3.5" />}
                      onClick={() => referExternal(p)}>
                      Derivar
                    </Button>
                  </div>
                ))}
                {providers.length === 0 && (
                  <p className="text-xs text-slate-500">No hay proveedores externos configurados.</p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function AvailabilityWidget({ availability, loading, onPickSlot, serviceType }: {
  availability: AvailabilitySummary | null;
  loading: boolean;
  onPickSlot: (iso: string) => void;
  serviceType: Service;
}) {
  const cfg = {
    GREEN: { dot: 'bg-emerald-400', text: 'text-emerald-300', border: 'border-emerald-700/50 bg-emerald-950/30', label: 'Disponible ahora' },
    YELLOW: { dot: 'bg-amber-400', text: 'text-amber-300', border: 'border-amber-700/50 bg-amber-950/30', label: 'Disponible más tarde' },
    RED: { dot: 'bg-red-400', text: 'text-red-300', border: 'border-red-700/50 bg-red-950/30', label: 'Sin disponibilidad' },
  };
  const c = availability ? cfg[availability.level] : cfg.YELLOW;

  return (
    <div className={`rounded-2xl border p-4 ${c.border}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${loading ? 'bg-slate-500 animate-pulse' : c.dot}`} />
          <span className={`text-sm font-semibold ${c.text}`}>
            {loading ? 'Consultando disponibilidad...' : c.label}
          </span>
        </div>
        {availability && (
          <span className="text-xs text-slate-400">
            {serviceType === 'AMBULANCE' ? '🚑 ' : '🚐 '}
            {availability.availableVehicles} unidad(es) · {availability.availableDrivers} conductor(es)
          </span>
        )}
      </div>

      {availability && availability.nextSlots.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-slate-500 mb-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Próximos horarios libres
          </p>
          <div className="flex flex-wrap gap-2">
            {availability.nextSlots.map((s) => (
              <button key={s.at} onClick={() => onPickSlot(s.at)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-200 hover:border-blue-500 transition-colors">
                {format(new Date(s.at), "EEE d, HH:mm", { locale: es })}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ServiceCard({ active, onClick, icon, title, sub }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string;
}) {
  return (
    <button onClick={onClick}
      className={`flex flex-col items-start gap-1.5 p-4 rounded-2xl border text-left transition-all ${
        active ? 'border-blue-500 bg-blue-950/40' : 'border-slate-700 bg-slate-800 hover:border-slate-500'
      }`}>
      <span className={active ? 'text-blue-400' : 'text-slate-400'}>{icon}</span>
      <span className="text-sm font-semibold text-white">{title}</span>
      <span className="text-xs text-slate-500">{sub}</span>
    </button>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-colors ${
        checked ? 'border-blue-500 bg-blue-950/40 text-blue-300' : 'border-slate-700 bg-slate-800 text-slate-400'
      }`}>
      <span className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? 'bg-blue-500 border-blue-500' : 'border-slate-600'}`}>
        {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
      </span>
      {label}
    </button>
  );
}

function defaultDateTimeLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return toLocalInput(d.toISOString());
}
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}
function labelStatus(s: string): string {
  const m: Record<string, string> = { PENDING: 'pendiente de aprobación', DISPATCHED: 'despachada' };
  return m[s] || s.toLowerCase();
}
