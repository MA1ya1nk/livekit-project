import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { isSuperAdmin } from './utils/roles';
import AuthLayout from './components/auth/AuthLayout';
import { Login, Signup, ForgotPassword, ResetPassword } from './pages/auth';
import Home from './pages/Home';
import Profile from './pages/Profile';
import {
  UserDashboardLayout,
  BookSlot,
  MyBookings,
  VoiceAssistant,
} from './pages/dashboard/index';
import {
  AdminDashboard,
  AdminDashboardLayout,
  AdminWorkingHours,
  AdminServices,
  AdminUsers,
  AdminBookings,
} from './pages/admin';
import {
  SuperAdminDashboard,
  SuperAdminDashboardLayout,
  SuperAdminAdmins,
  SuperAdminNumberRequests,
} from './pages/superadmin';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-full min-h-screen min-h-[100dvh] flex flex-col bg-[#efece7]">
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-[#2d3238]">Loading…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/** Admin-only: redirects non-admins to user dashboard. */
function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-full min-h-screen min-h-[100dvh] flex flex-col bg-[#efece7]">
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-[#2d3238]">Loading…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

/** Super admin-only: redirects non-superadmins to dashboard. */
function SuperAdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-full min-h-screen min-h-[100dvh] flex flex-col bg-[#efece7]">
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-[#2d3238]">Loading…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isSuperAdmin(user.role)) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  // Show form immediately; only redirect when we know user is logged in
  if (!loading && user) {
    const to = isSuperAdmin(user.role) ? '/superadmin' : user.role === 'admin' ? '/admin' : '/dashboard';
    return <Navigate to={to} replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <UserDashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<BookSlot />} />
        <Route path="bookings" element={<MyBookings />} />
        <Route path="voice-agent" element={<VoiceAssistant />} />
      </Route>
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboardLayout />
          </AdminRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="working-hours" element={<AdminWorkingHours />} />
        <Route path="services" element={<AdminServices />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="bookings" element={<AdminBookings />} />
      </Route>
      <Route
        path="/superadmin"
        element={
          <SuperAdminRoute>
            <SuperAdminDashboardLayout />
          </SuperAdminRoute>
        }
      >
        <Route index element={<SuperAdminDashboard />} />
        <Route path="admins" element={<SuperAdminAdmins />} />
        <Route path="number-requests" element={<SuperAdminNumberRequests />} />
      </Route>
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/" element={<Home />} />
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
