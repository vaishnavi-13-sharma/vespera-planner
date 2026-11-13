// CG-07 · Medium · A focus session left burning while the app was closed credits all its minutes to the day it is reopened.
import { createBaseState, vesperaReducer, weekCandles, type VesperaState } from './VesperaContext';

const monday = '2026-11-09';
const thursday = '2026-11-12';

function sessionStartedMondayNight(): VesperaState {
  const s = createBaseState(monday);
  s.focusSession = {
    title: 'Thesis chapter',
    date: monday,
    occurrenceKey: 'blk-thesis',
    rhythm: 'whole',
    sound: 'off',
    startedAt: new Date(2026, 10, 9, 20, 0).getTime(), // Mon 8:00 PM
    totalMinutes: 120,
    pausedAt: null,
    pausedMs: 0,
  };
  return s;
}

it('the minutes go to the day the candle actually burned, not the day the app is reopened', () => {
  // The laptop was closed mid-session; the chamber reopens Thursday morning, sees "done" and finishes.
  const now = new Date(2026, 10, 12, 9, 0).getTime();
  const after = vesperaReducer(sessionStartedMondayNight(), { type: 'finishFocus', now, today: thursday });

  expect(after.activity[monday]?.focusMinutes).toBe(120);
  expect(after.activity[thursday]?.focusMinutes ?? 0).toBe(0);
});

it('a session started and finished today still lights today', () => {
  const s = sessionStartedMondayNight();
  s.focusSession = { ...s.focusSession!, startedAt: new Date(2026, 10, 12, 8, 0).getTime(), totalMinutes: 30 };
  const after = vesperaReducer(s, { type: 'finishFocus', now: new Date(2026, 10, 12, 8, 30).getTime(), today: thursday });
  expect(after.activity[thursday]?.focusMinutes).toBe(30);
});

it('a start time in the future (the clock jumped back) is credited to today, never a later day', () => {
  const s = sessionStartedMondayNight();
  s.focusSession = { ...s.focusSession!, startedAt: new Date(2026, 10, 14, 8, 0).getTime(), totalMinutes: 30 };
  const after = vesperaReducer(s, { type: 'finishFocus', now: new Date(2026, 10, 14, 9, 0).getTime(), today: thursday });
  expect(Object.keys(after.activity)).toEqual([thursday]);
});

it('Thursday’s candle is not lit by focus that happened on Monday', () => {
  const now = new Date(2026, 10, 12, 9, 0).getTime();
  const after = vesperaReducer(sessionStartedMondayNight(), { type: 'finishFocus', now, today: thursday });
  const thu = weekCandles(after, thursday).find((c) => c.date === thursday)!;
  expect(thu.lit).toBe(false);
});
