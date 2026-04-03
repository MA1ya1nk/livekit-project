import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin } from '../../utils/roles';
import AppNav from './AppNav';
import AppIcon from './AppIcon';

const navLinks = [
  { label: 'Solutions', href: '#solutions' },
  { label: 'Platform', href: '#platform' },
  { label: 'Company', href: '#company' },
  { label: 'Pricing', href: '#pricing' },
];

export default function Header() {
  const { user, loading, logout } = useAuth();

  if (!loading && user) {
    const dashboardPath =
      isSuperAdmin(user.role) ? '/superadmin'
        : user.role === 'admin' ? '/admin'
          : '/dashboard';
    const showSuperAdminNav = isSuperAdmin(user.role);
    const showAdminNav = user.role === 'admin';
    const showUserNav = user.role !== 'admin' && !isSuperAdmin(user.role);
    return (
      <AppNav
        appName="Bookwise"
        dashboardPath={dashboardPath}
        onLogout={logout}
        showSuperAdminNav={showSuperAdminNav}
        showAdminNav={showAdminNav}
        showUserNav={showUserNav}
      />
    );
  }

  return (
    <header className="sticky top-0 z-50 py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <nav className="flex items-center justify-between h-14 px-5 sm:px-6 rounded-2xl bg-[#fafaf8]/95 border border-[#e8e6e3] shadow-sm backdrop-blur-sm transition-shadow duration-200">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-[#1a1d21] no-underline hover:no-underline hover:text-[#15803d] transition-colors duration-150"
          >
            <AppIcon className="w-10 h-10" />
            <span className="text-lg font-semibold tracking-tight">Bookwise</span>
          </Link>
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="text-[15px] font-medium text-[#1a1d21] hover:text-[#15803d] no-underline hover:no-underline transition-colors duration-150"
              >
                {label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-[15px] font-medium text-[#15803d] hover:text-[#166534] no-underline hover:no-underline transition-colors duration-150"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="inline-flex items-center justify-center py-2.5 px-5 text-[15px] font-semibold text-white bg-[#15803d] rounded-lg hover:bg-[#166534] no-underline hover:no-underline transition-all duration-150"
            >
              Get a Demo
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
