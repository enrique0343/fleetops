import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../services/api';
import { Alert } from '../../components/ui';
import { RequestStatusBadge } from '../../components/requestUi';
import { ChevronLeft, ChevronRight, Ambulance, Package, Wrench, CalendarDays } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface CalRequest {
  id: string; code: string; serviceType: string; priority: string; status: string;
  scheduledAt: string; estimatedMinutes?: number;
  origin?: { name: string }; destination?: { name: string };
  assignedVehicle?: { plate: string }; assignedDriver?: { fullName: string };
}
interface CalBlock {
  id: string; resourceType: string; reason: string; startAt: string; endAt: string;
  vehicle?: { plate: string }; driver?: { fullName: string };
}

export default function AdminCalendarPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [requests, setRequests] = useState<CalRequest[]>([]);
  const [blocks, setBlocks] = useState<CalBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = weekStart.toISOString();
      const to = addDays(weekStart, 7).toISOString();
      const r = await api.get(`/requests/calendar?from=${from}&to=${to}`);
      setRequests(r.data.data.requests || []);
      setBlocks(r.data.data.blocks || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-blue-400" /> Agenda
          </h1>
          <p className="text-slate-400 text-sm mt-1">Semana del {format(weekStart, "d 'de' MMMM", { locale: es })}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-sm hover:text-white">
            Hoy
          </button>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-64 bg-slate-800 border border-slate-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {days.map((day) => {
            const dayReqs = requests.filter((r) => isSameDay(new Date(r.scheduledAt), day));
            const dayBlocks = blocks.filter((b) =>
              new Date(b.startAt) <= addDays(day, 1) && new Date(b.endAt) >= day && isSameDay(new Date(b.startAt), day)
            );
            const isToday = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()}
                className={`rounded-2xl border p-3 min-h-[16rem] ${isToday ? 'border-blue-600/60 bg-blue-950/10' : 'border-slate-700 bg-slate-800/50'}`}>
                <div className="flex items-baseline justify-between mb-3">
                  <span className={`text-xs font-semibold uppercase ${isToday ? 'text-blue-400' : 'text-slate-400'}`}>
                    {format(day, 'EEE', { locale: es })}
                  </span>
                  <span className={`text-lg font-bold ${isToday ? 'text-white' : 'text-slate-300'}`}>
                    {format(day, 'd')}
                  </span>
                </div>

                <div className="space-y-2">
                  {dayReqs.length === 0 && dayBlocks.length === 0 && (
                    <p className="text-xs text-slate-600 text-center py-4">—</p>
                  )}

                  {dayReqs.map((r) => (
                    <Link key={r.id} to="/admin/requests"
                      className={`block rounded-lg border p-2 transition-colors hover:border-slate-500 ${
                        r.priority === 'EMERGENCY' ? 'border-red-700/60 bg-red-950/30' : 'border-slate-700 bg-slate-800'
                      }`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        {r.serviceType === 'AMBULANCE'
                          ? <Ambulance className="w-3 h-3 text-red-400 shrink-0" />
                          : <Package className="w-3 h-3 text-blue-400 shrink-0" />}
                        <span className="text-xs font-mono text-slate-300">
                          {format(new Date(r.scheduledAt), 'HH:mm')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 truncate leading-tight">{r.destination?.name}</p>
                      {r.assignedVehicle && <p className="text-[10px] text-slate-500 mt-0.5">🚐 {r.assignedVehicle.plate}</p>}
                      <div className="mt-1 scale-90 origin-left"><RequestStatusBadge status={r.status as any} /></div>
                    </Link>
                  ))}

                  {dayBlocks.map((b) => (
                    <div key={b.id} className="rounded-lg border border-amber-800/40 bg-amber-950/20 p-2">
                      <div className="flex items-center gap-1.5">
                        <Wrench className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="text-[10px] text-amber-300 truncate">
                          {b.vehicle?.plate || b.driver?.fullName} · {blockReason(b.reason)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-600">
        Toca una cita para gestionarla en la bandeja de solicitudes. Los bloques en ámbar son
        mantenimientos, turnos o reservas de recursos.
      </p>
    </div>
  );
}

function blockReason(r: string): string {
  const m: Record<string, string> = {
    MAINTENANCE: 'Mantenimiento', SHIFT: 'Turno', OFF: 'Descanso', RESERVED: 'Reservado', OTHER: 'Bloqueo',
  };
  return m[r] || r;
}
