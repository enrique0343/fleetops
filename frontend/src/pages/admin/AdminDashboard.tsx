import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { DashboardStats, RequestStats } from '../../types';
import { StatusBadge } from '../../components/ui';
import {
  Map, Activity, AlertTriangle, Send, Clock, Fuel, Truck,
  CheckCircle2, TrendingUp, Trophy, RefreshCw, ArrowRight, ShieldAlert,
  CalendarClock, Ambulance, Inbox, UserX, Gauge,
} from 'lucide-react';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { es } from 'date-fns/locale';

const REFRESH_MS = 30_000;

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reqStats, setReqStats] = useState<RequestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [dash, reqs] = await Promise.all([
        api.get('/trips/admin/dashboard'),
        api.get('/requests/admin/stats').catch(() => null),
      ]);
      setStats(dash.data.data);
      if (reqs) setReqStats(reqs.data.data);
      setUpdatedAt(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const formatDuration = (min: number) => {
    if (!min) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const utilization =
    stats?.fleet && stats.fleet.total > 0
      ? Math.round((stats.fleet.inUse / stats.fleet.total) * 100)
      : null;

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <HeaderBar updatedAt={null} onRefresh={() => load()} refreshing={loading} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-800 border border-slate-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <HeaderBar updatedAt={updatedAt} onRefresh={() => load()} refreshing={loading} />

      {/* Alertas operativas */}
      {(stats?.withIncident || 0) + (stats?.telegramFailed || 0) > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {(stats?.withIncident || 0) > 0 && (
            <AlertBanner
              to="/admin/trips?status=IN_INCIDENT"
              icon={<ShieldAlert className="w-5 h-5" />}
              tone="red"
              title={`${stats!.withIncident} viaje(s) con incidencia activa`}
              action="Atender ahora"
            />
          )}
          {(stats?.telegramFailed || 0) > 0 && (
            <AlertBanner
              to="/admin/trips?telegramFailed=true"
              icon={<Send className="w-5 h-5" />}
              tone="amber"
              title={`${stats!.telegramFailed} notificación(es) Telegram fallidas hoy`}
              action="Reintentar"
            />
          )}
        </div>
      )}

      {/* Banner: solicitudes pendientes de aprobar */}
      {(reqStats?.pending || 0) > 0 && (
        <AlertBanner
          to="/admin/requests?status=PENDING"
          icon={<Inbox className="w-5 h-5" />}
          tone="amber"
          title={`${reqStats!.pending} solicitud(es) pendiente(s) de aprobación`}
          action="Revisar agenda"
        />
      )}

      {/* KPIs principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Map} label="Viajes hoy" value={stats?.totalToday ?? '—'} accent="blue"
          sub={stats?.finishedToday !== undefined ? `${stats.finishedToday} finalizados` : undefined} />
        <KpiCard icon={Activity} label="Activos ahora" value={stats?.activeNow ?? '—'} accent="emerald" pulse={(stats?.activeNow || 0) > 0} />
        <KpiCard icon={Clock} label="Duración promedio" value={stats ? formatDuration(stats.avgDurationMinutes) : '—'} accent="slate" sub="viajes de hoy" />
        <KpiCard icon={Fuel} label="Cargas hoy" value={stats?.fuelRecordsToday ?? '—'} accent="purple"
          sub={stats?.fuelWeek ? `$${stats.fuelWeek.amount.toLocaleString()} esta semana` : undefined} />
      </div>

      {/* Agenda y solicitudes */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <CalendarClock className="w-4 h-4" /> Agenda y solicitudes
          </h2>
          <Link to="/admin/requests" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            Gestionar <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard icon={Inbox} label="Pendientes" value={reqStats?.pending ?? '—'} accent={(reqStats?.pending || 0) > 0 ? 'amber' : 'slate'} />
          <KpiCard icon={CalendarClock} label="Programadas" value={reqStats?.scheduledToday ?? '—'} accent="blue" />
          <KpiCard icon={Ambulance} label="Ambulancia activa" value={reqStats?.ambulanceActive ?? '—'} accent="red" pulse={(reqStats?.ambulanceActive || 0) > 0} />
          <KpiCard icon={UserX} label="No-shows (sem.)" value={reqStats?.noShowWeek ?? '—'} accent="slate" />
          <KpiCard icon={Gauge} label="SLA ambulancia"
            value={reqStats?.slaCompliance != null ? `${reqStats.slaCompliance}%` : '—'}
            accent={reqStats?.slaCompliance != null && reqStats.slaCompliance < 80 ? 'red' : 'emerald'}
            sub="cumplimiento semanal" />
        </div>
      </section>

      {/* Fila ejecutiva: tendencia + flota */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Tendencia 7 días */}
        <section className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-400" /> Viajes — últimos 7 días
            </h2>
            {stats?.weekTrips !== undefined && (
              <span className="text-xs text-slate-400">{stats.weekTrips} viajes · {stats.weekIncidents ?? 0} incidencias</span>
            )}
          </div>
          {stats?.trend7d ? <TrendChart data={stats.trend7d} /> : <EmptyHint text="Disponible con el backend de Cloudflare" />}
        </section>

        {/* Flota */}
        <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex flex-col">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Truck className="w-4 h-4 text-emerald-400" /> Utilización de flota
          </h2>
          {stats?.fleet ? (
            <div className="flex-1 flex flex-col justify-center gap-3">
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-white">{utilization}%</span>
                <span className="text-sm text-slate-400 mb-1">{stats.fleet.inUse} de {stats.fleet.total} en ruta</span>
              </div>
              <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    (utilization ?? 0) > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${utilization}%` }}
                />
              </div>
              {(stats.forcedWeek || 0) > 0 && (
                <p className="text-xs text-amber-400">{stats.forcedWeek} cierre(s) forzado(s) esta semana</p>
              )}
            </div>
          ) : (
            <EmptyHint text="Disponible con el backend de Cloudflare" />
          )}
        </section>
      </div>

      {/* Fila operativa: viajes activos + top conductores */}
      <div className="grid lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" /> Operación en vivo
            </h2>
            <Link to="/admin/trips" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {stats?.activeTrips && stats.activeTrips.length > 0 ? (
            <ul className="divide-y divide-slate-700/60">
              {stats.activeTrips.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/admin/trips/${t.id}`}
                    className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-xl hover:bg-slate-700/40 transition-colors"
                  >
                    <span className="font-mono text-xs text-slate-300 bg-slate-700/70 rounded-lg px-2 py-1 shrink-0">
                      {t.vehicle?.plate || '—'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-200 truncate">{t.driver?.fullName || '—'}</p>
                      <p className="text-xs text-slate-500 truncate">→ {t.destination?.name || '—'}</p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      {formatDistanceToNowStrict(new Date(t.startedAt), { locale: es })}
                    </span>
                    <StatusBadge status={t.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Sin viajes activos en este momento</p>
            </div>
          )}
        </section>

        <section className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-amber-400" /> Top conductores (semana)
          </h2>
          {stats?.topDrivers && stats.topDrivers.length > 0 ? (
            <ol className="space-y-2.5">
              {stats.topDrivers.map((d, i) => (
                <li key={d.name} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    i === 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-400'
                  }`}>{i + 1}</span>
                  <span className="text-sm text-slate-200 truncate flex-1">{d.name}</span>
                  <span className="text-xs text-slate-400 shrink-0">{d.trips} viajes</span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyHint text="Sin viajes esta semana" />
          )}
        </section>
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickLink to="/admin/trips" icon={<Map className="w-4 h-4" />} label="Viajes" />
        <QuickLink to="/admin/fuel" icon={<Fuel className="w-4 h-4" />} label="Combustible" />
        <QuickLink to="/admin/vehicles" icon={<Truck className="w-4 h-4" />} label="Vehículos" />
        <QuickLink to="/admin/audit" icon={<AlertTriangle className="w-4 h-4" />} label="Auditoría" />
      </div>
    </div>
  );
}

function HeaderBar({ updatedAt, onRefresh, refreshing }: { updatedAt: Date | null; onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard ejecutivo</h1>
        <p className="text-slate-400 text-sm mt-1">
          {updatedAt ? `Actualizado ${format(updatedAt, 'HH:mm:ss')} · auto cada 30s` : 'Resumen operativo en tiempo real'}
        </p>
      </div>
      <button
        onClick={onRefresh}
        className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
        title="Actualizar"
      >
        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}

const kpiAccents: Record<string, { ring: string; icon: string }> = {
  blue: { ring: 'bg-blue-500/15', icon: 'text-blue-400' },
  emerald: { ring: 'bg-emerald-500/15', icon: 'text-emerald-400' },
  amber: { ring: 'bg-amber-500/15', icon: 'text-amber-400' },
  red: { ring: 'bg-red-500/15', icon: 'text-red-400' },
  purple: { ring: 'bg-purple-500/15', icon: 'text-purple-400' },
  slate: { ring: 'bg-slate-500/15', icon: 'text-slate-400' },
};

function KpiCard({ icon: Icon, label, value, accent, sub, pulse }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  accent: keyof typeof kpiAccents;
  sub?: string;
  pulse?: boolean;
}) {
  const a = kpiAccents[accent];
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${a.ring}`}>
          <Icon className={`w-4 h-4 ${a.icon}`} />
        </div>
        {pulse && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
      </div>
      <p className="text-3xl font-bold text-white leading-none">{value}</p>
      <p className="text-slate-400 text-xs mt-2">{label}</p>
      {sub && <p className="text-slate-500 text-xs mt-0.5">{sub}</p>}
    </div>
  );
}

function TrendChart({ data }: { data: { date: string; trips: number }[] }) {
  const max = Math.max(...data.map((d) => d.trips), 1);
  return (
    <div className="flex items-end gap-2 h-36">
      {data.map((d) => {
        const date = new Date(d.date + 'T12:00:00');
        const isToday = d.date === new Date().toISOString().slice(0, 10);
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
            <span className="text-xs text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">{d.trips}</span>
            <div
              className={`w-full rounded-t-lg transition-all duration-500 min-h-[3px] ${
                isToday ? 'bg-blue-500' : 'bg-blue-500/40 group-hover:bg-blue-500/70'
              }`}
              style={{ height: `${Math.max((d.trips / max) * 100, 3)}%` }}
            />
            <span className={`text-[10px] uppercase ${isToday ? 'text-blue-400 font-semibold' : 'text-slate-500'}`}>
              {format(date, 'EEE d', { locale: es })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AlertBanner({ to, icon, tone, title, action }: {
  to: string; icon: React.ReactNode; tone: 'red' | 'amber'; title: string; action: string;
}) {
  const tones = {
    red: 'bg-red-950/50 border-red-800/60 text-red-300 hover:border-red-600',
    amber: 'bg-amber-950/50 border-amber-800/60 text-amber-300 hover:border-amber-600',
  };
  return (
    <Link to={to} className={`flex items-center gap-3 p-4 rounded-2xl border transition-colors ${tones[tone]}`}>
      {icon}
      <span className="text-sm font-medium flex-1">{title}</span>
      <span className="text-xs font-semibold flex items-center gap-1 shrink-0">
        {action} <ArrowRight className="w-3 h-3" />
      </span>
    </Link>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 p-3.5 bg-slate-800 border border-slate-700 rounded-2xl text-slate-300 hover:text-white hover:border-slate-500 transition-colors text-sm font-medium"
    >
      {icon} {label}
    </Link>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-sm text-slate-500 py-6 text-center">{text}</p>;
}
