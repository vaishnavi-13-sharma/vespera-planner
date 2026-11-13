import {
  addActivity,
  dailyFive,
  focusPhase,
  focusSessionMinutes,
  isLit,
  mondayOf,
  nextReview,
  seasonFor,
  weekCandles,
  weeklySummary,
} from './delight';
import type { FocusSession, VesperaState } from './types';
import { createSeedState } from '../test/ownerWeek';

const MIN = 60_000;
const session = (over: Partial<FocusSession> = {}): FocusSession => ({
  title: 'Research Push', date: '2026-11-11', occurrenceKey: 'blk-wed-focus',
  rhythm: 'whole', sound: 'off', startedAt: 0, totalMinutes: 90, pausedAt: null, pausedMs: 0, ...over,
});

describe('focus sessions', () => {
  it('sizes a session from the block, or 60 minutes when untimed', () => {
    expect(focusSessionMinutes({ start: 1140, end: 1230 })).toBe(90);
    expect(focusSessionMinutes({ start: null, end: null })).toBe(60);
  });

  it('a whole-block session is one focus phase', () => {
    expect(focusPhase(session(), 30 * MIN)).toMatchObject({ phase: 'focus', remainingMs: 60 * MIN, focusMs: 30 * MIN, totalRemainingMs: 60 * MIN });
    expect(focusPhase(session(), 95 * MIN)).toMatchObject({ phase: 'done', remainingMs: 0, focusMs: 90 * MIN, totalRemainingMs: 0 });
  });

  it('25 + 5 cycles focus and rest, truncating the last phase', () => {
    const s = session({ rhythm: 'pomodoro25', totalMinutes: 70 });
    expect(focusPhase(s, 10 * MIN)).toMatchObject({ phase: 'focus', remainingMs: 15 * MIN, cycle: 1 });
    expect(focusPhase(s, 27 * MIN)).toMatchObject({ phase: 'rest', remainingMs: 3 * MIN, cycle: 1, focusMs: 25 * MIN });
    expect(focusPhase(s, 40 * MIN)).toMatchObject({ phase: 'focus', remainingMs: 15 * MIN, cycle: 2, focusMs: 35 * MIN });
    // 60–70 is a 10-minute truncated third focus phase
    expect(focusPhase(s, 65 * MIN)).toMatchObject({ phase: 'focus', remainingMs: 5 * MIN, cycle: 3, focusMs: 55 * MIN });
    expect(focusPhase(s, 70 * MIN)).toMatchObject({ phase: 'done', focusMs: 60 * MIN });
  });

  it('50 + 10 works the same way', () => {
    expect(focusPhase(session({ rhythm: 'pomodoro50', totalMinutes: 120 }), 55 * MIN)).toMatchObject({ phase: 'rest', remainingMs: 5 * MIN });
  });

  it('pauses freeze the clock', () => {
    const paused = session({ pausedAt: 20 * MIN, pausedMs: 5 * MIN });
    expect(focusPhase(paused, 60 * MIN)).toMatchObject({ focusMs: 15 * MIN, paused: true });
    const resumed = session({ pausedMs: 10 * MIN });
    expect(focusPhase(resumed, 40 * MIN).focusMs).toBe(30 * MIN);
  });
});

describe('vocab reviews', () => {
  it('schedules Knew it along 1 → 3 → 7 → 14 → 30 days, and Not yet for tomorrow', () => {
    expect(nextReview(undefined, true, '2026-11-12')).toEqual({ step: 1, due: '2026-11-15' });
    expect(nextReview({ step: 1, due: '2026-11-15' }, true, '2026-11-15')).toEqual({ step: 2, due: '2026-11-22' });
    expect(nextReview({ step: 4, due: '2026-11-15' }, true, '2026-11-15')).toEqual({ step: 4, due: '2026-12-15' });
    expect(nextReview({ step: 3, due: '2026-11-15' }, false, '2026-11-15')).toEqual({ step: 0, due: '2026-11-16' });
  });

  it('builds the Daily 5: due cards oldest first, then new ones in board order', () => {
    const s = createSeedState();
    s.noteTags.push({ id: 'tag-es', name: 'Spanish', emoji: '🇪🇸', vocab: true });
    s.notes = [
      { id: 'a', tagId: 'tag-vocab', text: 'A', review: { step: 1, due: '2026-11-14' } },
      { id: 'b', tagId: 'tag-vocab', text: 'B', review: { step: 2, due: '2026-11-10' } },
      { id: 'c', tagId: 'tag-vocab', text: 'C' },
      { id: 'd', tagId: 'tag-reminder', text: 'not vocab' },
      { id: 'e', tagId: 'tag-es', text: 'E' },
      { id: 'f', tagId: 'tag-vocab', text: 'F', review: { step: 0, due: '2026-11-12' } },
    ];
    expect(dailyFive(s, '2026-11-12').map((n) => n.id)).toEqual(['b', 'f', 'c', 'e']);
    expect(dailyFive(s, '2026-11-14', 2).map((n) => n.id)).toEqual(['b', 'f']);
    expect(dailyFive(s, '2026-11-12', 5, ['b', 'c']).map((n) => n.id)).toEqual(['f', 'e']);
  });
});

