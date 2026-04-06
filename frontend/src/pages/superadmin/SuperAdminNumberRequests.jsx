import { useState, useEffect } from 'react';
import { listNumberRequests, assignNumberToRequest } from '../../api/superadmin';
import { getApiErrorMessage } from '../../utils/apiErrors';
import {
  SuperAdminPageHeader,
  SuperAdminCard,
} from '../../components/superadmin/SuperAdminPageLayout';

const STATUS_OPTIONS = [
  { value: 'requested', label: 'Pending (requested)' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'rejected', label: 'Rejected' },
];

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export default function SuperAdminNumberRequests() {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('requested');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assigningId, setAssigningId] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [assignPhone, setAssignPhone] = useState('');
  const [assignError, setAssignError] = useState('');

  const fetchRequests = () => {
    setError('');
    listNumberRequests(statusFilter)
      .then((data) => setRequests(Array.isArray(data) ? data : []))
      .catch((err) => setError(getApiErrorMessage(err, 'Failed to load number requests.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listNumberRequests(statusFilter)
      .then((data) => {
        if (!cancelled) setRequests(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'Failed to load number requests.'));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [statusFilter]);

  const openAssignModal = (request) => {
    setAssignModal(request);
    setAssignPhone('');
    setAssignError('');
  };

  const closeAssignModal = () => {
    setAssignModal(null);
    setAssignPhone('');
    setAssignError('');
  };

  const handleAssign = () => {
    if (!assignModal || !assignPhone.trim()) {
      setAssignError('Enter a phone number.');
      return;
    }
    setAssigningId(assignModal.id);
    setAssignError('');
    assignNumberToRequest(assignModal.id, assignPhone.trim())
      .then(() => {
        closeAssignModal();
        fetchRequests();
      })
      .catch((err) => setAssignError(getApiErrorMessage(err, 'Failed to assign number.')))
      .finally(() => setAssigningId(null));
  };

  return (
    <div className="min-h-full">
      <SuperAdminPageHeader
        title="Number requests"
        subtitle="View and assign Twilio numbers to pending requests."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-[#2d3238]">Status</label>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[#e8e6e3] bg-[#fafaf8] px-3 py-2 text-sm text-[#1a1d21] focus:outline-none focus:ring-2 focus:ring-[#15803d]/50"
        >
          {STATUS_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
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
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-[#2d3238]">No requests found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#e8e6e3] bg-[#efece7]/80">
                  <th className="px-5 py-4 font-semibold text-[#1a1d21]">ID</th>
                  <th className="px-5 py-4 font-semibold text-[#1a1d21]">Tenant</th>
                  <th className="px-5 py-4 font-semibold text-[#1a1d21]">Status</th>
                  <th className="px-5 py-4 font-semibold text-[#1a1d21]">Requested at</th>
                  {statusFilter === 'requested' && (
                    <th className="px-5 py-4 font-semibold text-[#1a1d21]">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {requests.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[#e8e6e3]/80 last:border-0 hover:bg-[#efece7]/60 transition-colors"
                  >
                    <td className="px-5 py-4 text-[#1a1d21]">{row.id}</td>
                    <td className="px-5 py-4 text-[#1a1d21]">{row.tenant_name ?? '—'}</td>
                    <td className="px-5 py-4 text-[#1a1d21] capitalize">{row.status ?? '—'}</td>
                    <td className="px-5 py-4 text-[#1a1d21]">{formatDate(row.requested_at)}</td>
                    {statusFilter === 'requested' && (
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => openAssignModal(row)}
                          className="text-sm font-medium text-[#15803d] hover:text-[#166534]"
                        >
                          Assign number
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SuperAdminCard>

      {assignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-[#fafaf8] shadow-xl ring-1 ring-[#e8e6e3] p-6">
            <h3 className="text-lg font-semibold text-[#1a1d21] mb-1">Assign number</h3>
            <p className="text-sm text-[#2d3238] mb-4">
              Tenant: <strong>{assignModal.tenant_name}</strong>
            </p>
            <input
              type="text"
              value={assignPhone}
              onChange={(e) => setAssignPhone(e.target.value)}
              placeholder="+1234567890"
              className="w-full rounded-lg border border-[#e8e6e3] bg-white px-3 py-2 text-[#1a1d21] placeholder:text-[#2d3238]/60 focus:outline-none focus:ring-2 focus:ring-[#15803d]/50 mb-3"
            />
            {assignError && (
              <p className="text-sm text-red-600 mb-3">{assignError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeAssignModal}
                className="px-4 py-2 text-sm font-medium text-[#2d3238] hover:bg-[#efece7] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={assigningId !== null}
                className="px-4 py-2 text-sm font-medium text-white bg-[#15803d] hover:bg-[#166534] rounded-lg disabled:opacity-50 transition-colors"
              >
                {assigningId !== null ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
