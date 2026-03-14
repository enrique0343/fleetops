import { useState, useEffect, useCallback } from 'react';
import api, { getErrorMessage } from '../../services/api';
import { Vehicle, FuelRecord } from '../../types';
import { Button, Input, Select, Textarea, Alert, Card } from '../../components/ui';
import { Fuel, Plus, ChevronUp, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const GASOLINERAS = [
  'Shell',
  'Texaco',
  'Uno',
  'Puma',
  'Otra',
];

export default function DriverFuelPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [myRecords, setMyRecords] = useState<FuelRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [debugInfo, setDebugInfo] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [vehicleId, setVehicleId] = useState('');
  const [stationName, setStationName] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [quantity, setQuantity] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [isFullTank, setIsFullTank] = useState(true);
  const [observation, setObservation] = useState('');
  const [recordedAt, setRecordedAt] = useState(
    new Date().toISOString().slice(0, 16)
  );

  const loadVehicles = useCallback(async () => {
    setLoadingVehicles(true);
    setDebugInfo('');
    try {
      // Intentar sin filtro de disponibilidad
      const res = await api.get('/catalogs/vehicles');
      console.log('Vehicles response:', res.data);
      const all = res.data.data || [];
      setDebugInfo(`API devolvió ${all.length} vehículos en total`);
      // Filtrar solo activos
      const active = all.filter((v: Vehicle) => v.isActive !== false);
      setVehicles(active);
      console.log('Vehículos activos:', active.length);
    } catch (err) {
      const msg = getErrorMessage(err);
      console.error('Error cargando vehículos:', msg);
      setDebugInfo(`Error: ${msg}`);
    } finally {
      setLoadingVehicles(false);
    }
  }, []);

  const loadRecords = useCallback(async () => {
    try {
      const res = await api.get('/fuel', { params: { limit: 20 } });
      setMyRecords(res.data.data || []);
    } catch (err) {
      console.error('Error cargando registros:', err);
    }
  }, []);

  useEffect(() => {
    loadVehicles();
    loadRecords();
  }, [loadVehicles, loadRecords]);

  const resetForm = () => {
    setVehicleId(''); setStationName(''); setFuelType('');
    setQuantity(''); setTotalAmount(''); setOdometerKm('');
    setIsFullTank(true); setObservation('');
    setRecordedAt(new Date().toISOString().slice(0, 16));
  };

  const handleSubmit = async () => {
    if (!vehicleId || !stationName || !fuelType || !quantity || !totalAmount) {
      setError('Completa todos los campos obligatorios (*)');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/fuel', {
        vehicleId,
        stationName,
        fuelType,
        quantity: parseFloat(quantity),
        unit: 'GALLONS',
        totalAmount: parseFloat(totalAmount),
        currency: 'USD',
        odometerKm: odometerKm ? parseFloat(odometerKm) : undefined,
        isFullTank,
        observation: observation || undefined,
        recordedAt: new Date(recordedAt).toISOString(),
      });
      setSuccess('✓ Carga registrada correctamente');
      setShowForm(false);
      resetForm();
      await loadRecords();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="pt-2 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Combustible</h2>
          <p className="text-slate-400 text-sm">Registro de cargas de gasolina</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { loadVehicles(); loadRecords(); }} className="text-slate-400 hover:text-white p-2 transition-colors" title="Recargar">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Button
            size="sm"
            icon={showForm ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            onClick={() => { setShowForm(!showForm); setError(''); }}
            variant={showForm ? 'ghost' : 'primary'}
          >
            {showForm ? 'Cerrar' : 'Nueva carga'}
          </Button>
        </div>
      </div>

      {/* Debug info - temporal para diagnóstico */}
      {debugInfo && (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 text-xs text-slate-400 font-mono">
          🔍 {debugInfo}
        </div>
      )}

      {success && <Alert type="success" message={success} />}
      {error && <Alert type="error" message={error} />}

      {showForm && (
        <Card>
          <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Fuel className="w-4 h-4 text-blue-400" /> Nueva carga de combustible
          </h3>

          <div className="space-y-4">
            {/* Vehículo */}
            {loadingVehicles ? (
              <div className="bg-slate-700 rounded-xl p-3 text-sm text-slate-400 text-center animate-pulse">
                Cargando vehículos...
              </div>
            ) : vehicles.length === 0 ? (
              <div className="space-y-2">
                <Alert type="warning" message="No se encontraron vehículos. Presiona el botón ↻ para intentar de nuevo." />
                <button
                  onClick={loadVehicles}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-xl py-2.5 transition-colors"
                >
                  ↻ Reintentar cargar vehículos
                </button>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Vehículo * <span className="text-slate-500 font-normal">({vehicles.length} disponibles)</span>
                </label>
                <select
                  value={vehicleId}
                  onChange={e => setVehicleId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar vehículo...</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.plate} — {v.brand} {v.model}{v.fuelType ? ` (${v.fuelType})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Input
              label="Fecha y hora *"
              type="datetime-local"
              value={recordedAt}
              onChange={e => setRecordedAt(e.target.value)}
            />

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Gasolinera / Estación *</label>
              <select
                value={stationName}
                onChange={e => setStationName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar gasolinera...</option>
                {GASOLINERAS.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Tipo de combustible *</label>
              <select
                value={fuelType}
                onChange={e => setFuelType(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar...</option>
                <option value="Gasolina Regular">Gasolina Regular</option>
                <option value="Gasolina Premium">Gasolina Premium</option>
                <option value="Diesel">Diesel</option>
                <option value="Gas LP">Gas LP</option>
              </select>
            </div>

            <Input
              label="Cantidad en galones *"
              type="number"
              step="0.01"
              min="0.01"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              placeholder="0.00"
            />

            <Input
              label="Monto total (USD) *"
              type="number"
              step="0.01"
              min="0.01"
              value={totalAmount}
              onChange={e => setTotalAmount(e.target.value)}
              placeholder="0.00"
            />

            <Input
              label="Odómetro (km)"
              type="number"
              step="1"
              min="0"
              value={odometerKm}
              onChange={e => setOdometerKm(e.target.value)}
              placeholder="Lectura actual del odómetro"
            />

            <div className="flex items-center gap-3 py-1">
              <input
                type="checkbox"
                id="full-tank"
                checked={isFullTank}
                onChange={e => setIsFullTank(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              <label htmlFor="full-tank" className="text-sm text-slate-300 cursor-pointer">
                Tanque lleno completo
              </label>
            </div>

            <Textarea
              label="Observación"
              value={observation}
              onChange={e => setObservation(e.target.value)}
              placeholder="Notas adicionales..."
              rows={2}
            />

            <Button
              fullWidth
              onClick={handleSubmit}
              loading={loading}
              disabled={vehicles.length === 0}
              icon={<Fuel className="w-4 h-4" />}
            >
              Registrar carga
            </Button>
          </div>
        </Card>
      )}

      {/* Records */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Mis registros recientes
        </h3>
        {myRecords.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            <Fuel className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No tienes registros de combustible</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myRecords.map(record => (
              <Card key={record.id} className="!p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200">
                      {record.vehicle?.plate || '—'} — {record.stationName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {format(new Date(record.recordedAt), "dd MMM yyyy HH:mm", { locale: es })}
                    </p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="text-sm font-bold text-blue-400">${record.totalAmount.toFixed(2)}</p>
                    <p className="text-xs text-slate-500">{record.quantity} gal</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">⛽ {record.fuelType}</span>
                  {record.isFullTank && <span className="text-xs bg-emerald-900/40 text-emerald-400 px-2 py-0.5 rounded">✓ Lleno</span>}
                  {record.odometerKm && <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">📏 {record.odometerKm.toLocaleString()} km</span>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
