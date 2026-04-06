/** 12-hour UI ↔ 24-hour HH:MM for admin time pickers (same-day windows only). */

export function parseTime24To12Parts(hhmm) {
  if (!hhmm) return { hour12: '', minute: '', period: '' };
  const s = String(hhmm);
  if (!s.includes(':')) return { hour12: '', minute: '', period: '' };
  const [hRaw, mRaw] = s.slice(0, 5).split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return { hour12: '', minute: '', period: '' };
  const period = h >= 12 ? 'PM' : 'AM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12: String(hour12), minute: String(m).padStart(2, '0'), period };
}

export function buildTime24From12Parts(hour12, minute, period) {
  if (!hour12 || minute === '' || !period) return '';
  const h12 = Number(hour12);
  const m = Number(minute);
  if (!Number.isFinite(h12) || !Number.isFinite(m)) return '';
  const mm = String(Math.max(0, Math.min(59, m))).padStart(2, '0');
  let hour = h12 % 12;
  if (period === 'PM') hour += 12;
  const hh = String(hour).padStart(2, '0');
  return `${hh}:${mm}`;
}
