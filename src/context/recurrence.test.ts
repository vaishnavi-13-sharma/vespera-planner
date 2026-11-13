import { describeRepeat, occurrencesForDate, occursOn, rippleTimes } from './recurrence';
import type { Occurrence, Series, VesperaState } from './types';

const base: Omit<Series, 'repeat'> = {
  id: 's1', title: 'Bookshop Shift', kind: 'anchor', start: 540, end: 780, startDate: '2026-11-12',
};
const s = (repeat: Series['repeat'], extra: Partial<Series> = {}): Series => ({ ...base, repeat, ...extra });

describe('occursOn', () => {
  it('daily: every day from the start date', () => {
    const daily = s({ freq: 'daily' });
    expect(occursOn(daily, '2026-11-11')).toBe(false);
    expect(occursOn(daily, '2026-11-12')).toBe(true);
    expect(occursOn(daily, '2027-03-01')).toBe(true);
  });

  it('weekdays: Monday to Friday only', () => {
    const wk = s({ freq: 'weekdays' });
    expect(occursOn(wk, '2026-11-13')).toBe(true); // Fri
    expect(occursOn(wk, '2026-11-14')).toBe(false); // Sat
    expect(occursOn(wk, '2026-11-16')).toBe(true); // Mon
  });

  it('weekly on chosen days', () => {
    const thuFri = s({ freq: 'weekly', interval: 1, weekdays: [4, 5] });
    expect(occursOn(thuFri, '2026-11-12')).toBe(true);
    expect(occursOn(thuFri, '2026-11-13')).toBe(true);
    expect(occursOn(thuFri, '2026-11-17')).toBe(false);
    expect(occursOn(thuFri, '2026-11-19')).toBe(true);
  });

  it('every N weeks, counted from the start week', () => {
    const biweekly = s({ freq: 'weekly', interval: 2, weekdays: [4] });
    expect(occursOn(biweekly, '2026-11-12')).toBe(true);
    expect(occursOn(biweekly, '2026-11-19')).toBe(false);
    expect(occursOn(biweekly, '2026-11-26')).toBe(true);
  });

  it('every N weeks also works for days earlier in the week than the start', () => {
    // starts Thu 12; Mon 23 is in week 2 of the series (Sun-based weeks), so it occurs
    const s2 = s({ freq: 'weekly', interval: 2, weekdays: [1, 4] });
    expect(occursOn(s2, '2026-11-16')).toBe(false);
    expect(occursOn(s2, '2026-11-23')).toBe(true);
  });

  it('monthly on the start date, skipping short months', () => {
    const m = s({ freq: 'monthly' }, { startDate: '2026-10-31' });
    expect(occursOn(m, '2026-10-31')).toBe(true);
    expect(occursOn(m, '2026-11-30')).toBe(false);
    expect(occursOn(m, '2026-12-31')).toBe(true);
  });

  it('respects the end date (inclusive)', () => {
    const ended = s({ freq: 'daily' }, { endDate: '2026-11-14' });
    expect(occursOn(ended, '2026-11-14')).toBe(true);
    expect(occursOn(ended, '2026-11-15')).toBe(false);
  });
});

describe('describeRepeat', () => {
  it('reads like a person would say it', () => {
    expect(describeRepeat({ freq: 'daily' }, '2026-11-12')).toBe('Daily');
    expect(describeRepeat({ freq: 'weekdays' }, '2026-11-12')).toBe('Weekdays');
    expect(describeRepeat({ freq: 'weekly', interval: 1, weekdays: [5, 4] }, '2026-11-12')).toBe('Weekly · Thu, Fri');
    expect(describeRepeat({ freq: 'weekly', interval: 2, weekdays: [4] }, '2026-11-12')).toBe('Every 2 weeks · Thu');
    expect(describeRepeat({ freq: 'monthly' }, '2026-11-12')).toBe('Monthly · 12th');
    expect(describeRepeat({ freq: 'monthly' }, '2026-11-01')).toBe('Monthly · 1st');
    expect(describeRepeat({ freq: 'monthly' }, '2026-11-22')).toBe('Monthly · 22nd');
    expect(describeRepeat({ freq: 'monthly' }, '2026-11-13')).toBe('Monthly · 13th');
  });
});

