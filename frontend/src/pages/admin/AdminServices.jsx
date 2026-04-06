import { useState, useEffect } from 'react';
import {
  getServices,
  createService,
  getService,
  updateService,
  deleteService,
} from '../../api/admin/services';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { AdminPageHeader, AdminCard } from '../../components/admin/AdminPageLayout';
import { useAuth } from '../../contexts/AuthContext';
import { parseTime24To12Parts, buildTime24From12Parts } from '../../utils/time12h';

const SLOT_DURATION_OPTIONS = [15, 30, 60];

function EditIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function TrashIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

export default function AdminServices() {
  const { user, refreshUser } = useAuth();
  const tenantDefaultServiceId = user?.default_service_id ?? null;
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formTab, setFormTab] = useState('basic');
  const [editId, setEditId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formManagedBy, setFormManagedBy] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDuration, setFormDuration] = useState('');
  const [formMaxBookings, setFormMaxBookings] = useState('');
  const [formAvailableFromTime, setFormAvailableFromTime] = useState('');
  const [formAvailableToTime, setFormAvailableToTime] = useState('');
  const [formAvailableFromHour12, setFormAvailableFromHour12] = useState('');
  const [formAvailableFromMinute, setFormAvailableFromMinute] = useState('00');
  const [formAvailableFromPeriod, setFormAvailableFromPeriod] = useState('AM');
  const [formAvailableToHour12, setFormAvailableToHour12] = useState('');
  const [formAvailableToMinute, setFormAvailableToMinute] = useState('00');
  const [formAvailableToPeriod, setFormAvailableToPeriod] = useState('PM');
  const [formMakeDefault, setFormMakeDefault] = useState(false);

  const load = () => {
    setError('');
    setLoading(true);
    getServices()
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch((err) => setError(getApiErrorMessage(err, 'Failed to load services.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditId(null);
    setFormName('');
    setFormManagedBy('');
    setFormDescription('');
    setFormPrice('');
    setFormDuration('');
    setFormMaxBookings('');
    setFormAvailableFromTime('');
    setFormAvailableToTime('');
    setFormAvailableFromHour12('');
    setFormAvailableFromMinute('00');
    setFormAvailableFromPeriod('AM');
    setFormAvailableToHour12('');
    setFormAvailableToMinute('00');
    setFormAvailableToPeriod('PM');
    setFormMakeDefault(false);
    setFormTab('basic');
    setFormOpen(true);
  };

  const openEdit = async (id) => {
    setError('');
    try {
      const svc = await getService(id);
      setEditId(id);
      setFormName(svc.name ?? '');
      setFormManagedBy(svc.managed_by ?? '');
      setFormDescription(svc.description ?? '');
      setFormPrice(String(svc.price ?? 0));
      setFormDuration([15, 30, 45, 60].includes(svc.slot_duration_minutes) ? svc.slot_duration_minutes : 30);
      setFormMaxBookings(Number.isInteger(svc.max_bookings_per_user_per_day) ? svc.max_bookings_per_user_per_day : 2);
      const from24 = String(svc.available_from_time ?? '09:00').slice(0, 5);
      const to24 = String(svc.available_to_time ?? '17:00').slice(0, 5);
      const fromParts = parseTime24To12Parts(from24);
      const toParts = parseTime24To12Parts(to24);
      setFormAvailableFromTime(from24);
      setFormAvailableToTime(to24);
      setFormAvailableFromHour12(fromParts.hour12);
      setFormAvailableFromMinute(fromParts.minute);
      setFormAvailableFromPeriod(fromParts.period);
      setFormAvailableToHour12(toParts.hour12);
      setFormAvailableToMinute(toParts.minute);
      setFormAvailableToPeriod(toParts.period);
      setFormMakeDefault(tenantDefaultServiceId != null && svc.id === tenantDefaultServiceId);
      setFormTab('basic');
      setFormOpen(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load service.'));
    }
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditId(null);
    setFormName('');
    setFormManagedBy('');
    setFormDescription('');
    setFormPrice('');
    setFormDuration('');
    setFormMaxBookings('');
    setFormAvailableFromTime('');
    setFormAvailableToTime('');
    setFormAvailableFromHour12('');
    setFormAvailableFromMinute('00');
    setFormAvailableFromPeriod('AM');
    setFormAvailableToHour12('');
    setFormAvailableToMinute('00');
    setFormAvailableToPeriod('PM');
    setFormMakeDefault(false);
    setFormTab('basic');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      // Same-day only: "to" must be later than "from".
      // Both values are stored as HH:MM strings in formAvailableFromTime / formAvailableToTime.
      const toMin = formAvailableToTime ? Number(formAvailableToTime.split(':')[0]) * 60 + Number(formAvailableToTime.split(':')[1]) : null;
      const fromMin = formAvailableFromTime ? Number(formAvailableFromTime.split(':')[0]) * 60 + Number(formAvailableFromTime.split(':')[1]) : null;
      if (toMin != null && fromMin != null && toMin <= fromMin) {
        setError('available_to_time must be later than available_from_time (same day only).');
        setSaving(false);
        return;
      }
      const payload = {
        name: formName.trim(),
        managed_by: formManagedBy.trim() || null,
        description: formDescription.trim() || null,
        price: Number(formPrice),
        slot_duration_minutes: Number(formDuration),
        max_bookings_per_user_per_day: Number(formMaxBookings),
        available_from_time: formAvailableFromTime,
        available_to_time: formAvailableToTime,
        make_default_for_users: formMakeDefault,
      };
      if (editId) {
        await updateService(editId, payload);
      } else {
        await createService(payload);
      }
      // Keep admin UI in sync with the tenant default we just changed.
      await refreshUser();
      closeForm();
      load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save service.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this service? This will fail if there are existing bookings.')) return;
    setError('');
    setDeleteId(id);
    deleteService(id)
      .then(async () => {
        await refreshUser();
        load();
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Failed to delete service.')))
      .finally(() => setDeleteId(null));
  };

  if (loading) {
    return (
      <div className="min-h-full">
        <AdminPageHeader title="Services" subtitle="Manage services customers can book (e.g. Dental, Skin)." />
        <AdminCard>
          <div className="p-8 flex items-center justify-center text-[#2d3238]">Loading…</div>
        </AdminCard>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <AdminPageHeader
        title="Services"
        subtitle="Manage services customers can book (e.g. Dental, Skin). Configure duration, price and daily booking limit."
      />
      {error && (
        <div className="mb-4 py-3 px-4 rounded-xl bg-red-50/80 text-red-700 text-sm">
          {error}
        </div>
      )}

      <AdminCard className="mb-6">
        <div className="p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-[#2d3238] text-sm">
            {services.length} service{services.length !== 1 ? 's' : ''}
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-[#15803d] rounded-xl hover:bg-[#166534] transition-colors"
          >
            Add service
          </button>
        </div>
      </AdminCard>

      {formOpen && (
        <AdminCard className="mb-6">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-[#1a1d21]">
                {editId ? 'Edit service' : 'Add service'}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                className="px-3 py-2 text-sm font-semibold text-[#2d3238] bg-[#efece7] rounded-xl hover:bg-[#e8e6e3] transition-colors"
              >
                Close
              </button>
            </div>

            <div className="inline-flex rounded-xl bg-[#efece7] p-1 mb-5">
              <button
                type="button"
                onClick={() => setFormTab('basic')}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                  formTab === 'basic'
                    ? 'bg-white text-[#15803d] shadow-sm'
                    : 'text-[#2d3238] hover:text-[#1a1d21]'
                }`}
              >
                Basic info
              </button>
              <button
                type="button"
                onClick={() => setFormTab('availability')}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                  formTab === 'availability'
                    ? 'bg-white text-[#15803d] shadow-sm'
                    : 'text-[#2d3238] hover:text-[#1a1d21]'
                }`}
              >
                Availability
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formTab === 'basic' ? (
                <>
                  <div>
                    <label htmlFor="service-name" className="block text-sm font-semibold text-[#1a1d21] mb-1">
                      Name
                    </label>
                    <input
                      id="service-name"
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. Dental check-up"
                      required
                      className="w-full px-4 py-2.5 rounded-xl border border-[#e8e6e3] bg-white text-[#1a1d21] focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]"
                    />
                  </div>
                  <div>
                    <label htmlFor="service-managed-by" className="block text-sm font-semibold text-[#1a1d21] mb-1">
                      Managed by
                    </label>
                    <input
                      id="service-managed-by"
                      type="text"
                      value={formManagedBy}
                      onChange={(e) => setFormManagedBy(e.target.value)}
                      placeholder="e.g. Dr. Sarah Khan"
                      className="w-full px-4 py-2.5 rounded-xl border border-[#e8e6e3] bg-white text-[#1a1d21] focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]"
                    />
                  </div>
                  <div>
                    <label htmlFor="service-description" className="block text-sm font-semibold text-[#1a1d21] mb-1">
                      Description
                    </label>
                    <textarea
                      id="service-description"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Short description of this service"
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#e8e6e3] bg-white text-[#1a1d21] focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]"
                    />
                  </div>
                  <div>
                    <label htmlFor="service-price" className="block text-sm font-semibold text-[#1a1d21] mb-1">
                      Price
                    </label>
                    <input
                      id="service-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      required
                      className="w-full max-w-xs px-4 py-2.5 rounded-xl border border-[#e8e6e3] bg-white text-[#1a1d21] focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]"
                    />
                  </div>
                  <div className="pt-1">
                    <p className="text-sm font-semibold text-[#1a1d21] mb-2">Default on user booking page</p>
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="flex items-center gap-2 text-sm text-[#1a1d21] select-none">
                        <input
                          type="radio"
                          name="default-for-users"
                          checked={formMakeDefault === true}
                          onChange={() => setFormMakeDefault(true)}
                        />
                        Show this service by default
                      </label>
                      <label className="flex items-center gap-2 text-sm text-[#1a1d21] select-none">
                        <input
                          type="radio"
                          name="default-for-users"
                          checked={formMakeDefault === false}
                          onChange={() => setFormMakeDefault(false)}
                        />
                        Do not set as default
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label htmlFor="service-duration" className="block text-sm font-semibold text-[#1a1d21] mb-1">
                      Slot duration (minutes)
                    </label>
                    <select
                      id="service-duration"
                      value={formDuration}
                      onChange={(e) => setFormDuration(e.target.value)}
                      required
                      className="w-full max-w-xs px-4 py-2.5 rounded-xl border border-[#e8e6e3] bg-white text-[#1a1d21] focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]"
                    >
                      <option value="" disabled>
                        Select duration
                      </option>
                      {SLOT_DURATION_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m} minutes
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="service-available-from" className="block text-sm font-semibold text-[#1a1d21] mb-1">
                        Available from
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <select
                          value={formAvailableFromHour12}
                          onChange={(e) => {
                            const next = e.target.value;
                            setFormAvailableFromHour12(next);
                            setFormAvailableFromTime(buildTime24From12Parts(next, formAvailableFromMinute, formAvailableFromPeriod));
                          }}
                          required
                          className="w-full px-3 py-2.5 rounded-xl border border-[#e8e6e3] bg-white text-[#1a1d21] focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]"
                        >
                          <option value="" disabled>
                            Hour
                          </option>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                            <option key={h} value={String(h)}>
                              {h}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          step="1"
                          value={formAvailableFromMinute}
                          onChange={(e) => {
                            const next = e.target.value;
                            setFormAvailableFromMinute(next);
                            setFormAvailableFromTime(buildTime24From12Parts(formAvailableFromHour12, next, formAvailableFromPeriod));
                          }}
                          required
                          className="w-full px-3 py-2.5 rounded-xl border border-[#e8e6e3] bg-white text-[#1a1d21] focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]"
                        />
                        <select
                          value={formAvailableFromPeriod}
                          onChange={(e) => {
                            const next = e.target.value;
                            setFormAvailableFromPeriod(next);
                            setFormAvailableFromTime(buildTime24From12Parts(formAvailableFromHour12, formAvailableFromMinute, next));
                          }}
                          required
                          className="w-full px-3 py-2.5 rounded-xl border border-[#e8e6e3] bg-white text-[#1a1d21] focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="service-available-to" className="block text-sm font-semibold text-[#1a1d21] mb-1">
                        Available to
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <select
                          value={formAvailableToHour12}
                          onChange={(e) => {
                            const next = e.target.value;
                            setFormAvailableToHour12(next);
                            setFormAvailableToTime(buildTime24From12Parts(next, formAvailableToMinute, formAvailableToPeriod));
                          }}
                          required
                          className="w-full px-3 py-2.5 rounded-xl border border-[#e8e6e3] bg-white text-[#1a1d21] focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]"
                        >
                          <option value="" disabled>
                            Hour
                          </option>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                            <option key={h} value={String(h)}>
                              {h}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0"
                          max="59"
                          step="1"
                          value={formAvailableToMinute}
                          onChange={(e) => {
                            const next = e.target.value;
                            setFormAvailableToMinute(next);
                            setFormAvailableToTime(buildTime24From12Parts(formAvailableToHour12, next, formAvailableToPeriod));
                          }}
                          required
                          className="w-full px-3 py-2.5 rounded-xl border border-[#e8e6e3] bg-white text-[#1a1d21] focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]"
                        />
                        <select
                          value={formAvailableToPeriod}
                          onChange={(e) => {
                            const next = e.target.value;
                            setFormAvailableToPeriod(next);
                            setFormAvailableToTime(buildTime24From12Parts(formAvailableToHour12, formAvailableToMinute, next));
                          }}
                          required
                          className="w-full px-3 py-2.5 rounded-xl border border-[#e8e6e3] bg-white text-[#1a1d21] focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="service-max-bookings" className="block text-sm font-semibold text-[#1a1d21] mb-1">
                      Max bookings per user per day
                    </label>
                    <input
                      id="service-max-bookings"
                      type="number"
                      min="1"
                      max="100"
                      value={formMaxBookings}
                      onChange={(e) => setFormMaxBookings(e.target.value)}
                      required
                      className="w-full max-w-xs px-4 py-2.5 rounded-xl border border-[#e8e6e3] bg-white text-[#1a1d21] focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]"
                    />
                  </div>
                </>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2.5 text-sm font-semibold text-[#2d3238] bg-[#efece7] rounded-xl hover:bg-[#e8e6e3] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-[#15803d] rounded-xl hover:bg-[#166534] transition-colors disabled:opacity-60"
                >
                  {saving ? 'Saving…' : editId ? 'Update service' : 'Create service'}
                </button>
              </div>
            </form>
          </div>
        </AdminCard>
      )}

      {!formOpen && (
        <AdminCard>
          {services.length === 0 ? (
            <div className="p-8 text-center text-[#2d3238]">
              <p className="mb-4">No services yet. Add one so customers can book.</p>
              <button
                type="button"
                onClick={openCreate}
                className="px-4 py-2.5 text-sm font-semibold text-white bg-[#15803d] rounded-xl hover:bg-[#166534] transition-colors"
              >
                Add service
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#e8e6e3] bg-[#efece7]/80">
                    <th className="px-5 py-4 font-semibold text-[#1a1d21] whitespace-nowrap">Name</th>
                    <th className="px-5 py-4 font-semibold text-[#1a1d21] whitespace-nowrap">Managed by</th>
                    <th className="px-5 py-4 font-semibold text-[#1a1d21] whitespace-nowrap">Price</th>
                    <th className="px-5 py-4 font-semibold text-[#1a1d21] whitespace-nowrap">Slot duration</th>
                    <th className="px-5 py-4 font-semibold text-[#1a1d21] whitespace-nowrap">Service hours</th>
                    <th className="px-5 py-4 font-semibold text-[#1a1d21] whitespace-nowrap">Daily limit</th>
                    <th className="px-5 py-4 font-semibold text-[#1a1d21] whitespace-nowrap w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((svc) => (
                    <tr
                      key={svc.id}
                      className="border-b border-[#e8e6e3]/80 last:border-0 hover:bg-[#efece7]/60 transition-colors"
                    >
                      <td className="px-5 py-4 text-[#1a1d21]">
                        <div className="flex items-center gap-2">
                          <span>{svc.name ?? '—'}</span>
                          {tenantDefaultServiceId != null && svc.id === tenantDefaultServiceId && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-[#eef2ff] text-[#3730a3] text-[11px] font-medium border border-[#c7d2fe]">
                              Default
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[#1a1d21]">{svc.managed_by ?? '—'}</td>
                      <td className="px-5 py-4 text-[#1a1d21]">${Number(svc.price ?? 0).toFixed(2)}</td>
                      <td className="px-5 py-4 text-[#1a1d21]">{svc.slot_duration_minutes ?? 30} min</td>
                      <td className="px-5 py-4 text-[#1a1d21]">
                        {(svc.available_from_time ?? '09:00').slice(0, 5)} - {(svc.available_to_time ?? '17:00').slice(0, 5)}
                      </td>
                      <td className="px-5 py-4 text-[#1a1d21]">{svc.max_bookings_per_user_per_day ?? 2}</td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEdit(svc.id)}
                          className="p-2 text-[#2d3238] hover:text-[#15803d] hover:bg-[#dcfce7]/50 rounded-lg transition-colors mr-1"
                          title="Edit"
                        >
                          <EditIcon className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(svc.id)}
                          disabled={deleteId === svc.id}
                          className="p-2 text-[#2d3238] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
      )}

    </div>
  );
}
