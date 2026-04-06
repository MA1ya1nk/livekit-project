import { Link, useNavigate, useLocation } from 'react-router-dom';
import AppIcon from './AppIcon';

function ProfileIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function LogoutIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

const ADMIN_NAV_ITEMS = [
  { path: '/admin/working-hours', label: 'Working hours' },
  { path: '/admin/services', label: 'Services' },
  { path: '/admin/users', label: 'Users' },
  { path: '/admin/bookings', label: 'Bookings' },
];

const USER_NAV_ITEMS = [
  { path: '/dashboard', label: 'Book' },
  { path: '/dashboard/bookings', label: 'My Bookings' },
  { path: '/dashboard/voice-agent', label: 'Voice Agent' },
];

const SUPERADMIN_NAV_ITEMS = [
  { path: '/superadmin', label: 'Dashboard' },
  { path: '/superadmin/admins', label: 'Admins' },
  { path: '/superadmin/number-requests', label: 'Number requests' },
];

export default function AppNav({ appName, dashboardPath, onLogout, showAdminNav, showUserNav, showSuperAdminNav }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    onLogout();
    navigate('/login', { replace: true });
  };

  const navItems = showSuperAdminNav
    ? SUPERADMIN_NAV_ITEMS
    : showAdminNav
      ? ADMIN_NAV_ITEMS
      : showUserNav
        ? USER_NAV_ITEMS
        : null;

  return (
    <header className="sticky top-0 z-50 py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <nav className="grid grid-cols-[1fr_auto_1fr] items-center h-14 px-5 sm:px-6 rounded-2xl bg-[#fafaf8]/95 border border-[#e8e6e3] shadow-sm backdrop-blur-sm transition-shadow duration-200">
          <Link
            to={dashboardPath}
            className="flex items-center gap-2.5 text-[#1a1d21] no-underline hover:no-underline hover:text-[#15803d] transition-colors duration-150"
          >
            <AppIcon className="w-10 h-10" />
            <span className="text-lg font-semibold tracking-tight">{appName}</span>
          </Link>
          {navItems ? (
            <div className="hidden sm:flex items-center justify-center gap-8">
              {navItems.map(({ path, label }) => (
                <Link
                  key={path}
                  to={path}
                  className={`text-[15px] font-medium no-underline hover:no-underline transition-colors duration-150 ${
                    location.pathname === path
                      ? 'text-[#15803d]'
                      : 'text-[#1a1d21] hover:text-[#15803d]'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center justify-end gap-2">
            <Link
              to="/profile"
              className="flex items-center justify-center w-10 h-10 rounded-full text-[#1a1d21] hover:text-[#15803d] hover:no-underline transition-all duration-200"
              aria-label="Profile"
            >
              <ProfileIcon className="w-5 h-5" />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center w-10 h-10 rounded-full text-[#1a1d21] hover:text-red-600 transition-all duration-200"
              aria-label="Log out"
            >
              <LogoutIcon className="w-5 h-5" />
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}
