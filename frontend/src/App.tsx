import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute';

// Auth
import LoginPage from './pages/auth/LoginPage';

// Driver
import DriverLayout from './pages/driver/DriverLayout';
import DriverTripPage from './pages/driver/DriverTripPage';
import DriverFuelPage from './pages/driver/DriverFuelPage';
import { DriverHistoryPage, DriverProfilePage } from './pages/driver/DriverOtherPages';

// Admin
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminTripsPage from './pages/admin/AdminTripsPage';
import AdminTripDetailPage from './pages/admin/AdminTripDetailPage';
import AdminFuelPage from './pages/admin/AdminFuelPage';
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

          {/* Driver Routes */}
          <Route path="/driver" element={<ProtectedRoute><DriverLayout /></ProtectedRoute>}>
            <Route index element={<DriverTripPage />} />
            <Route path="fuel" element={<DriverFuelPage />} />
            <Route path="history" element={<DriverHistoryPage />} />
            <Route path="profile" element={<DriverProfilePage />} />
          </Route>

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminLayout /></ProtectedRoute>}>
            <Route index element={<AdminDashboard />} />
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
