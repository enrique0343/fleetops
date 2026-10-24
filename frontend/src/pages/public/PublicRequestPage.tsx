import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api, { getErrorMessage } from '../../services/api';
import { Button, Select, Input, Textarea, Alert, Card } from '../../components/ui';
import { Ambulance, Package, CheckCircle2, Truck, ShieldAlert } from 'lucide-react';

interface Loc { id: string; name: string; type: string }

export default function PublicRequestPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [locations, setLocations] = useState<Loc[]>([]);
  const [bootError, setBootError] = useState('');
  const [booting, setBooting] = useState(true);

  const [serviceType, setServiceType] = useState<'STANDARD' | 'AMBULANCE'>('STANDARD');
  const [requesterName, setRequesterName] = useState('');
  const [requesterEmail, setRequesterEmail] = useState('');
  const [requesterPhone, setRequesterPhone] = useState('');
  const [requesterDept, setRequesterDept] = useState('');
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [scheduledAt, setScheduledAt] = useState(defaultWhen());
  const [reason, setReason] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientCondition, setPatientCondition] = useState('');
  const [requiresStretcher, setRequiresStretcher] = useState(false);
  const [requiresOxygen, setRequiresOxygen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [doneCode, setDoneCode] = useState('');

  const bootstrap = useCallback(async () => {
    setBooting(true);
    try {
      const r = await api.get(`/public/bootstrap?token=${encodeURIComponent(token)}`);
      setLocations(r.data.data.locations || []);
    } catch (err) {
      setBootError(getErrorMessage(err));
    } finally {
      setBooting(false);
    }
  }, [token]);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  const submit = async () => {
    setError('');
    if (!requesterName.trim() || !requesterEmail.trim() || !originId || !destinationId) {
      setError('Completa los campos obligatorios (*)');
      return;
    }
    if (serviceType === 'AMBULANCE' && !patientName.trim()) {
      setError('El nombre del paciente es obligatorio para ambulancia');
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        serviceType, requesterName, requesterEmail, requesterPhone, requesterDept,
        originId, destinationId, scheduledAt: new Date(scheduledAt).toISOString(), reason,
      };
      if (serviceType === 'AMBULANCE') {
        Object.assign(payload, { patientName, patientCondition, requiresStretcher, requiresOxygen });
      }
      const r = await api.post(`/public/requests?token=${encodeURIComponent(token)}`, payload);
      setDoneCode(r.data.data.code);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Encabezado de marca
  const Header = (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
        <Truck className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-white font-bold leading-none">FleetOps</p>
        <p className="text-slate-500 text-xs mt-1">Solicitud de transporte</p>
      </div>
    </div>
  );

  if (booting) {
    return (
      <Shell>
        <div className="py-16 text-center text-slate-400">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Cargando formulario…
        </div>
      </Shell>
    );
  }

  if (bootError) {
    return (
      <Shell>
        {Header}
        <div className="flex flex-col items-center text-center py-10">
          <ShieldAlert className="w-12 h-12 text-red-400 mb-3" />
          <h2 className="text-lg font-semibold text-white">Enlace no válido</h2>
          <p className="text-slate-400 text-sm mt-2 max-w-sm">{bootError}</p>
          <p className="text-slate-500 text-xs mt-3">Solicita un enlace vigente al administrador de la flota.</p>
        </div>
      </Shell>
    );
  }

  if (doneCode) {
    return (
      <Shell>
        {Header}
        <div className="flex flex-col items-center text-center py-10">
          <CheckCircle2 className="w-14 h-14 text-emerald-400 mb-4" />
          <h2 className="text-xl font-bold text-white">¡Solicitud enviada!</h2>
          <p className="text-slate-400 text-sm mt-2">Tu número de seguimiento es:</p>
          <p className="font-mono text-lg text-emerald-300 bg-emerald-950/40 border border-emerald-800/50 rounded-xl px-4 py-2 mt-2">
            {doneCode}
          </p>
          <p className="text-slate-500 text-xs mt-4 max-w-sm">
            El equipo de coordinación revisará tu solicitud. Guarda este código y revisa tu correo
            <strong className="text-slate-300"> {requesterEmail}</strong> para novedades.
          </p>
          <Button className="mt-6" variant="ghost" onClick={() => { setDoneCode(''); setReason(''); setPatientName(''); }}>
            Crear otra solicitud
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {Header}
      <h2 className="text-xl font-bold text-white">Solicitar transporte</h2>
      <p className="text-slate-400 text-sm mt-1 mb-4">Completa el formulario. Sujeto a disponibilidad de agenda.</p>

      {error && <div className="mb-4"><Alert type="error" message={error} /></div>}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <ServiceCard active={serviceType === 'STANDARD'} onClick={() => setServiceType('STANDARD')}
          icon={<Package className="w-5 h-5" />} title="Administrativo" sub="Diligencias, documentos" />
        <ServiceCard active={serviceType === 'AMBULANCE'} onClick={() => setServiceType('AMBULANCE')}
          icon={<Ambulance className="w-5 h-5" />} title="Ambulancia" sub="Traslado de paciente" />
      </div>

      <Card>
        <div className="space-y-4">
          <Input label="Nombre del solicitante *" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} placeholder="Nombre y apellido" />
          <Input label="Correo institucional *" type="email" value={requesterEmail} onChange={(e) => setRequesterEmail(e.target.value)} placeholder="nombre@institucion.org" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Teléfono" value={requesterPhone} onChange={(e) => setRequesterPhone(e.target.value)} placeholder="Opcional" />
            <Input label="Área / departamento" value={requesterDept} onChange={(e) => setRequesterDept(e.target.value)} placeholder="Opcional" />
          </div>

          <Select label="Origen *" value={originId} onChange={(e) => setOriginId(e.target.value)}
            placeholder="Seleccionar origen..." options={locations.map((l) => ({ value: l.id, label: l.name }))} />
          <Select label="Destino *" value={destinationId} onChange={(e) => setDestinationId(e.target.value)}
            placeholder="Seleccionar destino..." options={locations.map((l) => ({ value: l.id, label: l.name }))} />
          <Input label="Fecha y hora deseada *" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />

          {serviceType === 'AMBULANCE' && (
            <>
              <Input label="Paciente *" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Nombre del paciente" />
              <Input label="Condición" value={patientCondition} onChange={(e) => setPatientCondition(e.target.value)} placeholder="Ej. Estable" />
              <div className="flex gap-4">
                <Chk label="Requiere camilla" checked={requiresStretcher} onChange={setRequiresStretcher} />
                <Chk label="Requiere oxígeno" checked={requiresOxygen} onChange={setRequiresOxygen} />
              </div>
            </>
          )}

          <Textarea label={serviceType === 'AMBULANCE' ? 'Notas clínicas' : 'Motivo / instrucciones'}
            value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </div>
      </Card>

      <Button className="mt-4" fullWidth size="lg" onClick={submit} loading={submitting}>
        Enviar solicitud
      </Button>
      <p className="text-xs text-slate-600 text-center mt-3">
        Tu correo institucional queda registrado como respaldo de la solicitud.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 py-8 px-4">
      <div className="max-w-lg mx-auto">{children}</div>
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

function Chk({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-blue-500" />
      {label}
    </label>
  );
}

function defaultWhen(): string {
  const d = new Date(Date.now() + 2 * 3600 * 1000);
  d.setMinutes(0, 0, 0);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}
