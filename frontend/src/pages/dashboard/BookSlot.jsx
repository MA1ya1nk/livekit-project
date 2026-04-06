import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getSlots, createBooking } from '../../api/bookings';
import { listTenantServices } from '../../api/tenants';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { formatSlotRange } from '../../utils/scheduleDisplay';
import { UserPageHeader, UserCard, UserSectionTitle } from '../../components/user/UserPageLayout';

function toDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function PhoneIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function ServicePickIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9h2m-2 4h2m-5-4h.01M9 16h.01" />
    </svg>
  );
}

export default function BookSlot() {
  const { user } = useAuth();
  const tenantId = user?.tenant_id;
  const defaultServiceId = user?.default_service_id ?? null;

  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [date, setDate] = useState(() => toDateString(new Date()));
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDescription, setShowDescription] = useState(false);

  useEffect(() => {
    if (!tenantId) {
      setServices([]);
      setSelectedServiceId(null);
      return;
    }
    setServicesLoading(true);
    setError('');
    listTenantServices(tenantId)
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch((err) => setError(getApiErrorMessage(err, 'Failed to load services.')))
      .finally(() => setServicesLoading(false));
  }, [tenantId]);

  const fetchSlots = useCallback(() => {
    if (!date || !selectedServiceId) return;
    setError('');
    setLoading(true);
    getSlots(date, selectedServiceId)
      .then((data) => setSlots(Array.isArray(data) ? data : []))
      .catch((err) => setError(getApiErrorMessage(err, 'Failed to load slots.')))
      .finally(() => setLoading(false));
  }, [date, selectedServiceId]);

  useEffect(() => {
    if (selectedServiceId && date) fetchSlots();
    else setSlots([]);
  }, [fetchSlots, selectedServiceId, date]);

  useEffect(() => {
    if (!tenantId) return;
    if (!Array.isArray(services) || services.length === 0) return;
    if (selectedServiceId != null) return;

    const candidate =
      defaultServiceId != null && services.some((s) => s.id === defaultServiceId)
        ? defaultServiceId
        : services[0].id;
    setSelectedServiceId(candidate);
  }, [tenantId, services, defaultServiceId, selectedServiceId]);

  useEffect(() => {
    setShowDescription(false);
  }, [selectedServiceId]);

  const minDate = toDateString(new Date());
  useEffect(() => {
    if (date && date < minDate) {
      setDate(minDate);
    }
  }, [date, minDate]);

  const voicePhone =
    user?.twilio_phone_number ||
    user?.tenant_phone_number ||
    user?.tenant?.phone_number ||
    user?.booking_phone ||
    user?.phone_number;

  const handleBook = (slot) => {
    if (!selectedServiceId) return;
    setError('');
    setSuccess('');
    setCreating(slot);
    createBooking({
      start_time: slot.start_time,
      end_time: slot.end_time,
      service_id: selectedServiceId,
    })
      .then(() => {
        setSuccess('Booking confirmed.');
        fetchSlots();
      })
      .catch((err) => setError(getApiErrorMessage(err, 'Failed to create booking.')))
      .finally(() => setCreating(null));
  };

  const welcomeTitle = user?.tenant_name ? `Welcome to ${user.tenant_name}` : 'Book a slot';
  const welcomeSubtitle = 'Pick a service, date, and time.';

  const selectedService = services.find((s) => s.id === selectedServiceId);
  const formatPrice = (value) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return null;
    return `$${amount.toFixed(2)}`;
  };
  const priceStr = selectedService ? formatPrice(selectedService.price) : null;
  const durationStr = selectedService ? `${selectedService.slot_duration_minutes ?? 30} min` : '';

  return (
    <div className="min-h-full flex flex-col gap-6">
      <UserPageHeader eyebrow="Booking" title={welcomeTitle} subtitle={welcomeSubtitle} />

      {(error || success) && (
        <div className="space-y-2">
          {error && (
            <div className="py-2.5 px-4 rounded-xl bg-red-50 border border-red-100 text-red-800 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="py-2.5 px-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm">
              {success}
            </div>
          )}
        </div>
      )}

      <div className={`grid grid-cols-1 gap-6 flex-1 min-h-0 ${voicePhone ? 'lg:grid-cols-12' : ''}`}>
        <div className={`flex flex-col gap-6 min-h-0 ${voicePhone ? 'lg:col-span-8' : ''}`}>
          {!tenantId ? (
            <UserCard>
              <div className="p-5 sm:p-6">
                <p className="text-[#4b5563] text-[15px] leading-relaxed">
                  You are not assigned to a business. Please contact support.
                </p>
              </div>
            </UserCard>
          ) : (
            <>
              <UserCard className="ring-1 ring-[#15803d]/[0.06]">
                <div className="relative overflow-hidden border-b border-[#eef0ed] bg-gradient-to-br from-[#ecfdf5]/50 via-white to-white px-5 sm:px-6 pt-5 sm:pt-6 pb-4">
                  <div className="absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-4 rounded-full bg-[#15803d]/[0.06]" aria-hidden />
                  <div className="relative flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#15803d]/10 text-[#15803d]">
                      <ServicePickIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <h2 className="text-base font-semibold tracking-tight text-[#1a1d21]">Service & date</h2>
                      <p className="mt-1 text-sm leading-relaxed text-[#6b7280]">Choose what you need, then pick your day.</p>
                    </div>
                  </div>
                </div>
                <div className="px-5 sm:px-6 py-5 sm:py-6">
                  {servicesLoading ? (
                    <p className="text-sm text-[#6b7280] py-2">Loading services?</p>
                  ) : services.length === 0 ? (
                    <p className="text-[15px] text-[#4b5563]">No services available for this business.</p>
                  ) : (
                    <div className="space-y-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6">
                        <div className="min-w-0 w-full sm:flex-1 sm:max-w-lg">
                          <label htmlFor="service-select" className="mb-2 block text-[13px] font-medium text-[#374151]">
                            Service
                          </label>
                          <select
                            id="service-select"
                            value={selectedServiceId ?? ''}
                            onChange={(e) => setSelectedServiceId(e.target.value ? Number(e.target.value) : null)}
                            className="w-full rounded-xl border border-[#e5e2dd] bg-white px-3.5 py-3 text-[15px] text-[#1a1d21] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-shadow focus:border-[#15803d] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#15803d]/20"
                          >
                            <option value="">Choose a service</option>
                            {services.map((svc) => (
                              <option key={svc.id} value={svc.id}>
                                {svc.name}
                                {defaultServiceId === svc.id ? ' (default)' : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedServiceId && (
                          <div className="w-full shrink-0 sm:w-auto">
                            <input
                              id="book-date"
                              type="date"
                              value={date}
                              min={minDate}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v && v < minDate) {
                                  setDate(minDate);
                                  return;
                                }
                                setDate(v);
                              }}
                              aria-label="Choose appointment date"
                              className="w-full min-w-0 rounded-xl border border-[#e5e2dd] bg-white px-3 py-3 text-[15px] text-[#1a1d21] shadow-[0_1px_2px_rgba(0,0,0,0.03)] [color-scheme:light] focus:border-[#15803d] focus:outline-none focus:ring-2 focus:ring-[#15803d]/20 sm:w-auto sm:min-w-[11rem]"
                            />
                          </div>
                        )}
                      </div>

                        {selectedService && (
                          <div className="rounded-xl border border-[#e8ebe6] bg-[#fafbf9] p-4 sm:p-5">
                            <div className="flex flex-wrap items-center gap-2 gap-y-1">
                              <span className="text-[16px] font-semibold text-[#1a1d21]">{selectedService.name}</span>
                              {defaultServiceId === selectedService.id && (
                                <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#15803d] ring-1 ring-[#15803d]/20">
                                  Default
                                </span>
                              )}
                            </div>
                            {selectedService.managed_by && (
                              <p className="mt-2 text-sm text-[#5c636a]">
                                <span className="font-medium text-[#374151]">Managed by </span>
                                {selectedService.managed_by}
                              </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {priceStr && (
                                <span className="rounded-lg bg-[#ecfdf5] px-2.5 py-1 text-xs font-semibold text-[#166534] ring-1 ring-[#bbf7d0]/80">
                                  {priceStr}
                                </span>
                              )}
                              {durationStr && (
                                <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-[#4b5563] ring-1 ring-[#e5e7eb]">
                                  {durationStr}
                                </span>
                              )}
                            </div>
                            {selectedService.description && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setShowDescription((v) => !v)}
                                  className="mt-3 text-sm font-medium text-[#15803d] hover:text-[#166534]"
                                >
                                  {showDescription ? 'Hide description' : 'Show description'}
                                </button>
                                {showDescription && (
                                  <p className="mt-2 border-t border-[#e5e7eb] pt-3 text-sm leading-relaxed text-[#4b5563]">
                                    {selectedService.description}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        )}
                    </div>
                  )}
                </div>
              </UserCard>

              {selectedServiceId && (
                <UserCard>
                  <UserSectionTitle title="Available times" description="Select a slot to confirm." />
                  <div className="px-5 sm:px-6 pb-5 sm:pb-6 pt-1">
                    {loading ? (
                      <p className="text-sm text-[#6b7280] py-10 text-center">Loading slots?</p>
                    ) : slots.length === 0 ? (
                      <p className="text-sm text-[#6b7280] py-10 text-center">No slots for this date.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {slots.map((slot, i) => {
                          const key = slot.start_time + slot.end_time + i;
                          const isCreating = creating && creating.start_time === slot.start_time;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => handleBook(slot)}
                              disabled={!!creating}
                              className="px-3 py-2.5 rounded-xl text-sm font-medium text-[#1a1d21] bg-white border border-[#e5e2dd] hover:border-[#15803d]/40 hover:bg-[#f0fdf4]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isCreating ? 'Booking?' : formatSlotRange(slot.start_time, slot.end_time)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </UserCard>
              )}
            </>
          )}
        </div>

        {voicePhone && (
          <div className="lg:col-span-4">
            <UserCard className="h-full lg:sticky lg:top-24">
              <div className="p-5 sm:p-6 flex flex-col h-full">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#ecfdf5] text-[#15803d] shrink-0">
                    <PhoneIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#1a1d21]">Book by phone</h3>
                    <p className="text-sm text-[#6b7280] mt-1 leading-relaxed">
                      Call and use the voice assistant to schedule.
                    </p>
                  </div>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9ca3af] mb-1">
                  Number
                </p>
                <a
                  href={`tel:${String(voicePhone).replace(/\s/g, '')}`}
                  className="inline-flex items-center gap-2 text-[#15803d] font-semibold hover:text-[#166534] no-underline text-base"
                >
                  <PhoneIcon className="w-4 h-4 shrink-0" />
                  {voicePhone}
                </a>
              </div>
            </UserCard>
          </div>
        )}
      </div>
    </div>
  );
}
