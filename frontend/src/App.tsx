import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute';

// Auth
import LoginPage from './pages/auth/LoginPage';

// Public (sin login)
import PublicRequestPage from './pages/public/PublicRequestPage';

// Driver
import DriverLayout from './pages/driver/DriverLayout';
import DriverTripPage from './pages/driver/DriverTripPage';
import DriverFuelPage from './pages/driver/DriverFuelPage';
import DriverAppointmentsPage from './pages/driver/DriverAppointmentsPage';
import { DriverHistoryPage, DriverProfilePage } from './pages/driver/DriverOtherPages';

// Requester
import RequesterLayout from './pages/request/RequesterLayout';
import RequestFormPage from './pages/request/RequestFormPage';
import MyRequestsPage from './pages/request/MyRequestsPage';

// Admin
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminTripsPage from './pages/admin/AdminTripsPage';
import AdminTripDetailPage from './pages/admin/AdminTripDetailPage';
import AdminFuelPage from './pages/admin/AdminFuelPage';
import AdminRequestsPage from './pages/admin/AdminRequestsPage';
import AdminRoutesPage from './pages/admin/AdminRoutesPage';
import AdminCalendarPage from './pages/admin/AdminCalendarPage';
import {
  AdminUsersPage,
  AdminLocationsPage,
  AdminVehiclesPage,
  AdminBranchesPage,
  AdminAuditPage,
} from './pages/admin/AdminCatalogsPages';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

          {/* Formulario público de solicitudes (sin cuenta, vía enlace con token) */}
          <Route path="/solicitar/:token" element={<PublicRequestPage />} />

          {/* Driver Routes */}
          <Route path="/driver" element={<ProtectedRoute><DriverLayout /></ProtectedRoute>}>
            <Route index element={<DriverTripPage />} />
            <Route path="appointments" element={<DriverAppointmentsPage />} />
            <Route path="fuel" element={<DriverFuelPage />} />
            <Route path="history" element={<DriverHistoryPage />} />
            <Route path="profile" element={<DriverProfilePage />} />
          </Route>

          {/* Requester Routes */}
          <Route path="/request" element={<ProtectedRoute roles={['REQUESTER', 'ADMIN', 'DISPATCHER']}><RequesterLayout /></ProtectedRoute>}>
            <Route index element={<RequestFormPage />} />
            <Route path="mine" element={<MyRequestsPage />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminLayout /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
            <Route path="requests" element={<AdminRequestsPage />} />
            <Route path="calendar" element={<AdminCalendarPage />} />
            <Route path="routes" element={<AdminRoutesPage />} />
            <Route path="trips" element={<AdminTripsPage />} />
            <Route path="trips/:tripId" element={<AdminTripDetailPage />} />
            <Route path="fuel" element={<AdminFuelPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="locations" element={<AdminLocationsPage />} />
            <Route path="vehicles" element={<AdminVehiclesPage />} />
            <Route path="branches" element={<AdminBranchesPage />} />
            <Route path="audit" element={<AdminAuditPage />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
