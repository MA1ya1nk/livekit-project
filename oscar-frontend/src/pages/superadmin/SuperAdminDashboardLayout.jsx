import { Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AppNav from '../../components/layout/AppNav';

export default function SuperAdminDashboardLayout() {
  const { logout } = useAuth();

  return (
    <div className="h-full min-h-screen min-h-[100dvh] flex flex-col bg-[#efece7]">
      <AppNav
        appName="Bookwise"
        dashboardPath="/superadmin"
        onLogout={logout}
        showSuperAdminNav
      />
      <main className="flex-1 min-h-0 overflow-auto flex flex-col">
        <div className="p-5 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full flex flex-col flex-1 min-h-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
