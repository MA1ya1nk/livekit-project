import { useState, useEffect } from 'react';
import { listAdmins } from '../../api/superadmin';
import { listNumberRequests } from '../../api/superadmin';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { SuperAdminPageHeader, SuperAdminCard } from '../../components/superadmin/SuperAdminPageLayout';
import { Link } from 'react-router-dom';

function AdminsIcon() {
  return (
    <svg className="w-5 h-5 text-[#15803d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="w-5 h-5 text-[#15803d]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function StatCard({ title, value, loading, icon: Icon, to }) {
  const content = (
    <div className="p-6 rounded-2xl bg-[#fafaf8] shadow-sm ring-1 ring-[#e8e6e3]/60 h-full flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#2d3238] mb-0.5">{title}</p>
          <p className="text-2xl font-semibold text-[#1a1d21] tabular-nums">
            {loading ? '—' : value}
          </p>
        </div>
        {Icon && <Icon />}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block h-full no-underline text-inherit hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }
  return content;
}

export default function SuperAdminDashboard() {
  const [adminsCount, setAdminsCount] = useState(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listAdmins().then((d) => (Array.isArray(d) ? d : [])).catch(() => []),
      listNumberRequests('requested').then((d) => (Array.isArray(d) ? d : [])).catch(() => []),
    ])
      .then(([admins, pending]) => {
        if (cancelled) return;
        setAdminsCount(admins.length);
        setPendingRequestsCount(pending.length);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'Failed to load stats.'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <SuperAdminPageHeader
        title="Super Admin"
        subtitle="Manage admins and number requests."
      />
      {error && (
        <div className="mb-5 py-3 px-4 rounded-xl bg-red-50/80 text-red-700 text-sm shrink-0">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          title="Admins"
          value={adminsCount ?? '—'}
          loading={loading}
          icon={AdminsIcon}
          to="/superadmin/admins"
        />
        <StatCard
          title="Pending number requests"
          value={pendingRequestsCount ?? '—'}
          loading={loading}
          icon={PhoneIcon}
          to="/superadmin/number-requests"
        />
      </div>
    </div>
  );
}
