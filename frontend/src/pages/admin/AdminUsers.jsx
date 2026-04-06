import { useState, useEffect } from 'react';
import { getUsers } from '../../api/admin/users';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { AdminPageHeader, AdminCard } from '../../components/admin/AdminPageLayout';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    getUsers()
      .then((data) => {
        if (cancelled) return;
        setUsers(Array.isArray(data) ? data : data?.users ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'Failed to load users.'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="min-h-full">
        <AdminPageHeader title="Users" subtitle="Users in your business." />
        <AdminCard>
          <div className="p-8 flex items-center justify-center text-[#2d3238]">Loading…</div>
        </AdminCard>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full">
        <AdminPageHeader title="Users" subtitle="Users in your business." />
        <AdminCard>
          <div className="p-6 sm:p-8">
            <div className="p-4 rounded-xl bg-red-50/80 text-red-700 border border-red-200/80 text-sm">{error}</div>
          </div>
        </AdminCard>
      </div>
    );
  }

  const hiddenKeys = /^(password|hashed|token|id|tenant_id|twilio_phone_number)$/i;
  const preferredOrder = [
    'email',
    'full_name',
    'role',
    'is_active',
    'tenant_name',
  ];
  const allKeys = users.length
    ? [...new Set(users.flatMap((u) => Object.keys(u)))]
    : [];
  const displayKeys = allKeys
    .filter((k) => !hiddenKeys.test(k))
    .sort((a, b) => {
      const ai = preferredOrder.indexOf(a);
      const bi = preferredOrder.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });

  const getColumnLabel = (key) =>
    key === 'tenant_name' ? 'Business name' : key.replace(/_/g, ' ');

  const getCellValue = (row, key) => {
    if (row[key] !== undefined && row[key] !== null) return row[key];
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    return row[camel];
  };

  return (
    <div className="min-h-full">
      <AdminPageHeader title="Users" subtitle="Users in your business." />
      <AdminCard>
        {users.length === 0 ? (
          <div className="p-8 text-center text-[#2d3238]">No users yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#e8e6e3] bg-[#efece7]/80">
                  <th className="px-5 py-4 font-semibold text-[#1a1d21]">#</th>
                  {displayKeys.map((key) => (
                    <th key={key} className="px-5 py-4 font-semibold text-[#1a1d21] capitalize">
                      {getColumnLabel(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((row, i) => (
                  <tr
                    key={row.id ?? i}
                    className="border-b border-[#e8e6e3]/80 last:border-0 hover:bg-[#efece7]/60 transition-colors"
                  >
                    <td className="px-5 py-4 text-[#1a1d21] tabular-nums">
                      {i + 1}
                    </td>
                    {displayKeys.map((key) => {
                      const val = getCellValue(row, key);
                      return (
                        <td key={key} className="px-5 py-4 text-[#1a1d21]">
                          {typeof val === 'object' && val !== null
                            ? JSON.stringify(val)
                            : String(val ?? '—')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
