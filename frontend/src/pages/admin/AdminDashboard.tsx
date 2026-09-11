import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../services/api';
import { DashboardStats, Trip } from '../../types';
import { StatusBadge, Button, Alert } from '../../components/ui';
import { Route, Activity, AlertTriangle, Send, Clock, Fuel, ArrowUpRight, RefreshCw, ChevronRight, CheckCircle2, Truck } from 'lucide-react';

type DashboardViewProps = { stats: DashboardStats | null; trips: Trip[]; loading: boolean; error: string; tripsError: string; updatedAt: Date | null; onRefresh: () => void };
const number = (value: number) => new Intl.NumberFormat('es-SV').format(value);
const dateTime = (value: string) => new Date(value).toLocaleString('es-SV', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export function DashboardView({ stats, trips, loading, error, tripsError, updatedAt, onRefresh }: DashboardViewProps) {
  const kpis = [
    { label: 'Viajes de hoy', value: stats ? number(stats.totalToday) : '—', note: 'Iniciados hoy', icon: Route, className: 'metric-primary' },
    { label: 'Viajes activos', value: stats ? number(stats.activeNow) : '—', note: 'Incluye viajes de días anteriores', icon: Activity, className: '' },
    { label: 'Duración promedio', value: stats?.avgDurationMinutes ? `${Math.floor(stats.avgDurationMinutes / 60) ? `${Math.floor(stats.avgDurationMinutes / 60)} h ` : ''}${stats.avgDurationMinutes % 60} min` : '—', note: 'Finalizados, iniciados hoy · incluye paradas', icon: Clock, className: '' },
    { label: 'Cargas de combustible', value: stats ? number(stats.fuelRecordsToday) : '—', note: 'Registros de hoy', icon: Fuel, className: '' },
  ];
  return <div className="dashboard-page">
    <div className="page-heading"><div><p className="page-eyebrow">PANORAMA OPERATIVO</p><h1>Tu operación, a la vista.</h1><p className="page-description">Viajes, alertas y actividad de transporte.</p></div><div className="dashboard-refresh"><Button variant="secondary" onClick={onRefresh} loading={loading} icon={<RefreshCw size={16} />}>Actualizar</Button><span aria-live="polite">{loading ? 'Actualizando…' : updatedAt ? `Actualizado ${updatedAt.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' })}` : 'Sin actualizar'}</span></div></div>
    {error && <Alert type="error" message={error} />}
    <section aria-label="Indicadores operativos" className="metric-grid" aria-busy={loading}>{kpis.map(kpi => <article className={`metric-card ${kpi.className}`} key={kpi.label}><div className="metric-label">{kpi.label}<kpi.icon size={19} /></div><p className={`metric-value ${loading && !stats ? 'metric-loading' : ''}`}>{kpi.value}</p><p className="metric-note">{kpi.note}</p></article>)}</section>
    <div className="dashboard-columns"><section className="surface recent-trips"><div className="surface-heading"><div><h2>Actividad reciente</h2><p>Últimos 6 viajes · todas las fechas</p></div><Link to="/admin/trips" className="text-action">Ver viajes <ArrowUpRight size={16} /></Link></div>
      {tripsError ? <div className="empty-panel"><Alert type="error" message={tripsError} /></div> : loading && !trips.length ? <div className="empty-panel" role="status">Cargando viajes…</div> : !trips.length ? <div className="empty-panel"><Route size={32} /><h3>Aún no hay viajes</h3><p>Los viajes registrados por los motoristas aparecerán aquí.</p></div> : <div className="recent-list">{trips.map(trip => <Link key={trip.id} to={`/admin/trips/${trip.id}`} className="recent-trip"><div className="trip-vehicle-icon"><Truck size={20} /></div><div className="recent-trip-main"><div className="recent-trip-title"><strong>{trip.destination?.name || 'Destino sin nombre'}</strong><StatusBadge status={trip.status} /></div><p>{trip.originBranch?.name || 'Origen sin nombre'} <span aria-hidden="true">→</span> {trip.destination?.name || 'Destino sin nombre'}</p><div className="trip-meta"><span>{trip.driver?.fullName || 'Motorista sin nombre'}</span><span className="trip-plate">{trip.vehicle?.plate || 'Sin placa'}</span><time dateTime={trip.startedAt}>{dateTime(trip.startedAt)}</time></div></div><ChevronRight size={18} className="trip-chevron" /></Link>)}</div>}
    </section><aside className="dashboard-side"><section className="surface attention-panel"><div className="surface-heading"><div><p className="page-eyebrow">SEGUIMIENTO</p><h2>Requiere atención</h2></div><AlertTriangle size={21} /></div><p className="attention-scope">Viajes iniciados hoy. El día se calcula según la hora del servidor.</p><Link className="attention-row" to="/admin/trips?status=IN_INCIDENT"><span className="attention-icon warning"><AlertTriangle size={19} /></span><span><strong>Con incidencia</strong><small>Estado actual del viaje</small></span><b>{stats?.withIncident ?? '—'}</b><ChevronRight size={16} /></Link><Link className="attention-row" to="/admin/trips?telegramFailed=true"><span className="attention-icon neutral"><Send size={18} /></span><span><strong>Avisos sin entregar</strong><small>Notificaciones de Telegram</small></span><b>{stats?.telegramFailed ?? '—'}</b><ChevronRight size={16} /></Link><p className="attention-footnote">Abre cada categoría para revisar los viajes de todas las fechas.</p>{stats && stats.withIncident === 0 && stats.telegramFailed === 0 && <p className="all-clear"><CheckCircle2 size={16} /> Sin alertas en los viajes de hoy</p>}</section><section className="fuel-shortcut"><Fuel size={25} /><h2>Control de combustible</h2><p>Consulta cargas, montos y registros por fecha.</p><Link to="/admin/fuel">Revisar combustible <ArrowUpRight size={17} /></Link></section></aside></div>
  </div>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tripsError, setTripsError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const request = useRef(0);
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true); setError(''); setTripsError('');
    const [summary, recent] = await Promise.allSettled([api.get('/trips/admin/dashboard'), api.get('/trips', { params: { limit: 6, page: 1 } })]);
    if (request.current !== id) return;
    if (summary.status === 'fulfilled') { setStats(summary.value.data.data); setUpdatedAt(new Date()); }
    else { setError(`No se pudieron actualizar los indicadores. ${getErrorMessage(summary.reason)}`); }
    if (recent.status === 'fulfilled') setTrips(recent.value.data.data || []);
    else setTripsError(`No se pudieron cargar los viajes. ${getErrorMessage(recent.reason)}`);
    setLoading(false);
  }, []);
  useEffect(() => { load(); return () => { request.current++; }; }, [load]);
  return <DashboardView stats={stats} trips={trips} loading={loading} error={error} tripsError={tripsError} updatedAt={updatedAt} onRefresh={load} />;
}