type Sched = Pick<VesperaState, 'blocks' | 'series' | 'exceptions'>;

describe('occurrencesForDate', () => {
  const sched: Sched = {
    blocks: [
      { id: 'b1', date: '2026-11-12', title: 'Send Essay', kind: 'focus', start: 1200, end: 1260 },
      { id: 'b2', date: '2026-11-12', title: 'Morning run', kind: 'flexible', start: null, end: null, timeLabel: 'Early Morning' },
      { id: 'b3', date: '2026-11-13', title: 'Other day', kind: 'focus', start: 600, end: 660 },
    ],
    series: [s({ freq: 'weekly', interval: 1, weekdays: [4] }, { categoryId: 'cat-job2' })],
    exceptions: {},
  };

  it('merges one-offs and series for the date, untimed first then by start', () => {
    const occ = occurrencesForDate(sched, '2026-11-12');
    expect(occ.map((o) => o.key)).toEqual(['b2', 's1@2026-11-12', 'b1']);
    expect(occ[1]).toMatchObject({
      title: 'Bookshop Shift', date: '2026-11-12', begun: false, categoryId: 'cat-job2',
      source: { type: 'series', id: 's1', date: '2026-11-12' },
      repeat: { freq: 'weekly', interval: 1, weekdays: [4] },
    });
    expect(occ[2]).toMatchObject({ source: { type: 'oneoff', id: 'b1' }, repeat: null });
  });

  it('applies per-date overrides and begun flags', () => {
    const occ = occurrencesForDate(
      { ...sched, exceptions: { s1: { '2026-11-19': { begun: true, overrides: { start: 600, end: 840 } } } } },
      '2026-11-19',
    );
    expect(occ).toHaveLength(1);
    expect(occ[0]).toMatchObject({ start: 600, end: 840, begun: true, title: 'Bookshop Shift' });
  });

  it('hides skipped occurrences', () => {
    const occ = occurrencesForDate({ ...sched, exceptions: { s1: { '2026-11-19': { skipped: true } } } }, '2026-11-19');
    expect(occ).toEqual([]);
  });
});

describe('rippleTimes', () => {
  const occ = (key: string, kind: Occurrence['kind'], start: number | null, end: number | null) =>
    ({ key, kind, start, end }) as Occurrence;

  it('pushes a block and slides overlapping movable blocks forward', () => {
    const day = [occ('cook', 'flexible', 1050, 1095), occ('gym', 'flexible', 1095, 1140), occ('focus', 'focus', 1140, 1230)];
    expect(rippleTimes(day, 'cook', 30)).toEqual({
      cook: { start: 1080, end: 1125 },
      gym: { start: 1125, end: 1170 },
      focus: { start: 1170, end: 1260 },
    });
  });

  it('stops at the first gap', () => {
    const day = [occ('a', 'focus', 600, 660), occ('b', 'focus', 720, 780)];
    expect(rippleTimes(day, 'a', 30)).toEqual({ a: { start: 630, end: 690 } });
  });

  it('never moves anchors or untimed blocks', () => {
    const day = [occ('a', 'anchor', 600, 660), occ('u', 'focus', null, null), occ('f', 'focus', 600, 660)];
    expect(rippleTimes(day, 'a', 30)).toEqual({});
    expect(rippleTimes(day, 'u', 30)).toEqual({});
    expect(rippleTimes([occ('f', 'focus', 600, 660), occ('x', 'anchor', 650, 700)], 'f', 30)).toEqual({ f: { start: 630, end: 690 } });
  });

  it('moves only the target when pulling earlier', () => {
    const day = [occ('a', 'focus', 600, 660), occ('b', 'focus', 660, 720)];
    expect(rippleTimes(day, 'b', -30)).toEqual({ b: { start: 630, end: 690 } });
  });
});
