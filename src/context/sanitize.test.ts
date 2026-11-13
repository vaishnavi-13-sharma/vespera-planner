import { createSeedState } from '../test/ownerWeek';
import { occurrencesForDate } from './recurrence';
import { isDateKey, sanitizeBoard, sanitizeSettings } from './sanitize';
import { createStarterState, DEFAULT_SETTINGS } from './seed';
import type { VesperaState } from './types';

const today = '2026-11-12';
const roundTrip = (s: VesperaState) => JSON.parse(JSON.stringify(s));

/** A real board with one part edited, as untrusted JSON. */
function edited(edit: (s: Record<string, any>) => void) {
  const board = roundTrip(createSeedState());
  edit(board);
  return board;
}

describe('sanitizeBoard', () => {
  it('passes real boards through unchanged, dropping nothing', () => {
    for (const board of [createSeedState(), createStarterState(today, 600)]) {
      expect(sanitizeBoard(roundTrip(board))).toEqual({ state: board, dropped: 0 });
    }
  });

  it('rejects things that are not a v2 board at all', () => {
    expect(sanitizeBoard(null)).toBeNull();
    expect(sanitizeBoard('board')).toBeNull();
    expect(sanitizeBoard(edited((s) => (s.version = 3)))).toBeNull();
    expect(sanitizeBoard(edited((s) => (s.notes = {})))).toBeNull();
  });

  it('drops items missing what they cannot live without, and repeated ids, and counts them', () => {
    const result = sanitizeBoard(
      edited((s) => {
        s.tasks.push({ id: 'task-no-title', categoryId: 'cat-reset', done: false });
        s.tasks.push({ ...s.tasks[0] }); // same id twice
        s.blocks.push({ id: 'blk-no-date', title: 'Lost', kind: 'focus', start: 60, end: 120 });
        s.series.push({ id: 'ser-odd', title: 'Odd', kind: 'flexible', start: 60, end: 120, startDate: today, repeat: { freq: 'hourly' } });
        s.chronicle.push({ id: 'chr-1', title: 'Done once', categoryId: 'cat-reset', done: true });
        s.notes.push('just a string');
      }),
    )!;
    expect(result.dropped).toBe(6);
    expect(result.state.tasks).toEqual(createSeedState().tasks);
    expect(result.state.blocks).toEqual(createSeedState().blocks);
  });

  it('repairs fields that have a sensible default instead of dropping the item', () => {
    const { state, dropped } = sanitizeBoard(
      edited((s) => {
        s.categories[0].accent = 'purple';
        s.categories[0].emoji = 42;
        s.blocks[0].kind = 'party';
        s.blocks[0].start = '9am';
        s.blocks[1].accent = 'neon';
        s.series[0].repeat = { freq: 'weekly', interval: 9, weekdays: [4, 4, 'thu', 12] };
        s.notes[3].review = { step: 99, due: today };
      }),
    )!;
    expect(dropped).toBe(0);
    expect(state.categories[0]).toMatchObject({ accent: 'gold', emoji: '✨' });
    expect(state.blocks[0]).toMatchObject({ kind: 'flexible', start: null, end: null });
    expect(state.blocks[1].accent).toBeUndefined();
    expect(state.series[0].repeat).toEqual({ freq: 'weekly', interval: 1, weekdays: [4] });
    expect(state.notes[3].review).toBeUndefined();
  });

  it('gives a weekly series with no usable weekdays the weekday it starts on', () => {
    const { state } = sanitizeBoard(edited((s) => (s.series[0].repeat = { freq: 'weekly', interval: 1, weekdays: [] })))!;
    expect(state.series[0].repeat).toEqual({ freq: 'weekly', interval: 1, weekdays: [4] }); // Nov 12 2026 is a Thursday
    expect(occurrencesForDate(state, '2026-11-19').some((o) => o.key.startsWith('ser-thu-desk'))).toBe(true);
  });

  it('keeps each usable override field and drops the rest, and drops exceptions on impossible dates', () => {
    const { state, dropped } = sanitizeBoard(
      edited((s) => {
        s.exceptions = {
          'ser-thu-desk': {
            '2026-11-19': { skipped: 'yes', begun: true, overrides: { start: '10:00', end: 700, title: { x: 1 }, kind: 'focus' } },
            '2026-02-30': { skipped: true },
          },
          'ser-fri-desk': 'nope',
        };
      }),
    )!;
    expect(dropped).toBe(2);
    expect(state.exceptions).toEqual({ 'ser-thu-desk': { '2026-11-19': { begun: true, overrides: { end: 700, kind: 'focus' } } } });
  });

  it('keeps a "__proto__" id as a plain key, never a prototype', () => {
    const board = JSON.parse(JSON.stringify(createSeedState()).replace('"exceptions":{}', '"exceptions":{"__proto__":{"2026-11-19":{"skipped":true}}}'));
    const { state } = sanitizeBoard(board)!;
    expect(Object.getPrototypeOf(state.exceptions)).toBe(Object.prototype);
    expect(Object.keys(state.exceptions)).toEqual(['__proto__']);
  });

  it('clips giant strings without splitting an emoji', () => {
    const { state } = sanitizeBoard(edited((s) => (s.tasks[0].title = '🕯️'.repeat(5_000))))!;
    expect(Array.from(state.tasks[0].title)).toHaveLength(1_000);
    expect(/[\uD800-\uDBFF]$/.test(state.tasks[0].title)).toBe(false); // no half of a surrogate pair at the end
  });

  it('coerces activity to whole, non-negative counts on real dates', () => {
    const { state } = sanitizeBoard(
      edited((s) => (s.activity = { '2026-11-12': { quests: 2.7, spells: -1, focusMinutes: 'lots' }, nonsense: { quests: 1 }, '2026-11-11': null })),
    )!;
    expect(state.activity).toEqual({ '2026-11-12': { quests: 2, spells: 0, focusMinutes: 0, cards: 0 } });
  });

  it('keeps a complete focus session and drops one with a broken timer', () => {
    const session = { title: 'x', date: today, occurrenceKey: 'k', rhythm: 'whole', sound: 'off', startedAt: 5, totalMinutes: 60, pausedAt: null, pausedMs: 0 };
    expect(sanitizeBoard(edited((s) => (s.focusSession = session)))!.state.focusSession).toEqual(session);
    expect(sanitizeBoard(edited((s) => (s.focusSession = { ...session, pausedMs: null })))!.state.focusSession).toBeNull();
    expect(sanitizeBoard(edited((s) => (s.focusSession = { ...session, totalMinutes: 0 })))!.state.focusSession).toBeNull();
  });

  it('never carries over transient or unknown fields', () => {
    const { state } = sanitizeBoard(edited((s) => Object.assign(s, { notice: 'import-failed', focusVeil: { action: 'x' }, captureLog: [{}], extra: 'junk' })))!;
    expect(state).toMatchObject({ notice: null, focusVeil: null, captureLog: [] });
    expect('extra' in state).toBe(false);
  });
});

