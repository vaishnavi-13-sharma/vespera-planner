import {
  addDays,
  daysBetween,
  formatDateKey,
  formatMonthKey,
  formatRange,
  formatTime,
  minutesOf,
  parseDateKey,
  rollingWeek,
  toDateKey,
  weekdayOf,
} from './dates';

describe('date keys', () => {
  it('converts local dates to and from keys', () => {
    expect(toDateKey(new Date(2026, 10, 12, 23, 59))).toBe('2026-11-12');
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    const d = parseDateKey('2026-11-12');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 12, 0]);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-11-12', -12)).toBe('2026-10-31');
  });

  it('measures whole days between keys, DST-safe', () => {
    expect(daysBetween('2026-11-12', '2026-11-19')).toBe(7);
    expect(daysBetween('2026-03-01', '2026-03-15')).toBe(14); // spans US DST start
    expect(daysBetween('2026-11-19', '2026-11-12')).toBe(-7);
  });

  it('knows the weekday (0 = Sunday)', () => {
    expect(weekdayOf('2026-11-12')).toBe(4);
    expect(weekdayOf('2026-11-15')).toBe(0);
  });

  it('builds a rolling 7-day window', () => {
    expect(rollingWeek('2026-11-12')).toEqual([
      '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18',
    ]);
  });

  it('reads minutes since midnight from a Date', () => {
    expect(minutesOf(new Date(2026, 10, 12, 18, 12))).toBe(1092);
  });
});

describe('formatting', () => {
  it('formats date keys for tabs, headings and chips', () => {
    expect(formatDateKey('2026-11-12', 'tab')).toBe('Thu 12');
    expect(formatDateKey('2026-11-12', 'long')).toBe('Thursday, November 12');
    expect(formatDateKey('2026-11-12', 'short')).toBe('Thu');
  });

  it('formats times and ranges', () => {
    expect(formatTime(0)).toBe('12:00 AM');
    expect(formatTime(540)).toBe('9:00 AM');
    expect(formatTime(720)).toBe('12:00 PM');
    expect(formatTime(1050)).toBe('5:30 PM');
    expect(formatRange({ start: 1050, end: 1095 })).toBe('5:30 PM – 6:15 PM');
    expect(formatRange({ start: null, end: null, timeLabel: 'Early Morning' })).toBe('Early Morning');
    expect(formatRange({ start: null, end: null })).toBe('Flexible');
  });

  it('names a month key', () => {
    expect(formatMonthKey('2026-10')).toBe('October 2026');
    expect(formatMonthKey('2027-01')).toBe('January 2027');
  });
});
