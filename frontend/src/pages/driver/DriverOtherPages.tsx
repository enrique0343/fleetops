import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { Trip } from '../../types';
import { Card, StatusBadge, TelegramBadge, Spinner } from '../../components/ui';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Clock, Truck, MapPin, RefreshCw } from 'lucide-react';

// ─────────────────────────────────────────────
// HISTORY PAGE
// ─────────────────────────────────────────────

export function DriverHistoryPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Llamada explícita con parámetros
      const res = await api.get('/trips/my/history', {
        params: { page: 1, limit: 30 }
      });
      const data = res.data;
      setTrips(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Error cargando historial:', err);
      setError('No se pudo cargar el historial. Verifica la conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return (
    <div className="p-6 flex flex-col items-center justify-center min-h-48 gap-3">
      <Spinner size="md" />
      <p className="text-slate-500 text-sm">Cargando historial...</p>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="pt-2 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Mis viajes</h2>
          <p className="text-slate-400 text-sm">{total} viajes registrados</p>
        </div>
        <button
          onClick={load}
          className="text-slate-400 hover:text-white transition-colors p-2"
          title="Actualizar"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!error && trips.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Truck className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Aún no tienes viajes registrados</p>
          <p className="text-xs mt-1 text-slate-600">Inicia tu primer viaje desde la pestaña "Viaje"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map(trip => (
            <Card key={trip.id} className="!p-4">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={trip.status} />
                  {trip.forcedCloseFlag && (
                    <span className="text-xs bg-red-900/40 text-red-400 px-2 py-0.5 rounded border border-red-800/40">
                      ⚡ Forzado
                    </span>
                  )}
                  {trip.correctionFlag && (
                    <span className="text-xs bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded border border-amber-800/40">
                      ✎ Corregido
                    </span>
                  )}
                </div>
                <TelegramBadge status={trip.telegramDeliveryStatus} />
              </div>

              {/* Trip info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Truck className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-sm text-slate-300">
                    {trip.vehicle?.plate
                      ? `${trip.vehicle.plate} — ${trip.vehicle.brand || ''} ${trip.vehicle.model || ''}`.trim()
                      : '—'}
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-300">
                    {trip.originBranch?.name || '—'} → {trip.destination?.name || '—'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="text-xs text-slate-400">
                    {format(new Date(trip.startedAt), "dd MMM yyyy · HH:mm", { locale: es })}
                    {trip.finishedAt && (
                      <> → {format(new Date(trip.finishedAt), "HH:mm", { locale: es })}</>
                    )}
                    {trip.durationMinutes && (
                      <span className="text-slate-500 ml-1">
                        · {trip.durationMinutes >= 60
                          ? `${Math.floor(trip.durationMinutes / 60)}h ${trip.durationMinutes % 60}min`
                          : `${trip.durationMinutes}min`}
                      </span>
                    )}
                  </span>
                </div>

                {trip.comment && (
                  <p className="text-xs text-slate-500 italic pl-5">{trip.comment}</p>
                )}
              </div>

              {/* Footer */}
              <div className="mt-3 pt-3 border-t border-slate-700/50">
                <span className="text-xs text-slate-600 font-mono">
                  #{trip.id.substring(0, 8)}
                </span>
                {trip.closureBranch && (
                  <span className="text-xs text-slate-600 ml-3">
                    Llegada: {trip.closureBranch.name}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PROFILE PAGE
// ─────────────────────────────────────────────

import { useAuth } from '../../store/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Alert } from '../../components/ui';
import { getErrorMessage } from '../../services/api';

export function DriverProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passSuccess, setPassSuccess] = useState('');
  const [passError, setPassError] = useState('');

  const handleChangePassword = async () => {
    setPassError('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPassError('Completa todos los campos');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassError('Las contraseñas nuevas no coinciden');
      return;
    }
    if (newPassword.length < 8) {
      setPassError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    setPassLoading(true);
    try {
      await api.patch('/auth/change-password', { currentPassword, newPassword });
      setPassSuccess('✓ Contraseña actualizada correctamente');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPassSuccess(''), 4000);
    } catch (err) {
      setPassError(getErrorMessage(err));
    } finally {
      setPassLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const branch = user?.branch;

  return (
    <div className="p-4 space-y-4">
      <div className="pt-2">
        <h2 className="text-xl font-bold text-white">Mi perfil</h2>
      </div>

      {/* User info */}
      <Card>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-blue-900/50 border border-blue-800/50 rounded-2xl flex items-center justify-center shrink-0">
            <span className="text-2xl font-bold text-blue-300">
              {user?.fullName?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate">{user?.fullName}</p>
            <p className="text-slate-400 text-sm truncate">{user?.email}</p>
            <span className="inline-block mt-1 text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded border border-blue-800/30">
              {user?.role === 'ADMIN' ? '👑 Administrador' : '🚗 Motorista'}
            </span>
          </div>
        </div>
        {branch && (
          <div className="border-t border-slate-700/50 pt-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Sucursal asignada</p>
            <p className="text-sm text-slate-300">{branch.name}</p>
          </div>
        )}
        {user?.phone && (
          <div className="mt-2">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Teléfono</p>
            <p className="text-sm text-slate-300">{user.phone}</p>
          </div>
        )}
      </Card>

      {/* Change password */}
      <Card>
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Cambiar contraseña</h3>
        {passSuccess && <div className="mb-3"><Alert type="success" message={passSuccess} /></div>}
        {passError && <div className="mb-3"><Alert type="error" message={passError} /></div>}
        <div className="space-y-3">
          <Input
            label="Contraseña actual"
            type="password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            placeholder="••••••••"
          />
          <Input
            label="Nueva contraseña"
            type="password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
          <Input
            label="Confirmar nueva contraseña"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Repite la nueva contraseña"
          />
          <Button
            fullWidth
            variant="secondary"
            onClick={handleChangePassword}
            loading={passLoading}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          >
            Actualizar contraseña
          </Button>
        </div>
      </Card>

      {/* Logout */}
      <Button fullWidth variant="danger" onClick={handleLogout}>
        Cerrar sesión
      </Button>
    </div>
  );
}
