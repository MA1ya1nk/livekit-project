import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin } from '../../utils/roles';
import AppNav from '../../components/layout/AppNav';

const tabClass =
  'flex-1 text-center py-2.5 text-sm font-medium rounded-lg transition-colors no-underline';

export default function UserDashboardLayout() {
  const { user, logout } = useAuth();

  if (isSuperAdmin(user?.role)) return <Navigate to="/superadmin" replace />;
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;

  return (
    <div className="h-full min-h-screen min-h-[100dvh] flex flex-col bg-[#ebe8e3]">
      <AppNav
        appName="Bookwise"
        dashboardPath="/dashboard"
        onLogout={logout}
        showUserNav={user?.role !== 'admin'}
      />
      {/* Mobile: primary navigation (desktop links live in AppNav) */}
      <div className="sm:hidden px-4 -mt-1 pb-3">
        <div className="flex p-1 rounded-xl bg-white/90 border border-[#e5e2dd] shadow-sm">
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              `${tabClass} ${isActive ? 'bg-[#15803d] text-white shadow-sm' : 'text-[#5c636a] hover:text-[#1a1d21]'}`
            }
          >
            Book
          </NavLink>
          <NavLink
            to="/dashboard/bookings"
            className={({ isActive }) =>
              `${tabClass} ${isActive ? 'bg-[#15803d] text-white shadow-sm' : 'text-[#5c636a] hover:text-[#1a1d21]'}`
            }
          >
            My bookings
          </NavLink>
        </div>
      </div>
      <main className="flex-1 min-h-0 overflow-auto flex flex-col">
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full flex flex-col flex-1 min-h-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
