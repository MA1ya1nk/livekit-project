import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMyBookings } from '../../api/users';
import { cancelBooking } from '../../api/bookings';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatSlotRange } from '../../utils/scheduleDisplay';
import { UserPageHeader, UserCard } from '../../components/user/UserPageLayout';

const MDASH = '\u2014';

function formatStatus(s) {
  if (!s) return MDASH;
  return String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase();
}

function formatAppointmentDate(isoStr) {
  if (isoStr == null || isoStr === '') return MDASH;
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return MDASH;
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return MDASH;
  }
}

function statusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'confirmed') return 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
  if (s === 'pending') return 'bg-amber-50 text-amber-900 border-amber-200/80';
  if (s === 'cancelled') return 'bg-slate-100 text-slate-600 border-slate-200/80';
  return 'bg-slate-50 text-slate-700 border-slate-200/80';
}

function formatPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return MDASH;
  return `$${amount.toFixed(2)}`;
}

const filterBtn =
  'px-4 py-2 text-sm font-medium rounded-lg transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#15803d]/30';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');

  const load = () => {
    setError('');
    setLoading(true);
    getMyBookings(statusFilter)
      .then((data) => setBookings(Array.isArray(data) ? data : []))
      .catch((err) => setError(getApiErrorMessage(err, 'Failed to load bookings.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const handleCancel = (id) => {
    setError('');
    setCancellingId(id);
    cancelBooking(id)
      .then(() => load())
      .catch((err) => setError(getApiErrorMessage(err, 'Failed to cancel booking.')))
      .finally(() => setCancellingId(null));
  };

  const canCancel = (b) =>
    b.status === 'pending' || b.status === 'confirmed' || !b.status;

  if (loading) {
    return (
      <div className="min-h-full flex flex-col gap-6">
        <UserPageHeader eyebrow="My account" title="My bookings" subtitle="Your appointments in one place." />
        <UserCard>
          <div className="p-10 flex items-center justify-center text-sm text-[#6b7280]">Loading...</div>
        </UserCard>
      </div>
    );
  }

  if (error && bookings.length === 0 && !loading) {
    return (
      <div className="min-h-full flex flex-col gap-6">
        <UserPageHeader eyebrow="My account" title="My bookings" subtitle="Your appointments in one place." />
        <UserCard>
          <div className="p-6 sm:p-8">
            <div className="mb-4 py-2.5 px-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm">
              {error}
            </div>
            <button
              type="button"
              onClick={load}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-[#15803d] rounded-xl hover:bg-[#166534] transition-colors"
            >
              Try again
            </button>
          </div>
        </UserCard>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col gap-6">
      <UserPageHeader eyebrow="My account" title="My bookings" subtitle="Your appointments in one place." />

      {error && (
        <div className="py-2.5 px-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm">{error}</div>
      )}

      <UserCard>
        <div className="px-5 sm:px-6 pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#f0eeeb]">
          <div>
            <h2 className="text-[15px] font-semibold text-[#1a1d21]">List</h2>
            <p className="text-sm text-[#6b7280] mt-0.5">Active or cancelled</p>
          </div>
          <div className="inline-flex p-1 rounded-xl bg-[#fafaf9] border border-[#ebe8e3] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`${filterBtn} ${
                statusFilter === 'active'
                  ? 'bg-white text-[#1a1d21] border-[#e5e2dd] shadow-sm'
                  : 'border-transparent text-[#6b7280] hover:text-[#1a1d21]'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('cancelled')}
              className={`${filterBtn} ${
                statusFilter === 'cancelled'
                  ? 'bg-white text-[#1a1d21] border-[#e5e2dd] shadow-sm'
                  : 'border-transparent text-[#6b7280] hover:text-[#1a1d21]'
              }`}
            >
              Cancelled
            </button>
          </div>
        </div>

        {bookings.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[#5c636a] text-[15px] mb-5">
              {statusFilter === 'cancelled' ? 'No cancelled bookings.' : 'No active bookings yet.'}
            </p>
            {statusFilter === 'active' && (
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-[#15803d] rounded-xl hover:bg-[#166534] transition-colors no-underline"
              >
                Book a slot
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#f0eeeb] bg-[#fafaf9]/80">
                    <th className="px-5 py-3 font-medium text-[#6b7280] text-xs uppercase tracking-wide">Service</th>
                    <th className="px-5 py-3 font-medium text-[#6b7280] text-xs uppercase tracking-wide min-w-[200px]">
                      When
                    </th>
                    <th className="px-5 py-3 font-medium text-[#6b7280] text-xs uppercase tracking-wide whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-5 py-3 w-24" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((row) => (
                    <tr key={row.id} className="border-b border-[#f0eeeb] last:border-0 hover:bg-[#fafaf9]/50">
                      <td className="px-5 py-4 align-top">
                        <p className="font-medium text-[#1a1d21]">
                          {row.service_name ?? (row.service_id != null ? `Service #${row.service_id}` : MDASH)}
                        </p>
                        <p className="text-xs text-[#9ca3af] mt-0.5">{formatPrice(row.service_price)}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        <p className="font-medium text-[#1a1d21]">{formatAppointmentDate(row.start_time)}</p>
                        <p className="text-sm text-[#6b7280] mt-0.5">
                          {formatSlotRange(row.start_time, row.end_time)}
                        </p>
                      </td>
                      <td className="px-5 py-4 align-top whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${statusBadgeClass(row.status)}`}
                        >
                          {formatStatus(row.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top text-right whitespace-nowrap">
                        {canCancel(row) ? (
                          <button
                            type="button"
                            onClick={() => handleCancel(row.id)}
                            disabled={cancellingId === row.id}
                            className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-60"
                          >
                            {cancellingId === row.id ? 'Cancelling...' : 'Cancel'}
                          </button>
                        ) : (
                          <span className="text-sm text-[#d1d5db]">{MDASH}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="md:hidden divide-y divide-[#f0eeeb]">
              {bookings.map((row) => (
                <li key={row.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-[#1a1d21] truncate">
                        {row.service_name ?? (row.service_id != null ? `Service #${row.service_id}` : MDASH)}
                      </p>
                      <p className="text-xs text-[#9ca3af] mt-0.5">{formatPrice(row.service_price)}</p>
                      <p className="text-sm text-[#1a1d21] mt-2">{formatAppointmentDate(row.start_time)}</p>
                      <p className="text-sm text-[#6b7280]">{formatSlotRange(row.start_time, row.end_time)}</p>
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium border ${statusBadgeClass(row.status)}`}
                    >
                      {formatStatus(row.status)}
                    </span>
                  </div>
                  {canCancel(row) && (
                    <button
                      type="button"
                      onClick={() => handleCancel(row.id)}
                      disabled={cancellingId === row.id}
                      className="mt-3 text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-60"
                    >
                      {cancellingId === row.id ? 'Cancelling...' : 'Cancel booking'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </UserCard>
    </div>
  );
}
