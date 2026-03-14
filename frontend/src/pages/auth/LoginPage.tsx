import { useState, FormEvent } from 'react';
import { useAuth } from '../../store/AuthContext';
import { Button, Input, Alert } from '../../components/ui';
import { Truck, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg shadow-blue-900/40">
          <Truck className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">FleetOps</h1>
        <p className="text-slate-400 text-sm mt-1">Control de Transporte Corporativo</p>
      </div>

      {/* Form */}
      <div className="w-full max-w-sm">
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-100 mb-6">Iniciar sesión</h2>

          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Correo electrónico"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="correo@empresa.com"
              autoComplete="email"
              required
            />

            <div className="relative">
              <Input
                label="Contraseña"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 bottom-3 text-slate-400 hover:text-slate-200 transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Button type="submit" fullWidth loading={loading} size="lg">
              {loading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
        </div>

        {/* Demo credentials hint */}
        <div className="mt-4 bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">Credenciales de prueba</p>
          <div className="space-y-1">
            <p className="text-xs text-slate-400">
              <span className="text-slate-500">Admin:</span>{' '}
              <span className="font-mono text-slate-300">admin@fleetops.com</span>
            </p>
            <p className="text-xs text-slate-400">
              <span className="text-slate-500">Driver:</span>{' '}
              <span className="font-mono text-slate-300">carlos.mendez@fleetops.com</span>
            </p>
            <p className="text-xs text-slate-400">
              <span className="text-slate-500">Pass:</span>{' '}
              <span className="font-mono text-slate-300">Admin1234! / Driver1234!</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