describe('sanitizeSettings', () => {
  it('fills in a missing or non-object settings block with the defaults', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('loud')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps a valid day and only falls back when the day would end before (or as) it starts', () => {
    expect(sanitizeSettings({ dayStart: 6 * 60, dayEnd: 22 * 60 })).toMatchObject({ dayStart: 360, dayEnd: 1320 });
    expect(sanitizeSettings({ dayStart: 600, dayEnd: 600 })).toMatchObject({ dayStart: DEFAULT_SETTINGS.dayStart, dayEnd: DEFAULT_SETTINGS.dayEnd });
  });

  it('keeps only the text actions in the unstick list', () => {
    expect(sanitizeSettings({ unstickActions: ['Breathe', 3, '  ', null, 'Stretch'] }).unstickActions).toEqual(['Breathe', 'Stretch']);
  });

  it('still checks the Sanctuary settings', () => {
    expect(sanitizeSettings({ realm: 'disco', signet: 'wax' })).toMatchObject({ realm: 'velvet', signet: DEFAULT_SETTINGS.signet });
  });
});

describe('isDateKey', () => {
  it('accepts only real calendar dates', () => {
    expect(isDateKey('2028-02-29')).toBe(true);
    expect(isDateKey('2026-02-29')).toBe(false);
    expect(isDateKey('2026-13-01')).toBe(false);
    expect(isDateKey('2026-1-1')).toBe(false);
    expect(isDateKey(20261112)).toBe(false);
  });
});

