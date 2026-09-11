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
    <div className="login-page">
      <section className="login-story">
        <div className="fleet-brand"><span className="fleet-brand-icon"><Truck size={24} /></span><span>fleet<span className="brand-light">ops</span></span></div>
        <div><p className="page-eyebrow">CONTROL DE TRANSPORTE</p><h1>Cada viaje.<br />Toda tu operación.</h1><p>Coordina viajes, da seguimiento a incidencias y mantén el control del combustible en un solo lugar.</p></div>
        <small>FleetOps · Transporte corporativo</small>
      </section>
      <div className="login-form-panel"><div className="login-form">
        <div className="fleet-brand login-mobile-brand"><span className="fleet-brand-icon"><Truck size={24} /></span><span>fleet<span className="brand-light">ops</span></span></div>
        <h2>Bienvenido de nuevo</h2><p className="page-description">Ingresa con tu cuenta para continuar.</p>
        {error && <Alert type="error" message={error} />}
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input label="Correo electrónico" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@empresa.com" autoComplete="email" required />
          <div className="relative"><Input label="Contraseña" type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Ingresa tu contraseña" autoComplete="current-password" className="pr-14" required /><button type="button" aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPass} onClick={() => setShowPass(!showPass)} className="absolute right-2 bottom-1 p-3 text-slate-500 hover:text-slate-900">{showPass ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          <Button type="submit" fullWidth loading={loading} size="lg">{loading ? 'Ingresando…' : 'Iniciar sesión'}</Button>
        </form>
      </div></div>
    </div>
  );
}
