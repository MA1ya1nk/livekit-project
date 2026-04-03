import { useState, useEffect, useMemo } from 'react';
import { getServices, updateService } from '../../api/admin/services';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { parseTimeFromApi, timeToApi, getWorkingHoursSummary, defaultDay } from '../../utils/scheduleDisplay';
import { parseTime24To12Parts, buildTime24From12Parts } from '../../utils/time12h';
import { AdminPageHeader } from '../../components/admin/AdminPageLayout';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function EditIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

export default function AdminWorkingHours() {
  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState('');

  const [schedule, setSchedule] = useState(() => Array.from({ length: 7 }, (_, i) => defaultDay(i)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingDayOfWeek, setEditingDayOfWeek] = useState(null);

  const todayDayOfWeek = useMemo(() => new Date().getDay(), []);

  const restOfWeekOrder = useMemo(
    () => Array.from({ length: 6 }, (_, i) => (todayDayOfWeek + 1 + i) % 7),
    [todayDayOfWeek]
  );

  useEffect(() => {
    let cancelled = false;
    setError('');
    getServices()
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setServices(list);
        const initialId = list.length > 0 ? String(list[0].id) : '';
        setSelectedServiceId(initialId);

        // Service availability applies every day with the same window.
        if (list.length > 0) {
          const svc = list[0];
          setSchedule(
            Array.from({ length: 7 }, (_, i) => ({
              day_of_week: i,
              start_time: svc.available_from_time,
              end_time: svc.available_to_time,
              is_active: true,
              slot_duration_minutes: svc.slot_duration_minutes,
            }))
          );
        }
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'Failed to load services.'));
      })
      .finally(() => {
        if (!cancelled) {
          setServicesLoading(false);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedServiceId) return;
    const svc = services.find((s) => String(s.id) === String(selectedServiceId));
    if (!svc) return;
    setEditingDayOfWeek(null);
    // Service availability applies every day with the same window.
    setSchedule(
      Array.from({ length: 7 }, (_, i) => ({
        day_of_week: i,
        start_time: svc.available_from_time,
        end_time: svc.available_to_time,
        is_active: true,
        slot_duration_minutes: svc.slot_duration_minutes,
      }))
    );
  }, [selectedServiceId, services]);

  const updateDay = (dayOfWeek, field, value) => {
    if (field === 'start_time' || field === 'end_time') {
      // Keep service availability consistent across all days.
      setSchedule((prev) => prev.map((d) => ({ ...d, [field]: value })));
      return;
    }
    setSchedule((prev) => prev.map((d, idx) => (idx === dayOfWeek ? { ...d, [field]: value } : d)));
  };

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      if (!selectedServiceId) throw new Error('No service selected');
      const day = schedule[editingDayOfWeek ?? todayDayOfWeek];
      const startHH = parseTimeFromApi(day.start_time);
      const endHH = parseTimeFromApi(day.end_time);
      const fromMin = Number(startHH.split(':')[0]) * 60 + Number(startHH.split(':')[1]);
      const toMin = Number(endHH.split(':')[0]) * 60 + Number(endHH.split(':')[1]);
      if (toMin <= fromMin) {
        setError('End time must be later than start time (same day only).');
        return;
      }
      await updateService(selectedServiceId, {
        available_from_time: startHH,
        available_to_time: endHH,
      });
      setEditingDayOfWeek(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save service availability.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full">
        <AdminPageHeader
          title="Working hours"
          subtitle="Set when your business is open. Slot length is set per service under Services."
        />
        <div className="rounded-xl bg-[#fafaf8] p-8 flex items-center justify-center text-[#2d3238]">
          Loading…
        </div>
      </div>
    );
  }

  const todaySchedule = schedule[todayDayOfWeek];
  const selectedService = services.find((s) => String(s.id) === String(selectedServiceId)) ?? null;

  return (
    <div className="min-h-full">
      <AdminPageHeader
        title="Working hours"
        subtitle="Set when your business is open. Slot length is set per service under Services."
      />

      {error && (
        <div className="mb-5 py-3 px-4 rounded-xl bg-red-50/80 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="mb-6 rounded-xl bg-[#fafaf8] p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="w-full max-w-xs shrink-0">
            <label htmlFor="workinghours-service" className="block text-sm font-semibold text-[#1a1d21] mb-2">
              Service
            </label>
            <select
              id="workinghours-service"
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              disabled={servicesLoading || services.length === 0}
              className="w-full px-4 py-2.5 rounded-xl border border-[#e8e6e3] bg-white text-[#1a1d21] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]"
            >
              {services.length === 0 ? <option value="">No services</option> : null}
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {selectedService ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#eef2ff] text-[#3730a3] text-xs font-medium border border-[#c7d2fe]">
                {getWorkingHoursSummary({
                  is_active: true,
                  start_time: selectedService.available_from_time,
                  end_time: selectedService.available_to_time,
                })}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="rounded-xl bg-[#efece7] flex items-center justify-center p-6 shrink-0" aria-hidden>
            <svg className="w-24 h-24 text-[#15803d]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="1.5" />
              <line x1="16" y1="2" x2="16" y2="6" strokeWidth="1.5" />
              <line x1="8" y1="2" x2="8" y2="6" strokeWidth="1.5" />
              <line x1="3" y1="10" x2="21" y2="10" strokeWidth="1.5" />
            </svg>
          </div>
          <div className="rounded-xl bg-[#fafaf8] overflow-hidden relative shrink-0 flex flex-col">
            <div className="absolute top-4 right-4">
              <button
                type="button"
                onClick={() => setEditingDayOfWeek(editingDayOfWeek === todayDayOfWeek ? null : todayDayOfWeek)}
                className="p-2 rounded-lg text-[#2d3238] hover:bg-[#e8e6e3] hover:text-[#1a1d21] transition-colors"
                aria-label="Edit today"
              >
                <EditIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 sm:p-8">
              <h2 className="text-sm font-medium text-[#2d3238] mb-1">Today</h2>
              <p className="text-xl font-semibold text-[#1a1d21] mb-4">
                {DAY_NAMES[todayDayOfWeek]}
              </p>
              {editingDayOfWeek === todayDayOfWeek ? (
                <DayEditForm
                  day={todaySchedule}
                  dayOfWeek={todayDayOfWeek}
                  onUpdate={updateDay}
                  onSave={handleSave}
                  onCancel={() => setEditingDayOfWeek(null)}
                  saving={saving}
                />
              ) : (
                <div className="text-[#1a1d21]">
                  <p className="text-lg">{getWorkingHoursSummary(todaySchedule)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-[#fafaf8] p-5 flex flex-col min-h-0 overflow-hidden">
          <h2 className="text-sm font-medium text-[#2d3238] mb-3 shrink-0">Rest of week</h2>
          <ul className="space-y-2 overflow-auto min-h-0">
            {restOfWeekOrder.map((dayOfWeek) => {
              const day = schedule[dayOfWeek];
              const isEditing = editingDayOfWeek === dayOfWeek;
              return (
                <li key={dayOfWeek}>
                  {isEditing ? (
                    <div className="p-4 rounded-lg bg-white/80 border border-[#e8e6e3]">
                      <DayEditForm
                        day={day}
                        dayOfWeek={dayOfWeek}
                        onUpdate={updateDay}
                        onSave={handleSave}
                        onCancel={() => setEditingDayOfWeek(null)}
                        saving={saving}
                        compact
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingDayOfWeek(dayOfWeek)}
                      className="w-full text-left px-4 py-3 rounded-lg bg-white/60 hover:bg-[#e8e6e3] transition-colors flex items-center justify-between gap-2"
                    >
                      <span className="font-medium text-[#1a1d21]">{DAY_NAMES[dayOfWeek]}</span>
                      <span className="text-sm text-[#2d3238] truncate">{getWorkingHoursSummary(day)}</span>
                      <EditIcon className="w-4 h-4 text-[#2d3238] shrink-0" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
function Time12hRow({ label, hour12, minute, period, onChangeHour, onChangeMinute, onChangePeriod, compact }) {
  return (
    <div className={compact ? '' : 'min-w-0'}>
      <span className="block text-xs font-semibold text-[#1a1d21] mb-1">{label}</span>
      <div className={`grid grid-cols-3 gap-2 ${compact ? 'max-w-[280px]' : 'max-w-sm'}`}>
        <select
          value={hour12}
          onChange={(e) => onChangeHour(e.target.value)}
          required
          className="w-full px-2.5 py-2 rounded-xl border border-[#e8e6e3] bg-white text-[#1a1d21] text-sm focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]"
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
          value={minute}
          onChange={(e) => onChangeMinute(e.target.value)}
          required
          className="w-full px-2.5 py-2 rounded-xl border border-[#e8e6e3] bg-white text-[#1a1d21] text-sm focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]"
        />
        <select
          value={period}
          onChange={(e) => onChangePeriod(e.target.value)}
          required
          className="w-full px-2.5 py-2 rounded-xl border border-[#e8e6e3] bg-white text-[#1a1d21] text-sm focus:outline-none focus:ring-2 focus:ring-[#15803d]/30 focus:border-[#15803d]"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}

function DayEditForm({ day, dayOfWeek, onUpdate, onSave, onCancel, saving, compact }) {
  const start24 = parseTimeFromApi(day.start_time);
  const end24 = parseTimeFromApi(day.end_time);
  const startParts = parseTime24To12Parts(start24);
  const endParts = parseTime24To12Parts(end24);

  const [startHour12, setStartHour12] = useState(startParts.hour12);
  const [startMinute, setStartMinute] = useState(startParts.minute || '00');
  const [startPeriod, setStartPeriod] = useState(startParts.period || 'AM');
  const [endHour12, setEndHour12] = useState(endParts.hour12);
  const [endMinute, setEndMinute] = useState(endParts.minute || '00');
  const [endPeriod, setEndPeriod] = useState(endParts.period || 'PM');

  useEffect(() => {
    const s = parseTime24To12Parts(parseTimeFromApi(day.start_time));
    const e = parseTime24To12Parts(parseTimeFromApi(day.end_time));
    setStartHour12(s.hour12);
    setStartMinute(s.minute || '00');
    setStartPeriod(s.period || 'AM');
    setEndHour12(e.hour12);
    setEndMinute(e.minute || '00');
    setEndPeriod(e.period || 'PM');
  }, [day.start_time, day.end_time]);

  const applyStart = (h, m, p) => {
    setStartHour12(h);
    setStartMinute(m);
    setStartPeriod(p);
    const t24 = buildTime24From12Parts(h, m, p);
    if (t24) onUpdate(dayOfWeek, 'start_time', timeToApi(t24));
  };

  const applyEnd = (h, m, p) => {
    setEndHour12(h);
    setEndMinute(m);
    setEndPeriod(p);
    const t24 = buildTime24From12Parts(h, m, p);
    if (t24) onUpdate(dayOfWeek, 'end_time', timeToApi(t24));
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!day.is_active}
          onChange={(e) => onUpdate(dayOfWeek, 'is_active', e.target.checked)}
          disabled
          className="rounded border-[#e8e6e3] text-[#15803d] focus:ring-[#15803d]"
        />
        <span className="text-sm text-[#1a1d21]">Available</span>
      </label>
      <div className={`flex flex-col ${compact ? 'gap-3' : 'sm:flex-row sm:flex-wrap gap-4'}`}>
        <Time12hRow
          label="Start"
          hour12={startHour12}
          minute={startMinute}
          period={startPeriod}
          compact={compact}
          onChangeHour={(next) => applyStart(next, startMinute, startPeriod)}
          onChangeMinute={(next) => applyStart(startHour12, next, startPeriod)}
          onChangePeriod={(next) => applyStart(startHour12, startMinute, next)}
        />
        <Time12hRow
          label="End"
          hour12={endHour12}
          minute={endMinute}
          period={endPeriod}
          compact={compact}
          onChangeHour={(next) => applyEnd(next, endMinute, endPeriod)}
          onChangeMinute={(next) => applyEnd(endHour12, next, endPeriod)}
          onChangePeriod={(next) => applyEnd(endHour12, endMinute, next)}
        />
      </div>
      <p className="text-xs text-[#6b7280]">End must be after start on the same day (no overnight window).</p>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-semibold text-white bg-[#15803d] rounded-lg hover:bg-[#166534] disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-[#1a1d21] bg-[#e8e6e3] rounded-lg hover:bg-[#ddd]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

