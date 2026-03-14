import { useState, useEffect } from 'react';
import api from '../../services/api';
import { DashboardStats } from '../../types';
import { Card } from '../../components/ui';
import {
  Map, Activity, AlertTriangle, Send, Clock, Fuel
} from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/trips/admin/dashboard').then(res => {
      setStats(res.data.data);
    }).finally(() => setLoading(false));
  }, []);

  const formatDuration = (min: number) => {
    if (!min) return '—';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}min` : `${m}min`;
  };

  const kpiCards = [
    {
      label: 'Viajes hoy',
      value: stats?.totalToday ?? '—',
      icon: Map,
      color: 'blue',
      bg: 'bg-blue-900/30 border-blue-800/50',
      iconBg: 'bg-blue-900',
      iconColor: 'text-blue-400',
    },
    {
      label: 'Activos ahora',
      value: stats?.activeNow ?? '—',
      icon: Activity,
      color: 'emerald',
      bg: stats?.activeNow ? 'bg-emerald-900/30 border-emerald-800/50' : 'bg-slate-800 border-slate-700',
      iconBg: 'bg-emerald-900',
      iconColor: 'text-emerald-400',
    },
    {
      label: 'Con incidencia',
      value: stats?.withIncident ?? '—',
      icon: AlertTriangle,
      color: 'amber',
      bg: stats?.withIncident ? 'bg-amber-900/30 border-amber-800/50' : 'bg-slate-800 border-slate-700',
      iconBg: 'bg-amber-900',
      iconColor: 'text-amber-400',
    },
    {
      label: 'Telegram fallido',
      value: stats?.telegramFailed ?? '—',
      icon: Send,
      color: 'red',
      bg: stats?.telegramFailed ? 'bg-red-900/30 border-red-800/50' : 'bg-slate-800 border-slate-700',
      iconBg: 'bg-red-900',
      iconColor: 'text-red-400',
    },
    {
      label: 'Duración prom.',
      value: stats ? formatDuration(stats.avgDurationMinutes) : '—',
      icon: Clock,
      color: 'slate',
      bg: 'bg-slate-800 border-slate-700',
      iconBg: 'bg-slate-700',
      iconColor: 'text-slate-400',
    },
    {
      label: 'Cargas hoy',
      value: stats?.fuelRecordsToday ?? '—',
      icon: Fuel,
      color: 'purple',
      bg: 'bg-purple-900/20 border-purple-800/40',
      iconBg: 'bg-purple-900',
      iconColor: 'text-purple-400',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Resumen operativo de hoy</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-800 border border-slate-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {kpiCards.map(card => (
            <div key={card.label} className={`rounded-2xl border p-4 ${card.bg}`}>
              <div className={`w-10 h-10 ${card.iconBg} rounded-xl flex items-center justify-center mb-3`}>
                <card.icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
              <p className="text-3xl font-bold text-white">{card.value}</p>
              <p className="text-slate-400 text-sm mt-1">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Acciones rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickLink href="/admin/trips?status=IN_INCIDENT" label="Ver viajes con incidencia" icon="🚨" />
          <QuickLink href="/admin/trips?telegramFailed=true" label="Reintentar Telegram fallido" icon="📨" />
          <QuickLink href="/admin/trips" label="Todos los viajes de hoy" icon="🗺️" />
          <QuickLink href="/admin/fuel" label="Cargas de combustible" icon="⛽" />
        </div>
      </div>
    </div>
  );
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 p-4 bg-slate-800 border border-slate-700 rounded-2xl hover:bg-slate-750 hover:border-slate-600 transition-all group"
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-sm text-slate-300 group-hover:text-white transition-colors font-medium">{label}</span>
    </a>
  );
}