describe('sanitizeBoard: the Chronicle and activity archives', () => {
  const month = { month: '2026-07', total: 3, byCategory: { 'cat-reset': 2, 'cat-job1': 1 }, titles: ['a', 'b', 'c'] };
  const activityMonth = { month: '2026-07', quests: 3, spells: 1, focusMinutes: 25, cards: 0 };

  it('keeps good archive months as they are, oldest first', () => {
    const later = { ...month, month: '2026-08' };
    const result = sanitizeBoard(
      edited((s) => {
        s.chronicleArchive = [later, month];
        s.activityArchive = [{ ...activityMonth, month: '2026-08' }, activityMonth];
      }),
    );
    expect(result?.dropped).toBe(0);
    expect(result?.state.chronicleArchive).toEqual([month, later]);
    expect(result?.state.activityArchive).toEqual([activityMonth, { ...activityMonth, month: '2026-08' }]);
  });

  it('drops bad months and counts them', () => {
    const result = sanitizeBoard(
      edited((s) => {
        s.chronicleArchive = [month, 'x', null, { ...month, month: '2026-13' }, { ...month, month: 'July' }, { total: 1 }];
        s.activityArchive = [activityMonth, [], { ...activityMonth, month: '2026-7' }];
      }),
    );
    expect(result?.state.chronicleArchive).toEqual([month]);
    expect(result?.state.activityArchive).toEqual([activityMonth]);
    expect(result?.dropped).toBe(7);
  });

  it('treats an archive that is not a list as empty, and counts it', () => {
    const result = sanitizeBoard(edited((s) => (s.chronicleArchive = { month: '2026-07' })));
    expect(result?.state.chronicleArchive).toEqual([]);
    expect(result?.dropped).toBe(1);
    expect(sanitizeBoard(edited((s) => delete s.activityArchive))).toMatchObject({ state: { activityArchive: [] }, dropped: 0 });
  });

  it('coerces counts to non-negative whole numbers', () => {
    const result = sanitizeBoard(
      edited((s) => {
        s.chronicleArchive = [{ month: '2026-07', total: -4, byCategory: { 'cat-reset': 2.7, 'cat-job1': -1, 'cat-x': 'many', '': 5 }, titles: [] }];
        s.activityArchive = [{ month: '2026-07', quests: 'x', spells: 2.9, focusMinutes: -10, cards: Infinity }];
      }),
    );
    expect(result?.state.chronicleArchive).toEqual([{ month: '2026-07', total: 0, byCategory: { 'cat-reset': 2, 'cat-job1': 0, 'cat-x': 0 }, titles: [] }]);
    expect(result?.state.activityArchive).toEqual([{ month: '2026-07', quests: 0, spells: 2, focusMinutes: 0, cards: 0 }]);
  });

  it('keeps titles as capped strings, at most 500 a month, and never fewer quests than titles', () => {
    const long = '🌙'.repeat(200);
    const titles = [long, 7, null, ...Array.from({ length: 600 }, (_, i) => `t${i}`)];
    const result = sanitizeBoard(edited((s) => (s.chronicleArchive = [{ month: '2026-07', total: 1, byCategory: {}, titles }])));
    const kept = result!.state.chronicleArchive[0];
    expect(Array.from(kept.titles[0])).toHaveLength(120);
    expect(kept.titles[0]).toBe('🌙'.repeat(120));
    expect(kept.titles).toHaveLength(500);
    expect(kept.titles.every((t) => typeof t === 'string')).toBe(true);
    expect(kept.total).toBe(500);
  });

  it('merges a month that appears twice', () => {
    const result = sanitizeBoard(
      edited((s) => {
        s.chronicleArchive = [month, { month: '2026-07', total: 1, byCategory: { 'cat-reset': 1 }, titles: ['d'] }];
        s.activityArchive = [activityMonth, activityMonth];
      }),
    );
    expect(result?.state.chronicleArchive).toEqual([{ month: '2026-07', total: 4, byCategory: { 'cat-reset': 3, 'cat-job1': 1 }, titles: ['a', 'b', 'c', 'd'] }]);
    expect(result?.state.activityArchive).toEqual([{ month: '2026-07', quests: 6, spells: 2, focusMinutes: 50, cards: 0 }]);
  });

  it('keeps a "__proto__" category id as a harmless plain key', () => {
    const raw = JSON.parse('{"month":"2026-07","total":1,"byCategory":{"__proto__":1},"titles":["x"]}');
    const result = sanitizeBoard(edited((s) => (s.chronicleArchive = [raw])));
    const byCategory = result!.state.chronicleArchive[0].byCategory;
    expect(Object.getPrototypeOf(byCategory)).toBe(Object.prototype);
    expect(Object.hasOwn(byCategory, '__proto__')).toBe(true);
  });
});
