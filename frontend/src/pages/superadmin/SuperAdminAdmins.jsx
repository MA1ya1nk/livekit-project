import { useState, useEffect } from 'react';
import { listAdmins, deactivateAdmin, activateAdmin } from '../../api/superadmin';
import { getApiErrorMessage } from '../../utils/apiErrors';
import {
  SuperAdminPageHeader,
  SuperAdminCard,
} from '../../components/superadmin/SuperAdminPageLayout';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function SuperAdminAdmins() {
  const [admins, setAdmins] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const fetchAdmins = () => {
    setError('');
    const filter = statusFilter || null;
    listAdmins(filter)
      .then((data) => setAdmins(Array.isArray(data) ? data : []))
      .catch((err) => setError(getApiErrorMessage(err, 'Failed to load admins.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const filter = statusFilter || null;
    listAdmins(filter)
      .then((data) => {
        if (!cancelled) setAdmins(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'Failed to load admins.'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [statusFilter]);

  const handleDeactivate = (adminId) => {
    setActionLoading(adminId);
    deactivateAdmin(adminId)
      .then(() => fetchAdmins())
      .catch((err) => setError(getApiErrorMessage(err, 'Failed to deactivate.')))
      .finally(() => setActionLoading(null));
  };

  const handleActivate = (adminId) => {
    setActionLoading(adminId);
    activateAdmin(adminId)
      .then(() => fetchAdmins())
      .catch((err) => setError(getApiErrorMessage(err, 'Failed to activate.')))
      .finally(() => setActionLoading(null));
  };

  return (
    <div className="min-h-full">
      <SuperAdminPageHeader
        title="Admins"
        subtitle="List all admins with tenant. Filter by active or inactive."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-[#2d3238]">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[#e8e6e3] bg-[#fafaf8] px-3 py-2 text-sm text-[#1a1d21] focus:outline-none focus:ring-2 focus:ring-[#15803d]/50"
        >
          {STATUS_OPTIONS.map(({ value, label }) => (
            <option key={value || 'all'} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-5 py-3 px-4 rounded-xl bg-red-50/80 text-red-700 text-sm">
          {error}
        </div>
      )}

      <SuperAdminCard>
        {loading ? (
          <div className="p-8 flex items-center justify-center text-[#2d3238]">Loading…</div>
        ) : admins.length === 0 ? (
          <div className="p-8 text-center text-[#2d3238]">No admins found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#e8e6e3] bg-[#efece7]/80">
                  <th className="px-5 py-4 font-semibold text-[#1a1d21]">Email</th>
                  <th className="px-5 py-4 font-semibold text-[#1a1d21]">Full name</th>
                  <th className="px-5 py-4 font-semibold text-[#1a1d21]">Tenant</th>
                  <th className="px-5 py-4 font-semibold text-[#1a1d21]">Admin</th>
                  <th className="px-5 py-4 font-semibold text-[#1a1d21]">Tenant active</th>
                  <th className="px-5 py-4 font-semibold text-[#1a1d21]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[#e8e6e3]/80 last:border-0 hover:bg-[#efece7]/60 transition-colors"
                  >
                    <td className="px-5 py-4 text-[#1a1d21]">{row.email ?? '—'}</td>
                    <td className="px-5 py-4 text-[#1a1d21]">{row.full_name ?? '—'}</td>
                    <td className="px-5 py-4 text-[#1a1d21]">{row.tenant_name ?? '—'}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          row.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {row.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          row.tenant_is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {row.tenant_is_active ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {row.is_active ? (
                        <button
                          type="button"
                          onClick={() => handleDeactivate(row.id)}
                          disabled={actionLoading === row.id}
                          className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          {actionLoading === row.id ? '…' : 'Deactivate'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleActivate(row.id)}
                          disabled={actionLoading === row.id}
                          className="text-sm font-medium text-[#15803d] hover:text-[#166534] disabled:opacity-50"
                        >
                          {actionLoading === row.id ? '…' : 'Activate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SuperAdminCard>
    </div>
  );
}
