import { useState, useEffect, useCallback } from 'react';
import api, { getErrorMessage } from '../../services/api';
import { TransportRequest, AvailableResources, RequestStats } from '../../types';
import { Button, Select, Modal, Alert, Textarea } from '../../components/ui';
import { RequestStatusBadge, PriorityTag } from '../../components/requestUi';
import {
  Ambulance, Package, Clock, Check, X, Zap, Send, UserCheck, Stethoscope,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_FILTERS = ['PENDING', 'APPROVED', 'SCHEDULED', 'DISPATCHED', 'COMPLETED', 'REJECTED'];

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<TransportRequest[]>([]);
  const [stats, setStats] = useState<RequestStats | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Assignment modal
  const [assignFor, setAssignFor] = useState<TransportRequest | null>(null);
  const [emergencyFor, setEmergencyFor] = useState<TransportRequest | null>(null);
  const [rejectFor, setRejectFor] = useState<TransportRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (serviceFilter) params.set('serviceType', serviceFilter);
      const [reqRes, statRes] = await Promise.all([
        api.get(`/requests?${params}`),
        api.get('/requests/admin/stats'),
      ]);
      setRequests(reqRes.data.data.data || []);
      setStats(statRes.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, serviceFilter]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<any>) => {
    try {
      await fn();
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Solicitudes de transporte</h1>
          <p className="text-slate-400 text-sm mt-1">Aprobación, agenda y despacho</p>
        </div>
      </div>

      {error && <Alert type="error" message={error} />}

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatChip label="Pendientes" value={stats.pending} tone="amber" />
          <StatChip label="Programadas" value={stats.scheduledToday} tone="blue" />
          <StatChip label="Ambulancia activas" value={stats.ambulanceActive} tone="red" />
          <StatChip label="No-shows (sem.)" value={stats.noShowWeek} tone="slate" />
          <StatChip label="SLA ambulancia" value={stats.slaCompliance != null ? `${stats.slaCompliance}%` : '—'} tone="emerald" />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select className="w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          placeholder="Todos los estados" options={STATUS_FILTERS.map((s) => ({ value: s, label: s }))} />
        <Select className="w-44" value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}
          placeholder="Todos los servicios"
          options={[{ value: 'STANDARD', label: 'Administrativo' }, { value: 'AMBULANCE', label: 'Ambulancia' }]} />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-800 border border-slate-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm">No hay solicitudes con estos filtros</div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className={`bg-slate-800 border rounded-2xl p-4 ${
              r.priority === 'EMERGENCY' ? 'border-red-700/60' : 'border-slate-700'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {r.serviceType === 'AMBULANCE'
                      ? <Ambulance className="w-4 h-4 text-red-400 shrink-0" />
                      : <Package className="w-4 h-4 text-blue-400 shrink-0" />}
                    <span className="font-mono text-xs text-slate-400">{r.code}</span>
                    <PriorityTag priority={r.priority} />
                  </div>
                  <p className="text-sm text-slate-200 truncate">{r.origin?.name} → {r.destination?.name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />{format(new Date(r.scheduledAt), "d MMM HH:mm", { locale: es })}
                    </span>
                    <span>👤 {r.requesterName}</span>
                    {r.serviceType === 'AMBULANCE' && r.patientName && (
                      <span className="flex items-center gap-1 text-slate-400">
                        <Stethoscope className="w-3 h-3" />{r.patientName}
                        {r.requiresStretcher && ' · camilla'}{r.requiresOxygen && ' · O₂'}
                      </span>
                    )}
                    {r.assignedVehicle && <span className="text-emerald-400">🚐 {r.assignedVehicle.plate}</span>}
                  </div>
                </div>
                <RequestStatusBadge status={r.status} />
              </div>

              {/* Acciones según estado */}
              <div className="flex flex-wrap gap-2 mt-3">
                {r.status === 'PENDING' && (
                  <>
                    <Button size="sm" variant="success" icon={<Check className="w-3.5 h-3.5" />}
                      onClick={() => act(() => api.post(`/requests/${r.id}/approve`))}>Aprobar</Button>
                    <Button size="sm" variant="ghost" icon={<X className="w-3.5 h-3.5" />}
                      onClick={() => setRejectFor(r)}>Rechazar</Button>
                  </>
                )}
                {(r.status === 'PENDING' || r.status === 'APPROVED' || r.status === 'RESCHEDULED') && (
                  <Button size="sm" variant="primary" icon={<UserCheck className="w-3.5 h-3.5" />}
                    onClick={() => setAssignFor(r)}>Asignar</Button>
                )}
                {r.status === 'SCHEDULED' && (
                  <Button size="sm" variant="success" icon={<Send className="w-3.5 h-3.5" />}
                    onClick={() => act(() => api.post(`/requests/${r.id}/dispatch`))}>Despachar</Button>
                )}
                {r.serviceType === 'AMBULANCE' && !['DISPATCHED', 'COMPLETED', 'CANCELLED'].includes(r.status) && (
                  <Button size="sm" variant="danger" icon={<Zap className="w-3.5 h-3.5" />}
                    onClick={() => setEmergencyFor(r)}>Emergencia</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {assignFor && (
        <AssignModal request={assignFor} mode="assign" onClose={() => setAssignFor(null)}
          onDone={() => { setAssignFor(null); load(); }} />
      )}
      {emergencyFor && (
        <AssignModal request={emergencyFor} mode="emergency" onClose={() => setEmergencyFor(null)}
          onDone={() => { setEmergencyFor(null); load(); }} />
      )}
      {rejectFor && (
        <RejectModal request={rejectFor} onClose={() => setRejectFor(null)}
          onDone={() => { setRejectFor(null); load(); }} />
      )}
    </div>
  );
}

function AssignModal({ request, mode, onClose, onDone }: {
  request: TransportRequest; mode: 'assign' | 'emergency'; onClose: () => void; onDone: () => void;
}) {
  const [resources, setResources] = useState<AvailableResources | null>(null);
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({
      serviceType: request.serviceType,
      at: request.scheduledAt,
      requiresStretcher: String(request.requiresStretcher),
      requiresOxygen: String(request.requiresOxygen),
    });
    api.get(`/requests/availability/resources?${params}`)
      .then((r) => setResources(r.data.data))
      .finally(() => setLoading(false));
  }, [request]);

  const submit = async () => {
    if (!vehicleId || !driverId) { setError('Selecciona vehículo y conductor'); return; }
    setSubmitting(true);
    try {
      const url = mode === 'emergency'
        ? `/requests/${request.id}/emergency-dispatch`
        : `/requests/${request.id}/assign`;
      await api.post(url, { vehicleId, driverId });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose}
      title={mode === 'emergency' ? '🚨 Despacho de emergencia' : 'Asignar vehículo y conductor'}
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" fullWidth onClick={onClose}>Cancelar</Button>
          <Button fullWidth variant={mode === 'emergency' ? 'danger' : 'primary'}
            onClick={submit} loading={submitting}>
            {mode === 'emergency' ? 'Despachar ya' : 'Asignar'}
          </Button>
        </div>
      }>
      <div className="space-y-4">
        {error && <Alert type="error" message={error} />}
        {mode === 'emergency' && (
          <Alert type="warning" message="El despacho de emergencia salta la agenda y arranca el viaje de inmediato. Queda auditado." />
        )}
        {loading ? (
          <p className="text-sm text-slate-400">Buscando recursos disponibles...</p>
        ) : (
          <>
            <Select label="Vehículo" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}
              placeholder="Seleccionar vehículo..."
              options={(resources?.vehicles || []).map((v) => ({
                value: v.id, label: `${v.plate} — ${v.brand} ${v.model}${v.isAmbulance ? ' 🚑' : ''}`,
              }))}
              hint={resources?.vehicles.length === 0 ? 'No hay unidades libres para esta ventana' : undefined} />
            <Select label="Conductor" value={driverId} onChange={(e) => setDriverId(e.target.value)}
              placeholder="Seleccionar conductor..."
              options={(resources?.drivers || []).map((d) => ({ value: d.id, label: d.fullName }))} />
          </>
        )}
      </div>
    </Modal>
  );
}

function RejectModal({ request, onClose, onDone }: { request: TransportRequest; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!reason.trim()) { setError('Indica el motivo del rechazo'); return; }
    setSubmitting(true);
    try {
      await api.post(`/requests/${request.id}/reject`, { reason });
      onDone();
    } catch (err) { setError(getErrorMessage(err)); setSubmitting(false); }
  };
  return (
    <Modal open onClose={onClose} title="Rechazar solicitud"
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" fullWidth onClick={onClose}>Cancelar</Button>
          <Button fullWidth variant="danger" onClick={submit} loading={submitting}>Rechazar</Button>
        </div>
      }>
      <div className="space-y-3">
        {error && <Alert type="error" message={error} />}
        <Textarea label="Motivo *" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
      </div>
    </Modal>
  );
}

const toneMap: Record<string, string> = {
  amber: 'text-amber-400', blue: 'text-blue-400', red: 'text-red-400',
  slate: 'text-slate-300', emerald: 'text-emerald-400',
};
function StatChip({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-3">
      <p className={`text-2xl font-bold ${toneMap[tone]}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}
