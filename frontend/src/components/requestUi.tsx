import type { RequestStatus, RequestPriority } from '../types';

const statusMap: Record<RequestStatus, { label: string; cls: string }> = {
  PENDING: { label: 'Pendiente', cls: 'bg-slate-700 text-slate-300 border-slate-600' },
  APPROVED: { label: 'Aprobada', cls: 'bg-blue-900/50 text-blue-300 border-blue-700' },
  REJECTED: { label: 'Rechazada', cls: 'bg-red-900/40 text-red-300 border-red-800' },
  SCHEDULED: { label: 'Programada', cls: 'bg-indigo-900/50 text-indigo-300 border-indigo-700' },
  RESCHEDULED: { label: 'Reprogramada', cls: 'bg-indigo-900/40 text-indigo-300 border-indigo-800' },
  DISPATCHED: { label: 'Despachada', cls: 'bg-emerald-900/50 text-emerald-300 border-emerald-700' },
  COMPLETED: { label: 'Completada', cls: 'bg-emerald-900/40 text-emerald-400 border-emerald-800' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-slate-700 text-slate-400 border-slate-600' },
  NO_SHOW: { label: 'No-show', cls: 'bg-amber-900/40 text-amber-300 border-amber-800' },
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const s = statusMap[status] || statusMap.PENDING;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${s.cls}`}>
      {s.label}
    </span>
  );
}

const priorityMap: Record<RequestPriority, { label: string; cls: string }> = {
  SCHEDULED: { label: 'Programada', cls: 'text-slate-400' },
  URGENT: { label: 'Urgente', cls: 'text-amber-400' },
  EMERGENCY: { label: 'Emergencia', cls: 'text-red-400 font-bold' },
};

export function PriorityTag({ priority }: { priority: RequestPriority }) {
  const p = priorityMap[priority] || priorityMap.SCHEDULED;
  return <span className={`text-xs ${p.cls}`}>{p.label}</span>;
}
