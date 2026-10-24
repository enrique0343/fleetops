import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import type { UserRole } from '../types';

// Landing route per role.
export function homeForRole(role?: UserRole): string {
  if (role === 'ADMIN' || role === 'DISPATCHER') return '/admin';
  if (role === 'REQUESTER') return '/request';
  return '/driver';
}

function Loading() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Cargando...</p>
      </div>
    </div>
  );
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  roles?: UserRole[];
}

export function ProtectedRoute({ children, requireAdmin = false, roles }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // ADMIN and DISPATCHER share the admin area.
  if (requireAdmin && user?.role !== 'ADMIN' && user?.role !== 'DISPATCHER') {
    return <Navigate to={homeForRole(user?.role)} replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return <>{children}</>;
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  if (isAuthenticated) return <Navigate to={homeForRole(user?.role)} replace />;

  return <>{children}</>;
}
