// deadline.js — shared date/urgency helpers (Safari-safe manual parsing).
export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function parseDeadline(s) {
  if (!s) return null;
  const [datePart, timePart] = String(s).split(' ');
  const [y, m, d] = (datePart || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  const [hh, mm] = (timePart || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh || 0, mm || 0);
}

export function startOfToday(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function urgencyOf(s) {
  const dt = parseDeadline(s);
  if (!dt) return null;
  const now = new Date();
  const today = startOfToday(now);
  if (dt < now) return 'OVERDUE';
  if (dt >= today && dt < new Date(today.getTime() + 24 * 3600 * 1000)) return 'TODAY';
  if (dt - now <= 7 * 24 * 3600 * 1000) return 'SOON';
  return null;
}

export function dayDiff(dt) {
  return Math.round((startOfToday(dt) - startOfToday()) / 86400000);
}

export function relLabel(s) {
  const dt = parseDeadline(s);
  if (!dt) return '—';
  const diff = dayDiff(dt);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > -7 && diff < 7) return DAYS[dt.getDay()];
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]}`;
}

export function timeOnly(s) {
  const dt = parseDeadline(s);
  if (!dt) return '';
  const h = dt.getHours() % 12 || 12;
  return `${h}:${String(dt.getMinutes()).padStart(2, '0')} ${dt.getHours() < 12 ? 'AM' : 'PM'}`;
}

export function statusClass(s) {
  const u = urgencyOf(s);
  if (u === 'OVERDUE') return 'status-overdue';
  if (u === 'TODAY' || u === 'SOON') return 'status-urgent';
  return 'status-rest';
}

export function chipLabel(s) {
  const u = urgencyOf(s);
  if (u === 'OVERDUE') return 'Overdue';
  if (u === 'TODAY') return 'Due today';
  if (u === 'SOON') return 'Soon';
  return null;
}

export function badgeFor(s) {
  const u = urgencyOf(s);
  if (u === 'OVERDUE') return 'Overdue';
  if (u === 'TODAY') return 'Due today';
  if (u === 'SOON') return 'Soon';
  return 'Upcoming';
}
