import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { Map, Fuel, ClipboardList, LogOut, User } from 'lucide-react';

export default function DriverLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col max-w-md mx-auto relative">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">FO</span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-none">FleetOps</p>
            <p className="text-slate-500 text-xs leading-none mt-0.5">{user?.fullName?.split(' ')[0]}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-slate-400 hover:text-red-400 transition-colors p-2"
          title="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 px-4 pb-safe">
        <div className="flex items-center justify-around py-2">
          <NavItem to="/driver" icon={<Map className="w-5 h-5" />} label="Viaje" end />
          <NavItem to="/driver/fuel" icon={<Fuel className="w-5 h-5" />} label="Combustible" />
          <NavItem to="/driver/history" icon={<ClipboardList className="w-5 h-5" />} label="Historial" />
          <NavItem to="/driver/profile" icon={<User className="w-5 h-5" />} label="Perfil" />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label, end }: { to: string; icon: React.ReactNode; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
          isActive
            ? 'text-blue-400 bg-blue-950/50'
            : 'text-slate-500 hover:text-slate-300'
        }`
      }
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </NavLink>
  );
}
