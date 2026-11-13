// CG-06 · Medium · Push 30m, the running-late slide and capture "slide" push blocks past midnight (end > 1440).
import {
  applyCapture,
  canShift,
  createBaseState,
  occurrencesForDate,
  parseCapture,
  rippleTimes,
  vesperaReducer,
  type VesperaState,
} from './VesperaContext';

const today = '2026-11-12';
const DAY = 24 * 60;

function lateEvening(): VesperaState {
  const s = createBaseState(today);
  s.blocks = [
    { id: 'blk-read', date: today, title: 'Read in bed', kind: 'flexible', start: 22 * 60 + 30, end: 23 * 60 + 15 },
    { id: 'blk-wind', date: today, title: 'Wind down', kind: 'flexible', start: 23 * 60 + 15, end: 23 * 60 + 45 },
  ];
  return s;
}

const everyTimeFits = (s: VesperaState) => occurrencesForDate(s, today).every((o) => o.start === null || (o.start >= 0 && o.end! <= DAY && o.start < o.end!));

it('rippleTimes never returns a time past midnight', () => {
  const day = occurrencesForDate(lateEvening(), today);
  const moved = rippleTimes(day, 'blk-read', 30);
  for (const t of Object.values(moved)) expect(t.end).toBeLessThanOrEqual(DAY);
});

it('the Push 30m button on a late block keeps every block inside the day', () => {
  const pushed = vesperaReducer(lateEvening(), { type: 'pushOccurrence', date: today, key: 'blk-read', deltaMinutes: 30 });
  expect(everyTimeFits(pushed)).toBe(true);
});

it('"slide 4h" at 10 pm is refused (or clamped), like "Blocks can’t run past midnight" for new blocks', () => {
  const state = lateEvening();
  const intent = parseCapture('slide 4h', state, today, 22 * 60)!;
  if (intent.kind === 'unknown') return; // refusing it is fine
  const { state: after } = applyCapture(state, [{ line: 'slide 4h', intent }], ['cap-1'], 1);
  expect(everyTimeFits(after)).toBe(true);
});

describe('edges of the day', () => {
  it('a push that ends exactly at midnight still fits', () => {
    const day = occurrencesForDate(lateEvening(), today);
    expect(rippleTimes(day, 'blk-wind', 15)).toEqual({ 'blk-wind': { start: 23 * 60 + 30, end: DAY } });
    expect(canShift(day, 'blk-wind', 15)).toBe(true);
    expect(canShift(day, 'blk-wind', 16)).toBe(false);
  });

  it('refuses the whole move when only a later, rippled block would spill over', () => {
    // Pushing "Read in bed" 20m fits on its own (ends 23:35) but would ripple "Wind down" to end at 00:05.
    const day = occurrencesForDate(lateEvening(), today);
    expect(rippleTimes(day, 'blk-read', 20)).toEqual({});
    expect(canShift(day, 'blk-read', 15)).toBe(true);
  });

  it('never pulls a block before the start of the day', () => {
    const s = createBaseState(today);
    s.blocks = [{ id: 'early', date: today, title: 'Dawn walk', kind: 'flexible', start: 10, end: 40 }];
    expect(rippleTimes(occurrencesForDate(s, today), 'early', -30)).toEqual({});
  });

  it('a refused push leaves the board untouched', () => {
    const before = lateEvening();
    expect(vesperaReducer(before, { type: 'pushOccurrence', date: today, key: 'blk-read', deltaMinutes: 30 })).toBe(before);
  });

  it('"slide" says why it was refused, in the same words as a new block', () => {
    expect(parseCapture('slide 4h', lateEvening(), today, 22 * 60)).toMatchObject({ kind: 'unknown', reason: 'Blocks can’t run past midnight' });
    expect(parseCapture('slide 10m', lateEvening(), today, 22 * 60)).toMatchObject({ kind: 'slide', minutes: 10 });
  });
});
