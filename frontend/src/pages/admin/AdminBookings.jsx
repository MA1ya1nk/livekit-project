import { useState, useEffect } from 'react';
import { getBookings } from '../../api/admin/bookings';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatSlotRange } from '../../utils/scheduleDisplay';
import { AdminPageHeader, AdminCard } from '../../components/admin/AdminPageLayout';

function formatStatus(s) {
  if (!s) return '—';
  return String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase();
}

function formatPrice(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return `$${amount.toFixed(2)}`;
}

function formatAppointmentDate(isoStr) {
  if (isoStr == null || isoStr === '') return '—';
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function statusBadgeClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'confirmed') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (s === 'pending') return 'bg-amber-50 text-amber-900 border-amber-200';
  if (s === 'cancelled') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

function customerLabel(row) {
  if (row.customer_name) return row.customer_name;
  if (row.guest_phone) return row.guest_phone;
  if (row.user_id != null) return `User #${row.user_id}`;
  return '—';
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    getBookings()
      .then((data) => {
        if (cancelled) return;
        setBookings(Array.isArray(data) ? data : data?.bookings ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'Failed to load bookings.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-full">
        <AdminPageHeader title="Bookings" subtitle="All appointments for your business." />
        <AdminCard>
          <div className="p-8 flex items-center justify-center text-[#2d3238]">Loading…</div>
        </AdminCard>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-full">
        <AdminPageHeader title="Bookings" subtitle="All appointments for your business." />
        <AdminCard>
          <div className="p-6 sm:p-8">
            <div className="p-4 rounded-xl bg-red-50/80 text-red-700 border border-red-200/80 text-sm">{error}</div>
          </div>
        </AdminCard>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <AdminPageHeader title="Bookings" subtitle="All appointments for your business." />
      <AdminCard>
        {bookings.length === 0 ? (
          <div className="p-8 text-center text-[#2d3238]">No bookings yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#e8e6e3] bg-[#efece7]/80">
                  <th className="px-5 py-3.5 font-semibold text-[#1a1d21]">Service</th>
                  <th className="px-5 py-3.5 font-semibold text-[#1a1d21]">Customer</th>
                  <th className="px-5 py-3.5 font-semibold text-[#1a1d21] min-w-[200px]">Appointment</th>
                  <th className="px-5 py-3.5 font-semibold text-[#1a1d21] whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((row, i) => (
                  <tr
                    key={row.id ?? i}
                    className="border-b border-[#e8e6e3]/80 last:border-0 hover:bg-[#fafaf8] transition-colors"
                  >
                    <td className="px-5 py-4 align-top">
                      <p className="font-medium text-[#1a1d21]">
                        {row.service_name ?? (row.service_id != null ? `Service #${row.service_id}` : '—')}
                      </p>
                      <p className="text-xs text-[#6b7280] mt-0.5">{formatPrice(row.service_price)}</p>
                    </td>
                    <td className="px-5 py-4 align-top text-[#1a1d21]">
                      <p className="font-medium">{customerLabel(row)}</p>
                    </td>
                    <td className="px-5 py-4 align-top text-[#1a1d21]">
                      <p className="font-medium">{formatAppointmentDate(row.start_time)}</p>
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
