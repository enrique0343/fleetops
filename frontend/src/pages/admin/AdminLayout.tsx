import { ReactNode, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { LayoutDashboard, Route, Fuel, Users, Building2, Truck, MapPin, LogOut, Menu, X, Shield, ChevronRight } from 'lucide-react';

const groups = [
  { label: 'OPERACIÓN', items: [
    { to: '/admin', label: 'Resumen', icon: LayoutDashboard, end: true },
    { to: '/admin/trips', label: 'Viajes', icon: Route, end: false },
    { to: '/admin/fuel', label: 'Combustible', icon: Fuel, end: false },
  ] },
  { label: 'ADMINISTRACIÓN', items: [
    { to: '/admin/vehicles', label: 'Vehículos', icon: Truck, end: false },
    { to: '/admin/users', label: 'Usuarios', icon: Users, end: false },
    { to: '/admin/branches', label: 'Sucursales', icon: Building2, end: false },
    { to: '/admin/locations', label: 'Ubicaciones', icon: MapPin, end: false },
    { to: '/admin/audit', label: 'Auditoría', icon: Shield, end: false },
  ] },
];

export function AdminShell({ name, email, onLogout, children }: { name?: string; email?: string; onLogout: () => void; children: ReactNode }) {
  const drawer = useRef<HTMLDialogElement>(null);
  const { pathname } = useLocation();
  const current = groups.flatMap(g => g.items).find(i => i.to === pathname)?.label || 'Detalle del viaje';
  useEffect(() => { drawer.current?.close(); }, [pathname]);
  const initials = (name || 'Administrador').split(' ').slice(0, 2).map(n => n[0]).join('');
  const navigation = <>
    <NavLink to="/admin" className="fleet-brand"><span className="fleet-brand-icon"><Truck size={23} /></span><span>fleet<span className="brand-light">ops</span><small>CONTROL DE TRANSPORTE</small></span></NavLink>
    <div className="workspace-label"><span className="workspace-mark"><Building2 size={17} /></span><span>Transporte corporativo<small>Panel de administración</small></span></div>
    <nav aria-label="Navegación principal" className="fleet-navigation">{groups.map(group => <div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map(item => <NavLink key={item.to} to={item.to} end={item.end} onClick={() => drawer.current?.close()} className={({ isActive }) => `fleet-nav-link ${isActive ? 'is-active' : ''}`}><item.icon size={19} /><span>{item.label}</span><ChevronRight className="nav-chevron" size={15} /></NavLink>)}</div>)}</nav>
    <div className="sidebar-account"><div className="account-avatar">{initials}</div><div className="account-info"><strong>{name || 'Administrador'}</strong><span title={email}>{email || 'Administración'}</span></div><button aria-label="Cerrar sesión" title="Cerrar sesión" onClick={onLogout}><LogOut size={18} /></button></div>
  </>;
  return <div className="admin-shell">
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    <aside className="fleet-sidebar">{navigation}</aside>
    <dialog className="mobile-drawer" ref={drawer} aria-label="Menú de navegación" onClick={e => { if (e.target === e.currentTarget) drawer.current?.close(); }}><div className="mobile-drawer-content"><button className="drawer-close" aria-label="Cerrar menú" onClick={() => drawer.current?.close()}><X size={22} /></button>{navigation}</div></dialog>
    <div className="admin-workspace"><header className="workspace-topbar"><div className="breadcrumb"><button className="mobile-menu" aria-label="Abrir menú" aria-haspopup="dialog" onClick={() => drawer.current?.showModal()}><Menu size={22} /></button><span>Operaciones</span><ChevronRight size={15} /><strong>{current}</strong></div><span className="topbar-role"><Shield size={15} /> Administrador</span></header><main id="main-content" className="admin-content" tabIndex={-1}>{children}</main><footer className="workspace-footer"><span>FleetOps</span><span>Control de transporte corporativo</span></footer></div>
  </div>;
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return <AdminShell name={user?.fullName} email={user?.email} onLogout={() => { logout(); navigate('/login'); }}><Outlet /></AdminShell>;
}
