import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../services/api';
import { TransportRequest } from '../../types';
import { Button, Alert } from '../../components/ui';
import { RequestStatusBadge } from '../../components/requestUi';
import {
  Ambulance, Package, Clock, MapPin, Building2, Play, Stethoscope, CalendarClock,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function DriverAppointmentsPage() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<TransportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/requests/my/assigned');
      setAppointments(r.data.data.data || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const start = async (id: string) => {
    setStarting(id);
    setError('');
    try {
      await api.post(`/requests/${id}/start`);
      // The trip is now active — jump to the trip screen.
      navigate('/driver');
    } catch (err) {
      setError(getErrorMessage(err));
      setStarting('');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="pt-2">
        <h2 className="text-xl font-bold text-white">Mis citas</h2>
        <p className="text-slate-400 text-sm mt-1">Traslados asignados a ti</p>
      </div>

      {error && <Alert type="error" message={error} />}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-40 bg-slate-800 border border-slate-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <div className="py-16 text-center">
          <CalendarClock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No tienes citas asignadas</p>
          <p className="text-slate-600 text-xs mt-1">Puedes iniciar un viaje sin cita desde la pestaña "Viaje"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => {
            const isAmbulance = a.serviceType === 'AMBULANCE';
            const dispatched = a.status === 'DISPATCHED';
            return (
              <div key={a.id} className={`rounded-2xl border p-4 ${
                a.priority === 'EMERGENCY' ? 'border-red-700/60 bg-red-950/20' : 'border-slate-700 bg-slate-800'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {isAmbulance ? <Ambulance className="w-4 h-4 text-red-400" /> : <Package className="w-4 h-4 text-blue-400" />}
                    <span className="font-mono text-xs text-slate-400">{a.code}</span>
                    {a.priority === 'EMERGENCY' && <span className="text-xs font-bold text-red-400">EMERGENCIA</span>}
                  </div>
                  <RequestStatusBadge status={a.status} />
                </div>

                <div className="space-y-2">
                  <Row icon={<Clock className="w-4 h-4 text-slate-400" />}
                    text={format(new Date(a.scheduledAt), "EEEE d 'de' MMMM, HH:mm", { locale: es })} />
                  <Row icon={<Building2 className="w-4 h-4 text-slate-400" />} text={a.origin?.name || '—'} />
                  <Row icon={<MapPin className="w-4 h-4 text-slate-400" />} text={a.destination?.name || '—'} highlight />
                  {isAmbulance && a.patientName && (
                    <Row icon={<Stethoscope className="w-4 h-4 text-slate-400" />}
                      text={`${a.patientName}${a.requiresStretcher ? ' · camilla' : ''}${a.requiresOxygen ? ' · O₂' : ''}`} />
                  )}
                </div>

                {a.reason && <p className="text-xs text-slate-500 mt-2 italic">"{a.reason}"</p>}

                <div className="mt-3">
                  {dispatched ? (
                    <Button fullWidth variant="secondary" onClick={() => navigate('/driver')}>
                      Viaje en curso — ir al viaje
                    </Button>
                  ) : (
                    <Button fullWidth variant="success" icon={<Play className="w-4 h-4" />}
                      loading={starting === a.id} onClick={() => start(a.id)}>
                      Iniciar este viaje
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ icon, text, highlight }: { icon: React.ReactNode; text: string; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0">{icon}</span>
      <span className={`text-sm ${highlight ? 'text-white font-medium' : 'text-slate-300'}`}>{text}</span>
    </div>
  );
}
