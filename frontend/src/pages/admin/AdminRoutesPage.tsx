import { useState, useEffect, useCallback } from 'react';
import api, { getErrorMessage } from '../../services/api';
import { TransportTask, RoutePlan, AvailableResources } from '../../types';
import { Button, Select, Modal, Alert, Input, Textarea } from '../../components/ui';
import { Plus, Route as RouteIcon, MapPin, Navigation, Send, Trash2, Sparkles } from 'lucide-react';

export default function AdminRoutesPage() {
  const [tasks, setTasks] = useState<TransportTask[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [nav, setNav] = useState<{ multiStop: string | null; stops: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState('');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [resources, setResources] = useState<AvailableResources | null>(null);
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/routes/tasks?status=POOL');
      setTasks(r.data.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    api.get('/requests/availability/resources?serviceType=STANDARD').then((r) => setResources(r.data.data)).catch(() => {});
  }, [loadTasks]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const optimize = async () => {
    if (selected.size === 0) { setError('Selecciona al menos una tarea'); return; }
    setError('');
    setOptimizing(true);
    try {
      const r = await api.post('/routes/optimize', {
        taskIds: [...selected],
        driverId: driverId || undefined,
        vehicleId: vehicleId || undefined,
      });
      setRoute(r.data.data);
      const n = await api.get(`/routes/${r.data.data.id}/navigation`);
      setNav(n.data.data);
      setSelected(new Set());
      loadTasks();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setOptimizing(false);
    }
  };

  const dispatch = async () => {
    if (!route) return;
    try {
      await api.post(`/routes/${route.id}/dispatch`);
      setRoute({ ...route, status: 'DISPATCHED' });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Planificador de rutas</h1>
          <p className="text-slate-400 text-sm mt-1">Agrupa diligencias en una ruta óptima</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setNewTaskOpen(true)}>Nueva tarea</Button>
      </div>

      {error && <Alert type="error" message={error} />}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pool */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Pool de tareas ({tasks.length})</h2>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-slate-800 border border-slate-700 rounded-xl animate-pulse" />
            ))}</div>
          ) : tasks.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm border border-dashed border-slate-700 rounded-2xl">
              No hay tareas en el pool
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((t) => (
                <button key={t.id} onClick={() => toggle(t.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    selected.has(t.id) ? 'border-blue-500 bg-blue-950/40' : 'border-slate-700 bg-slate-800 hover:border-slate-500'
                  }`}>
                  <span className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${
                    selected.has(t.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-600'
                  }`}>
                    {selected.has(t.id) && <span className="text-white text-xs">✓</span>}
                  </span>
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-200 truncate">
                      {t.location?.name || t.addressText || t.code}
                    </p>
                    <p className="text-xs text-slate-500">{t.type} · {t.requesterName}{t.priority === 'HIGH' && ' · prioridad alta'}</p>
                  </div>
                  <Trash2 className="w-4 h-4 text-slate-600 hover:text-red-400"
                    onClick={(e) => { e.stopPropagation(); api.delete(`/routes/tasks/${t.id}`).then(loadTasks); }} />
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 space-y-3 bg-slate-800/50 border border-slate-700 rounded-2xl p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Asignar (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <Select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} placeholder="Vehículo..."
                options={(resources?.vehicles || []).map((v) => ({ value: v.id, label: v.plate }))} />
              <Select value={driverId} onChange={(e) => setDriverId(e.target.value)} placeholder="Conductor..."
                options={(resources?.drivers || []).map((d) => ({ value: d.id, label: d.fullName }))} />
            </div>
            <Button fullWidth icon={<Sparkles className="w-4 h-4" />} onClick={optimize}
              loading={optimizing} disabled={selected.size === 0}>
              Optimizar ruta ({selected.size})
            </Button>
          </div>
        </section>

        {/* Route result */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Ruta optimizada</h2>
          {!route ? (
            <div className="py-12 text-center text-slate-500 text-sm border border-dashed border-slate-700 rounded-2xl">
              <RouteIcon className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              Selecciona tareas y optimiza para ver la ruta
            </div>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs text-slate-400">{route.code}</span>
                <span className="text-xs text-slate-500">
                  motor: {route.optimizerMeta?.engine} · {route.totalDistanceKm} km · ~{route.totalDurationMin} min
                </span>
              </div>
              <ol className="space-y-2">
                {(route.tasks || []).map((t, i) => (
                  <li key={t.id} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-slate-200 flex-1 truncate">
                      {t.location?.name || t.addressText || t.code}
                    </span>
                    {nav?.stops?.[i] && (
                      <a href={nav.stops[i].waze} target="_blank" rel="noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                        <Navigation className="w-3 h-3" /> Waze
                      </a>
                    )}
                  </li>
                ))}
              </ol>

              <div className="flex gap-2 mt-4">
                {nav?.multiStop && (
                  <a href={nav.multiStop} target="_blank" rel="noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-700 hover:bg-slate-600 text-white transition-colors">
                    <Navigation className="w-4 h-4" /> Abrir en Maps
                  </a>
                )}
                {route.status === 'DRAFT' ? (
                  <Button variant="success" icon={<Send className="w-4 h-4" />} onClick={dispatch}>
                    Despachar ruta
                  </Button>
                ) : (
                  <span className="flex-1 text-center text-sm text-emerald-400 py-2.5">✓ Despachada</span>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {newTaskOpen && <NewTaskModal onClose={() => setNewTaskOpen(false)} onDone={() => { setNewTaskOpen(false); loadTasks(); }} />}
    </div>
  );
}

function NewTaskModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState('DELIVERY');
  const [addressText, setAddressText] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!addressText.trim() && (!lat || !lng)) { setError('Indica dirección o coordenadas'); return; }
    setSubmitting(true);
    try {
      await api.post('/routes/tasks', {
        type, addressText: addressText || undefined,
        lat: lat ? Number(lat) : undefined, lng: lng ? Number(lng) : undefined,
        notes, priority, requesterName: 'Coordinación',
      });
      onDone();
    } catch (err) { setError(getErrorMessage(err)); setSubmitting(false); }
  };

  return (
    <Modal open onClose={onClose} title="Nueva tarea"
      footer={
        <div className="flex gap-3">
          <Button variant="ghost" fullWidth onClick={onClose}>Cancelar</Button>
          <Button fullWidth onClick={submit} loading={submitting}>Agregar al pool</Button>
        </div>
      }>
      <div className="space-y-4">
        {error && <Alert type="error" message={error} />}
        <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value)}
          options={[
            { value: 'DROPOFF', label: 'Dejar' }, { value: 'PICKUP', label: 'Recoger' },
            { value: 'DELIVERY', label: 'Entregar' }, { value: 'VISIT', label: 'Visitar' },
          ]} />
        <Input label="Dirección / referencia" value={addressText} onChange={(e) => setAddressText(e.target.value)}
          placeholder="Ej. Ministerio de Salud, Av. X" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Latitud" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="14.60" />
          <Input label="Longitud" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-90.51" />
        </div>
        <Select label="Prioridad" value={priority} onChange={(e) => setPriority(e.target.value)}
          options={[{ value: 'NORMAL', label: 'Normal' }, { value: 'HIGH', label: 'Alta' }]} />
        <Textarea label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>
    </Modal>
  );
}
