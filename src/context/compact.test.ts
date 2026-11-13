import { compactBoard } from './compact';
import { rollover } from './rollover';
import { createBaseState } from './seed';
import type { ChronicleEntry, VesperaState } from './types';

const today = '2026-11-12';
const entry = (id: string, completedOn: string, title = id, categoryId = 'cat-work'): ChronicleEntry => ({ id, title, categoryId, done: true, completedOn });
const day = (quests: number, spells = 0, focusMinutes = 0, cards = 0) => ({ quests, spells, focusMinutes, cards });
const board = (patch: Partial<VesperaState>): VesperaState => ({ ...createBaseState(today), ...patch });

describe('compactBoard', () => {
  it('keeps entries up to exactly 90 days old and archives anything older', () => {
    const s = compactBoard(board({ chronicle: [entry('d89', '2026-08-15'), entry('d90', '2026-08-14'), entry('d91', '2026-08-13')] }), today);
    expect(s.chronicle.map((c) => c.id)).toEqual(['d89', 'd90']);
    expect(s.chronicleArchive).toEqual([{ month: '2026-08', total: 1, byCategory: { 'cat-work': 1 }, titles: ['d91'] }]);
  });

  it('groups by month, counts per category, and lists titles oldest first', () => {
    // The Chronicle is newest first, as rollover builds it.
    const s = compactBoard(
      board({
        chronicle: [entry('keep', '2026-11-01'), entry('Jul 30', '2026-07-30', 'Jul 30', 'cat-study'), entry('Jul 2b', '2026-07-02'), entry('Jul 2a', '2026-07-02'), entry('Jun 9', '2026-06-09')],
      }),
      today,
    );
    expect(s.chronicle.map((c) => c.id)).toEqual(['keep']);
    expect(s.chronicleArchive).toEqual([
      { month: '2026-06', total: 1, byCategory: { 'cat-work': 1 }, titles: ['Jun 9'] },
      { month: '2026-07', total: 3, byCategory: { 'cat-work': 2, 'cat-study': 1 }, titles: ['Jul 2a', 'Jul 2b', 'Jul 30'] },
    ]);
  });

  it('merges into months already archived, after their titles', () => {
    const s = compactBoard(
      board({
        chronicle: [entry('new-jul', '2026-07-20'), entry('new-may', '2026-05-01')],
        chronicleArchive: [
          { month: '2026-06', total: 2, byCategory: { 'cat-work': 2 }, titles: ['a', 'b'] },
          { month: '2026-07', total: 1, byCategory: { 'cat-study': 1 }, titles: ['old-jul'] },
        ],
      }),
      today,
    );
    expect(s.chronicleArchive).toEqual([
      { month: '2026-05', total: 1, byCategory: { 'cat-work': 1 }, titles: ['new-may'] },
      { month: '2026-06', total: 2, byCategory: { 'cat-work': 2 }, titles: ['a', 'b'] },
      { month: '2026-07', total: 2, byCategory: { 'cat-study': 1, 'cat-work': 1 }, titles: ['old-jul', 'new-jul'] },
    ]);
  });

  it('caps titles at 120 characters and 500 a month, counting the rest only in the total', () => {
    const chronicle = Array.from({ length: 3 }, (_, i) => entry(`e${i}`, '2026-07-01', `${'✨'.repeat(130)}${i}`));
    const s = compactBoard(
      board({ chronicle, chronicleArchive: [{ month: '2026-07', total: 520, byCategory: { 'cat-work': 520 }, titles: Array.from({ length: 499 }, (_, i) => `t${i}`) }] }),
      today,
    );
    const [july] = s.chronicleArchive;
    expect(july.total).toBe(523);
    expect(july.byCategory).toEqual({ 'cat-work': 523 });
    expect(july.titles).toHaveLength(500);
    expect(july.titles[499]).toBe('✨'.repeat(120));
  });

  it('moves activity days older than 90 days into monthly sums', () => {
    const s = compactBoard(
      board({ activity: { '2026-11-10': day(1), '2026-08-14': day(1), '2026-08-13': day(2, 1, 25, 3), '2026-08-01': day(1, 0, 5), '2026-07-31': day(4) } }),
      today,
    );
    expect(Object.keys(s.activity).sort()).toEqual(['2026-08-14', '2026-11-10']);
    expect(s.activityArchive).toEqual([
      { month: '2026-07', quests: 4, spells: 0, focusMinutes: 0, cards: 0 },
      { month: '2026-08', quests: 3, spells: 1, focusMinutes: 30, cards: 3 },
    ]);
  });

  it('merges activity into months already archived', () => {
    const s = compactBoard(board({ activity: { '2026-07-31': day(4) }, activityArchive: [{ month: '2026-07', quests: 1, spells: 1, focusMinutes: 1, cards: 1 }] }), today);
    expect(s.activityArchive).toEqual([{ month: '2026-07', quests: 5, spells: 1, focusMinutes: 1, cards: 1 }]);
  });

  it('is idempotent, and returns the very same board when there is nothing to archive', () => {
    const s = board({ chronicle: [entry('old', '2026-01-01'), entry('new', '2026-11-01')], activity: { '2026-01-01': day(1), '2026-11-01': day(1) } });
    const once = compactBoard(s, today);
    expect(compactBoard(once, today)).toBe(once);
    const fresh = board({ chronicle: [entry('new', '2026-11-01')] });
    expect(compactBoard(fresh, today)).toBe(fresh);
  });

  it('does not change the board it is given', () => {
    const s = board({ chronicle: [entry('old', '2026-01-01')], activity: { '2026-01-01': day(1) } });
    const copy = structuredClone(s);
    compactBoard(s, today);
    expect(s).toStrictEqual(copy);
  });
});

describe('rollover compacts', () => {
  it('archives what has grown old on each new day', () => {
    const s = board({ lastRolloverDate: '2026-11-11', chronicle: [entry('old', '2026-08-13')], activity: { '2026-08-13': day(1) } });
    const next = rollover(s, today);
    expect(next.chronicle).toEqual([]);
    expect(next.chronicleArchive).toHaveLength(1);
    expect(next.activity).toEqual({});
  });

  it('archives a quest finished long ago as it reaches the Chronicle', () => {
    const s = board({ lastRolloverDate: '2026-01-01', tasks: [{ id: 't', title: 'Long done', categoryId: 'cat-work', done: true, completedOn: '2026-01-01' }] });
    const next = rollover(s, today);
    expect(next.tasks).toEqual([]);
    expect(next.chronicleArchive).toEqual([{ month: '2026-01', total: 1, byCategory: { 'cat-work': 1 }, titles: ['Long done'] }]);
  });
});
