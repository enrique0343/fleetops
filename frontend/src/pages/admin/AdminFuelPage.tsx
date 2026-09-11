import { useState, useEffect } from 'react';
import api from '../../services/api';
import { FuelRecord } from '../../types';
import { Card, Input, Select, Button, Alert, Modal, Textarea } from '../../components/ui';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { RefreshCw, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { getErrorMessage } from '../../services/api';
import { dateBoundary } from '../../services/viewFilters';

export default function AdminFuelPage() {
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editRecord, setEditRecord] = useState<FuelRecord | null>(null);
  const [editModal, setEditModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [editObservation, setEditObservation] = useState('');
  const [kpis, setKpis] = useState<{
    summary: { totalAmount: number; recordCount: number; avgAmountPerRecord: number | null };
  } | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (dateFrom) params.set('dateFrom', dateBoundary(dateFrom));
      if (dateTo) params.set('dateTo', dateBoundary(dateTo, true));

      const [fRes, kRes] = await Promise.all([
        api.get(`/fuel?${params.toString()}`),
        api.get(`/fuel/admin/kpis?${params.toString()}`),
      ]);
      setRecords(fRes.data.data || []);
      setTotal(fRes.data.total || 0);
      setTotalPages(fRes.data.totalPages || 1);
      setKpis(kRes.data.data);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
      setKpis(null);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, dateFrom, dateTo]);

  const openEdit = (record: FuelRecord) => {
    setEditRecord(record);
    setEditObservation(record.observation || '');
    setEditReason('');
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editRecord || !editReason.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/fuel/${editRecord.id}`, {
        observation: editObservation,
        reason: editReason,
      });
      setSuccess('Registro corregido con auditoría');
      setEditModal(false);
      await load();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Combustible</h1>
          <p className="text-slate-600 text-sm">{total} registros encontrados</p>
        </div>
        <Button size="sm" variant="ghost" icon={<RefreshCw className="w-4 h-4" />} onClick={load}>
          Actualizar
        </Button>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <p className="text-2xl font-bold text-slate-900">${kpis.summary.totalAmount?.toFixed(2) || '0.00'}</p>
            <p className="text-slate-600 text-sm">Gasto del período</p>
          </Card>
          <Card>
            <p className="text-2xl font-bold text-slate-900">${kpis.summary.avgAmountPerRecord?.toFixed(2) || '0.00'}</p>
            <p className="text-slate-600 text-sm">Promedio por carga</p>
          </Card>
          <Card>
            <p className="text-2xl font-bold text-slate-900">{kpis.summary.recordCount || '0'}</p>
            <p className="text-slate-600 text-sm">Cargas del período</p>
          </Card>
        </div>
      )}

      {success && <Alert type="success" message={success} />}
      {error && <Alert type="error" message={error} />}

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white border border-slate-200 rounded-2xl p-4">
        <Input label="Desde" type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
        <Input label="Hasta" type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Vehículo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Motorista</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase hidden md:table-cell">Estación</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Monto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase hidden sm:table-cell">Cantidad</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Fecha</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">Cargando...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-slate-500">Sin registros</td></tr>
              ) : records.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-slate-800 text-xs">{r.vehicle?.plate}</span>
                    {r.correctedBy && <span className="ml-1 text-xs text-amber-700">✎</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.driver?.fullName}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{r.stationName}</td>
                  <td className="px-4 py-3 font-semibold text-blue-700">${r.totalAmount.toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">
                    {r.quantity} {r.unit === 'LITERS' ? 'L' : 'gal'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {format(new Date(r.recordedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(r)} className="text-slate-600 hover:text-blue-700 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="border-t border-slate-200 px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-500">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)} icon={<ChevronLeft className="w-4 h-4" />}>Anterior</Button>
              <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} icon={<ChevronRight className="w-4 h-4" />}>Siguiente</Button>
            </div>
          </div>
        )}
      </div>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Corrección de registro de combustible"
        footer={<div className="flex gap-3"><Button variant="ghost" fullWidth onClick={() => setEditModal(false)}>Cancelar</Button><Button fullWidth onClick={handleSaveEdit} loading={saving} disabled={!editReason.trim()}>Guardar corrección</Button></div>}
      >
        <div className="space-y-4">
          <Alert type="warning" message="La corrección quedará registrada en el log de auditoría." />
          <Textarea label="Motivo de la corrección *" value={editReason} onChange={e => setEditReason(e.target.value)} rows={2} placeholder="Describe el motivo..." />
          <Textarea label="Observación" value={editObservation} onChange={e => setEditObservation(e.target.value)} rows={2} placeholder="Actualizar observación..." />
        </div>
      </Modal>
    </div>
  );
}
