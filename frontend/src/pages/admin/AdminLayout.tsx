import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import {
  LayoutDashboard, Map, Fuel, Users, Building2, Truck,
  MapPin, LogOut, Menu, Shield, CalendarClock, Route as RouteIcon, CalendarDays, X
} from 'lucide-react';
import { useState } from 'react';

// Navegación agrupada por dominios (densidad ejecutiva, lectura de un vistazo)
const navSections: { title: string; items: { to: string; label: string; icon: any; end?: boolean }[] }[] = [
  {
    title: 'Operación',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/requests', label: 'Solicitudes', icon: CalendarClock },
      { to: '/admin/calendar', label: 'Agenda', icon: CalendarDays },
      { to: '/admin/routes', label: 'Rutas', icon: RouteIcon },
      { to: '/admin/trips', label: 'Viajes', icon: Map },
      { to: '/admin/fuel', label: 'Combustible', icon: Fuel },
    ],
  },
  {
    title: 'Catálogos',
    items: [
      { to: '/admin/users', label: 'Usuarios', icon: Users },
      { to: '/admin/branches', label: 'Sucursales', icon: Building2 },
      { to: '/admin/vehicles', label: 'Vehículos', icon: Truck },
      { to: '/admin/locations', label: 'Ubicaciones', icon: MapPin },
    ],
  },
  {
    title: 'Gobierno',
    items: [
      { to: '/admin/audit', label: 'Auditoría', icon: Shield },
    ],
  },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <>
      {/* Identidad */}
      <div className="px-5 pt-6 pb-5 border-b border-[#E5E5E5]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1A2B4A] rounded flex items-center justify-center shrink-0">
            <Truck className="w-4.5 h-4.5 w-[18px] h-[18px] text-white" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[#1A1A1A] font-bold text-sm leading-none tracking-tight">FleetOps</p>
            <p className="text-[#6B7280] text-[11px] mt-1 leading-none">Avante Complejo Hospitalario</p>
          </div>
        </div>
      </div>

      {/* Navegación agrupada */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {navSections.map(section => (
          <div key={section.title}>
            <p className="px-3 mb-1.5 text-[11px] font-medium uppercase text-[#6B7280]" style={{ letterSpacing: '0.08em' }}>
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    [
                      'relative flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors',
                      isActive
                        ? 'bg-[#EEF1F6] text-[#1A2B4A] font-semibold'
                        : 'text-[#4A4A4A] font-normal hover:bg-[#F4F4F4] hover:text-[#1A1A1A]',
                    ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Barra indicadora institucional del ítem activo */}
                      {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[#1A2B4A]" />}
                      <item.icon className="w-4 h-4 shrink-0" strokeWidth={isActive ? 2 : 1.6} />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Usuario y salida */}
      <div className="px-3 py-4 border-t border-[#E5E5E5]">
        <div className="flex items-center gap-2.5 px-3 mb-2">
          {user?.photoUrl ? (
            <img src={user.photoUrl} alt="" className="w-8 h-8 rounded object-cover border border-[#E5E5E5] shrink-0" />
          ) : (
            <span className="w-8 h-8 rounded bg-[#F4F4F4] text-[#4A4A4A] text-xs font-bold flex items-center justify-center shrink-0">
              {user?.fullName?.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs text-[#1A1A1A] font-medium truncate">{user?.fullName}</p>
            <p className="text-[11px] text-[#6B7280] truncate">
              {user?.role === 'DISPATCHER' ? 'Coordinación' : 'Administración'}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-[#A0322D] hover:bg-[#F7EBEA] transition-colors"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.6} />
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    // theme-light activa el sistema visual institucional claro en toda el área admin
    <div className="theme-light min-h-screen bg-[#FAFAFA] text-[#1A1A1A] flex">
      {/* Sidebar escritorio */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-[#E5E5E5] fixed h-screen">
        <SidebarContent />
      </aside>

      {/* Sidebar móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-backdrop-in" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white border-r border-[#E5E5E5] flex flex-col shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-3 p-1.5 text-[#6B7280] hover:text-[#1A1A1A]"
              aria-label="Cerrar menú"
            >
              <X className="w-4 h-4" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Contenido */}
      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen">
        {/* Barra superior móvil */}
        <header className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#E5E5E5] px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-[#4A4A4A] hover:text-[#1A1A1A] transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="w-5 h-5" strokeWidth={1.75} />
          </button>
          <span className="text-[#1A1A1A] font-semibold text-sm">FleetOps</span>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Pie institucional */}
        <footer className="px-4 lg:px-8 pb-5">
          <div className="max-w-7xl mx-auto border-t border-[#E5E5E5] pt-3">
            <p className="text-[11px] text-[#6B7280]">
              FleetOps · Avante Complejo Hospitalario · Inversiones Avante S.A. de C.V. · Uso interno
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
