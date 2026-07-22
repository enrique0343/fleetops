import { useState, useEffect } from 'react';
import api from '../../services/api';
import { TransportRequest } from '../../types';
import { Ambulance, Package, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { RequestStatusBadge } from '../../components/requestUi';

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<TransportRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/requests/my').then((r) => setRequests(r.data.data.data || [])).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="pt-2">
        <h2 className="text-xl font-bold text-white">Mis solicitudes</h2>
        <p className="text-slate-400 text-sm mt-1">Seguimiento de tus solicitudes de transporte</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-slate-800 border border-slate-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm">Aún no has creado solicitudes</div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {r.serviceType === 'AMBULANCE'
                    ? <Ambulance className="w-4 h-4 text-red-400" />
                    : <Package className="w-4 h-4 text-blue-400" />}
                  <span className="font-mono text-xs text-slate-400">{r.code}</span>
                </div>
                <RequestStatusBadge status={r.status} />
              </div>
              <p className="text-sm text-slate-200">
                {r.origin?.name} → {r.destination?.name}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(r.scheduledAt), "d MMM, HH:mm", { locale: es })}
                </span>
                {r.assignedVehicle && <span>🚐 {r.assignedVehicle.plate}</span>}
                {r.priority === 'EMERGENCY' && <span className="text-red-400 font-semibold">EMERGENCIA</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
