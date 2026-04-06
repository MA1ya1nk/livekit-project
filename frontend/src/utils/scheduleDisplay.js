export function parseTimeFromApi(value) {
  if (value == null || value === '') return '09:00';
  const s = String(value);
  if (s.includes('T')) return s.slice(11, 16);
  if (s.length >= 5) return s.slice(0, 5);
  return '09:00';
}

export function timeToApi(value) {
  if (!value || value.length < 5) return '09:00:00';
  return value.length === 5 ? `${value}:00` : value.slice(0, 8);
}

export function formatTimeForDisplay(timeStr) {
  const parsed = parseTimeFromApi(timeStr);
  const [h, m] = parsed.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

/** Format ISO date-time for display (e.g. "15 May 2024, 9:00 AM"). */
export function formatDateTimeForDisplay(isoStr) {
  if (isoStr == null || isoStr === '') return '—';
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return String(isoStr);
    const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    const period = h >= 12 ? 'PM' : 'AM';
    const hour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const time = `${hour}:${String(m).padStart(2, '0')} ${period}`;
    return `${date}, ${time}`;
  } catch {
    return String(isoStr);
  }
}

/** Format a slot range for display (e.g. "9:00 AM – 9:30 AM"). */
export function formatSlotRange(startIso, endIso) {
  const start = formatTimeForDisplay(startIso);
  const end = formatTimeForDisplay(endIso);
  return `${start} – ${end}`;
}

export function getScheduleSummary(day) {
  if (!day || !day.is_active) return 'Unavailable';
  const start = formatTimeForDisplay(day.start_time);
  const end = formatTimeForDisplay(day.end_time);
  const slot = day.slot_duration_minutes ?? 30;
  return `${start} – ${end} · ${slot} min slots`;
}

/** Summary for working hours only (no slot – slot duration comes from services). */
export function getWorkingHoursSummary(day) {
  if (!day || !day.is_active) return 'Unavailable';
  const start = formatTimeForDisplay(day.start_time);
  const end = formatTimeForDisplay(day.end_time);
  return `${start} – ${end}`;
}

export function defaultDay(dayOfWeek) {
  return {
    day_of_week: dayOfWeek,
    start_time: '09:00:00',
    end_time: '17:00:00',
    slot_duration_minutes: 30,
    is_active: true,
  };
}

export function normalizeSchedule(data) {
  const list = Array.isArray(data) ? data : data?.schedule ?? [];
  const byDay = {};
  for (let i = 0; i < 7; i++) {
    byDay[i] = { ...defaultDay(i) };
  }
  list.forEach((row) => {
    const d = Number(row.day_of_week);
    if (d >= 0 && d <= 6) {
      byDay[d] = {
        day_of_week: d,
        start_time: row.start_time != null ? timeToApi(parseTimeFromApi(row.start_time)) : '09:00:00',
        end_time: row.end_time != null ? timeToApi(parseTimeFromApi(row.end_time)) : '17:00:00',
        slot_duration_minutes: Number(row.slot_duration_minutes) || 30,
        is_active: row.is_active !== false,
      };
    }
  });
  return Array.from({ length: 7 }, (_, i) => byDay[i]);
}
