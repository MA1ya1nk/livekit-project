import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

function ProfileIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

export default function ProfileDropdown({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    onLogout();
    setOpen(false);
    navigate('/login', { replace: true });
  };

  const dashboardPath = user?.role === 'admin' ? '/admin' : '/dashboard';
  const dashboardLabel = user?.role === 'admin' ? 'Admin' : 'Dashboard';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-[#1a1d21] text-white hover:bg-[#2d3238] transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[#1a1d21]/30 focus:ring-offset-2"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <ProfileIcon />
      </button>
      <div
        className={`absolute right-0 top-full mt-2 w-72 rounded-xl bg-[#fafaf8] border border-[#e8e6e3] shadow-lg overflow-hidden transition-all duration-200 ease-out origin-top ${
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
      >
        <div className="p-4 border-b border-[#e8e6e3]">
          <p className="text-sm font-semibold text-[#1a1d21] truncate">
            {user?.full_name || 'User'}
          </p>
          <p className="text-sm text-[#5c6370] truncate mt-0.5">{user?.email}</p>
          {user?.role && (
            <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded-md bg-[#e8e6e3] text-[#2d3238] capitalize">
              {user.role}
            </span>
          )}
        </div>
        <div className="py-1">
          <Link
            to={dashboardPath}
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm font-medium text-[#1a1d21] hover:bg-[#efece7] transition-colors duration-150"
          >
            {dashboardLabel}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors duration-150"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
