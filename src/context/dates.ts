// Local-calendar date helpers. Dates are "YYYY-MM-DD" keys in the user's local time zone.
import type { BlockFields, DateKey } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of the key's date. */
export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** A real "YYYY-MM-DD" calendar date (so never Feb 30). */
export function isDateKey(x: unknown): x is DateKey {
  return typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) && toDateKey(parseDateKey(x)) === x;
}

/** The key for a calendar date (month 0–11), or null when it doesn't exist (Feb 30, Apr 31, month 13). */
export function calendarDate(year: number, month: number, day: number): DateKey | null {
  const d = new Date(year, month, day);
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day ? toDateKey(d) : null;
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Whole days from a to b (negative when b is earlier). Uses UTC so DST shifts don't skew it. */
export function daysBetween(a: DateKey, b: DateKey): number {
  const utc = (k: DateKey) => {
    const [y, m, d] = k.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(key: DateKey): number {
  return parseDateKey(key).getDay();
}

export function dayOfMonth(key: DateKey): number {
  return Number(key.slice(8, 10));
}

export function rollingWeek(start: DateKey): DateKey[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function minutesOf(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** tab: "Thu 12" · long: "Thursday, November 12" · short: "Thu" */
export function formatDateKey(key: DateKey, style: 'tab' | 'long' | 'short'): string {
  const d = parseDateKey(key);
  const wd = d.getDay();
  if (style === 'short') return WEEKDAY_SHORT[wd];
  if (style === 'tab') return `${WEEKDAY_SHORT[wd]} ${d.getDate()}`;
  return `${WEEKDAY_LONG[wd]}, ${MONTH_LONG[d.getMonth()]} ${d.getDate()}`;
}

/** "2026-10" → "October 2026" */
export function formatMonthKey(month: string): string {
  return `${MONTH_LONG[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

export function formatTime(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad(m)} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** "5:30 PM – 6:15 PM", or the block's time label when it floats. */
export function formatRange(block: Pick<BlockFields, 'start' | 'end' | 'timeLabel'>): string {
  if (block.start === null || block.end === null) return block.timeLabel ?? 'Flexible';
  return `${formatTime(block.start)} – ${formatTime(block.end)}`;
}
