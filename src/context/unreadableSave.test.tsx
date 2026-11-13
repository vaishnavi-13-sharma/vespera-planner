// CG-01 · High · An unreadable save is silently replaced and then overwritten: the board is gone for good.
import { createBaseState, STORAGE_KEY, STORAGE_KEY_V1 } from './VesperaContext';
import { live, mountFromStorage, storedValues } from './storageHarness';

const today = '2026-11-12';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 9, 0));
});
afterEach(() => vi.useRealTimers());

/** A real board with a year of quests, cut off mid-write (a crash, a full disk, a bad sync). */
function truncatedSave(): string {
  const board = createBaseState(today);
  board.tasks = Array.from({ length: 40 }, (_, i) => ({ id: `task-${i}`, title: `My quest ${i}`, categoryId: 'cat-work', done: false }));
  const json = JSON.stringify(board);
  return json.slice(0, json.length - 20);
}

it('keeps a copy of a save it cannot read, instead of overwriting it with the starter board', () => {
  const raw = truncatedSave();
  localStorage.setItem(STORAGE_KEY, raw);

  mountFromStorage();

  // The only copy of the person's board must still exist somewhere they (or a fixer) can recover it from.
  expect(storedValues()).toContain(raw);
});

it('tells the person their saved board could not be read', () => {
  localStorage.setItem(STORAGE_KEY, truncatedSave());

  mountFromStorage();

  expect(live.current!.state.notice).not.toBeNull();
});

it('does not throw away a whole board (and fall back to an old v1 save) because one note is malformed', () => {
  const board = createBaseState(today);
  board.tasks = [{ id: 'task-mine', title: 'This week’s real quest', categoryId: 'cat-work', done: false }];
  // One hand-edited / half-synced note with a numeric id.
  const raw = JSON.stringify({ ...board, notes: [{ id: 7, tagId: 'tag-braindump', text: 'oops' }] });
  localStorage.setItem(STORAGE_KEY, raw);
  // The owner's device still has the original v1 copy from before the upgrade.
  localStorage.setItem(STORAGE_KEY_V1, JSON.stringify({ blocks: [], tasks: [{ id: 't1', title: 'Old v1 quest', category: 'reset', done: false }], notes: [] }));

  mountFromStorage();

  // Either the board is repaired and loaded, or the unreadable copy is kept: it must never be silently destroyed.
  const loadedMine = live.current!.state.tasks.some((t) => t.id === 'task-mine');
  expect(loadedMine || storedValues().includes(raw)).toBe(true);
});
