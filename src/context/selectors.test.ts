import { rollover } from './rollover';
import {
  activeCategoryIds,
  currentOccurrence,
  isCarriedOver,
  lateOffer,
  openCountByCategory,
  pickUnstickAction,
  todayProgress,
  visibleCategories,
} from './selectors';
import { occurrencesForDate } from './recurrence';
import { createSeedState } from '../test/ownerWeek';

const seed = createSeedState();

describe('isCarriedOver', () => {
  it('is true only for open quests past their due date', () => {
    const t = { id: 't', title: 't', categoryId: 'c', done: false, dueDate: '2026-11-12' };
    expect(isCarriedOver(t, '2026-11-12')).toBe(false);
    expect(isCarriedOver(t, '2026-11-13')).toBe(true);
    expect(isCarriedOver({ ...t, done: true }, '2026-11-13')).toBe(false);
    expect(isCarriedOver({ ...t, dueDate: undefined }, '2026-11-13')).toBe(false);
  });
});

describe('todayProgress', () => {
  it('counts quests finished today against today’s open + finished', () => {
    const tasks = seed.tasks.map((t, i) =>
      i === 0 ? { ...t, done: true, completedOn: '2026-11-12' } : i === 1 ? { ...t, done: true, completedOn: '2026-11-11' } : t,
    );
    expect(todayProgress(tasks, '2026-11-12')).toEqual({ done: 1, total: 8, ratio: 1 / 8 });
    expect(todayProgress([], '2026-11-12')).toEqual({ done: 0, total: 0, ratio: 0 });
  });
});

describe('occurrence selectors', () => {
  const thu = occurrencesForDate(seed, '2026-11-12');

  it('finds the occurrence in progress', () => {
    expect(currentOccurrence(thu, 600)?.key).toBe('ser-thu-desk@2026-11-12');
    expect(currentOccurrence(thu, 800)).toBeNull();
  });

  it('lists categories linked to an in-progress block', () => {
    expect(activeCategoryIds(seed, '2026-11-12', 600)).toEqual(['cat-job2']);
    expect(activeCategoryIds(seed, '2026-11-12', 800)).toEqual([]);
  });

  it('offers to slide when a movable block started > threshold ago and is not begun', () => {
    // Wed cook block 5:30 PM; threshold 10 min
    expect(lateOffer(seed, '2026-11-11', 1059)).toBeNull();
    expect(lateOffer(seed, '2026-11-11', 1060)?.key).toBe('blk-wed-cook');
    const begun = { ...seed, blocks: seed.blocks.map((b) => (b.id === 'blk-wed-cook' ? { ...b, begun: true } : b)) };
    expect(lateOffer(begun, '2026-11-11', 1060)).toBeNull();
    const off = { ...seed, settings: { ...seed.settings, lateOfferMinutes: 0 as const } };
    expect(lateOffer(off, '2026-11-11', 1060)).toBeNull();
  });

  it('never offers to slide anchors', () => {
    expect(lateOffer(seed, '2026-11-12', 560)).toBeNull(); // bookshop shift anchor at 9:00
  });
});

describe('category helpers', () => {
  it('counts open quests per category', () => {
    expect(openCountByCategory(seed.tasks)).toEqual({ 'cat-reset': 3, 'cat-job1': 1, 'cat-grad': 3, 'cat-job2': 2 });
  });

  it('hides archived categories', () => {
    const cats = seed.categories.map((c) => (c.id === 'cat-job2' ? { ...c, archived: true } : c));
    expect(visibleCategories(cats).map((c) => c.id)).toEqual(['cat-reset', 'cat-job1', 'cat-grad']);
  });
});

describe('pickUnstickAction', () => {
  it('draws from open quests in the first category, then the user’s actions', () => {
    expect(pickUnstickAction(seed, () => 0)).toEqual({ action: seed.tasks[0].title, taskId: 'task-sweep' });
    expect(pickUnstickAction(seed, () => 0.99999)).toEqual({ action: seed.settings.unstickActions.at(-1), taskId: null });
  });

  it('falls back to a gentle default when the pool is empty', () => {
    const empty = { ...seed, tasks: [], settings: { ...seed.settings, unstickActions: [] } };
    expect(pickUnstickAction(empty, () => 0)).toEqual({ action: 'Take three slow breaths', taskId: null });
  });
});

describe('rollover', () => {
  it('moves quests finished before today into the chronicle', () => {
    const state = {
      ...seed,
      lastRolloverDate: '2026-11-12',
      tasks: seed.tasks.map((t) =>
        t.id === 'task-sweep' ? { ...t, done: true, completedOn: '2026-11-12' } : t.id === 'task-language-app' ? { ...t, done: true, completedOn: '2026-11-13' } : t,
      ),
    };
    const next = rollover(state, '2026-11-13');
    expect(next.tasks.some((t) => t.id === 'task-sweep')).toBe(false);
    expect(next.tasks.some((t) => t.id === 'task-language-app')).toBe(true); // finished today, stays
    expect(next.chronicle[0]).toMatchObject({ id: 'task-sweep', completedOn: '2026-11-12' });
    expect(next.lastRolloverDate).toBe('2026-11-13');
  });

  it('is a no-op on the same day', () => {
    const state = { ...seed, lastRolloverDate: '2026-11-13' };
    expect(rollover(state, '2026-11-13')).toBe(state);
  });

  it('treats done quests without a completion date as finished on the last rollover day', () => {
    const state = { ...seed, lastRolloverDate: '2026-11-12', tasks: [{ ...seed.tasks[0], done: true }] };
    expect(rollover(state, '2026-11-13').chronicle[0].completedOn).toBe('2026-11-12');
  });
});
