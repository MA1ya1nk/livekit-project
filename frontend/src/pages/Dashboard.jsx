import { useAuth } from '../contexts/AuthContext';
import AppNav from '../components/layout/AppNav';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-[#efece7]">
      <AppNav appName="Bookwise" dashboardPath="/dashboard" onLogout={logout} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
          <p className="text-[#1a1d21] text-lg md:text-xl font-medium text-center max-w-xl leading-relaxed">
            Manage <span className="text-[#15803d]">bookings</span>, maximise <span className="text-[#15803d]">revenue</span> and give your customers a reason to return.
          </p>
        </div>
      </main>
    </div>
  );
}