describe('activity and candles', () => {
  it('adds to a day’s activity without going below zero', () => {
    const a = addActivity({}, '2026-11-12', { quests: 1, focusMinutes: 25 });
    expect(a['2026-11-12']).toEqual({ quests: 1, spells: 0, focusMinutes: 25, cards: 0 });
    expect(addActivity(a, '2026-11-12', { quests: -3 })['2026-11-12'].quests).toBe(0);
  });

  it('lights a day for any small win', () => {
    expect(isLit(undefined)).toBe(false);
    expect(isLit({ quests: 0, spells: 0, focusMinutes: 0, cards: 0 })).toBe(false);
    expect(isLit({ quests: 0, spells: 0, focusMinutes: 0, cards: 1 })).toBe(true);
  });

  it('finds the Monday of a week', () => {
    expect(mondayOf('2026-11-12')).toBe('2026-11-09');
    expect(mondayOf('2026-11-09')).toBe('2026-11-09');
    expect(mondayOf('2026-11-15')).toBe('2026-11-09');
  });

  it('lays out this week’s candles Mon–Sun', () => {
    const s = { ...createSeedState(), activity: { '2026-11-10': { quests: 2, spells: 0, focusMinutes: 0, cards: 0 } } };
    const week = weekCandles(s, '2026-11-12');
    expect(week.map((c) => c.date)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
    expect(week.map((c) => c.lit)).toEqual([false, true, false, false, false, false, false]);
    expect(week[3]).toMatchObject({ isToday: true, isFuture: false });
    expect(week[4]).toMatchObject({ isToday: false, isFuture: true });
  });
});

describe('weekly summary', () => {
  const lastWeek = (): VesperaState => ({
    ...createSeedState(),
    activity: {
      '2026-11-10': { quests: 3, spells: 1, focusMinutes: 50, cards: 5 },
      '2026-11-12': { quests: 2, spells: 0, focusMinutes: 25, cards: 0 },
    },
  });

  it('recaps last week on the first visit of a new week', () => {
    expect(weeklySummary(lastWeek(), '2026-11-16')).toEqual({
      weekStart: '2026-11-09', candles: 2, quests: 5, spells: 1, focusMinutes: 75, cards: 5,
    });
  });

  it('stays quiet once dismissed, when switched off, or when last week was empty', () => {
    expect(weeklySummary({ ...lastWeek(), lastSummaryWeek: '2026-11-16' }, '2026-11-18')).toBeNull();
    const off = lastWeek();
    off.settings = { ...off.settings, weeklySummary: false };
    expect(weeklySummary(off, '2026-11-16')).toBeNull();
    expect(weeklySummary(lastWeek(), '2026-11-30')).toBeNull();
  });
});

describe('seasonFor', () => {
  it('dresses Vespera by date', () => {
    expect(seasonFor('2026-10-31')).toBe('autumn');
    expect(seasonFor('2026-11-05')).toBe('autumn');
    expect(seasonFor('2026-11-12')).toBe('winter');
    expect(seasonFor('2027-01-31')).toBe('winter');
    expect(seasonFor('2027-02-14')).toBe('valentine');
    expect(seasonFor('2027-04-01')).toBe('spring');
    expect(seasonFor('2027-07-04')).toBeNull();
  });
});
