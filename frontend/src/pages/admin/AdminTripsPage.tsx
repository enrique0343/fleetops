import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { Trip, Branch, User, Vehicle } from '../../types';
import { StatusBadge, TelegramBadge, Button, Select, Input } from '../../components/ui';
import { Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminTripsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const page = parseInt(searchParams.get('page') || '1');
  const status = searchParams.get('status') || '';
  const branchId = searchParams.get('branchId') || '';
  const driverId = searchParams.get('driverId') || '';
  const vehicleId = searchParams.get('vehicleId') || '';
  const telegramFailed = searchParams.get('telegramFailed') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  const loadTrips = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (status) params.set('status', status);
      if (branchId) params.set('branchId', branchId);
      if (driverId) params.set('driverId', driverId);
      if (vehicleId) params.set('vehicleId', vehicleId);
      if (telegramFailed) params.set('telegramFailed', telegramFailed);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await api.get(`/trips?${params.toString()}`);
      setTrips(res.data.data || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } finally {
      setLoading(false);
    }
  }, [page, status, branchId, driverId, vehicleId, telegramFailed, dateFrom, dateTo]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    Promise.all([
      api.get('/catalogs/branches'),
      api.get('/catalogs/users'),
      api.get('/catalogs/vehicles'),
    ]).then(([b, u, v]) => {
      setBranches(b.data.data || []);
      setDrivers((u.data.data || []).filter((u: User) => u.role === 'DRIVER'));
      setVehicles(v.data.data || []);
    });
  }, []);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    next.set('page', '1');
    setSearchParams(next);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Viajes</h1>
          <p className="text-slate-400 text-sm mt-1">{total} registros encontrados</p>
        </div>
        <Button size="sm" variant="ghost" icon={<RefreshCw className="w-4 h-4" />} onClick={loadTrips}>
          Actualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Select
            label="Estado"
            value={status}
            onChange={e => setFilter('status', e.target.value)}
            placeholder="Todos"
            options={[
              { value: 'IN_TRANSIT', label: 'En tránsito' },
              { value: 'IN_STOP', label: 'En parada' },
              { value: 'IN_INCIDENT', label: 'Con incidencia' },
              { value: 'FINISHED', label: 'Finalizados' },
              { value: 'CANCELLED', label: 'Cancelados' },
            ]}
          />
          <Select
            label="Sucursal"
            value={branchId}
            onChange={e => setFilter('branchId', e.target.value)}
            placeholder="Todas"
            options={branches.map(b => ({ value: b.id, label: b.name }))}
          />
          <Select
            label="Motorista"
            value={driverId}
            onChange={e => setFilter('driverId', e.target.value)}
            placeholder="Todos"
            options={drivers.map(d => ({ value: d.id, label: d.fullName }))}
          />
          <Select
            label="Vehículo"
            value={vehicleId}
            onChange={e => setFilter('vehicleId', e.target.value)}
            placeholder="Todos"
            options={vehicles.map(v => ({ value: v.id, label: v.plate }))}
          />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Input
            label="Desde"
            type="date"
            value={dateFrom}
            onChange={e => setFilter('dateFrom', e.target.value)}
          />
          <Input
            label="Hasta"
            type="date"
            value={dateTo}
            onChange={e => setFilter('dateTo', e.target.value)}
          />
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={telegramFailed === 'true'}
                onChange={e => setFilter('telegramFailed', e.target.checked ? 'true' : '')}
                className="rounded accent-blue-500"
              />
              <span className="text-sm text-slate-300">Solo Telegram fallido</span>
            </label>
          </div>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={clearFilters} fullWidth>
              Limpiar filtros
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-500">
            <Search className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No hay viajes con esos filtros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Motorista</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Vehículo</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Destino</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Inicio</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Telegram</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {trips.map(trip => (
                  <tr key={trip.id} className="hover:bg-slate-750 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-slate-400">#{trip.id.substring(0, 8)}</span>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {trip.forcedCloseFlag && <span className="text-xs text-red-400">⚡ Forzado</span>}
                        {trip.correctionFlag && <span className="text-xs text-amber-400">✎ Corregido</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{trip.driver?.fullName}</td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell font-mono text-xs">{trip.vehicle?.plate}</td>
                    <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">{trip.destination?.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={trip.status} /></td>
                    <td className="px-4 py-3 text-slate-400 hidden sm:table-cell text-xs">
                      {format(new Date(trip.startedAt), 'dd/MM HH:mm', { locale: es })}
                      {trip.durationMinutes && <span className="text-slate-600 ml-1">· {trip.durationMinutes}min</span>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <TelegramBadge status={trip.telegramDeliveryStatus} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/admin/trips/${trip.id}`}
                        className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-700 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setFilter('page', String(page - 1))}
                icon={<ChevronLeft className="w-4 h-4" />}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={page >= totalPages}
                onClick={() => setFilter('page', String(page + 1))}
                icon={<ChevronRight className="w-4 h-4" />}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
