// CG-02 · High · Two open tabs (or the installed PWA plus a browser tab) silently erase each other's edits.
import { act } from '@testing-library/react';
import { createBaseState, STORAGE_KEY, type VesperaState } from './VesperaContext';
import { live, mountFromStorage } from './storageHarness';

const today = '2026-11-12';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 9, 0));
});
afterEach(() => vi.useRealTimers());

const saved = (): VesperaState => JSON.parse(localStorage.getItem(STORAGE_KEY)!);

/** What the browser does in THIS tab when ANOTHER tab of the same origin writes the board. */
function otherTabWrites(board: VesperaState) {
  const newValue = JSON.stringify(board);
  const oldValue = localStorage.getItem(STORAGE_KEY);
  localStorage.setItem(STORAGE_KEY, newValue);
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, oldValue, newValue, storageArea: localStorage }));
  });
}

it('a quest added in another tab survives the next edit made in this tab', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(createBaseState(today)));
  mountFromStorage();

  // Tab B (e.g. the phone-sized PWA window) adds a quest and saves.
  const tabB = createBaseState(today);
  tabB.tasks = [{ id: 'task-from-b', title: 'Added in the other tab', categoryId: 'cat-work', done: false }];
  otherTabWrites(tabB);

  // Tab A (this one, still open) then checks something else off / adds a quest.
  act(() => live.current!.addTask('Added in this tab', 'cat-work'));

  const titles = saved().tasks.map((t) => t.title);
  expect(titles).toContain('Added in this tab');
  expect(titles).toContain('Added in the other tab');
});

it('ignores a half-written save from another tab, and other keys', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(createBaseState(today)));
  mountFromStorage();
  act(() => live.current!.addTask('Mine', 'cat-work'));

  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: '{"version":2,"tas', storageArea: localStorage }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'vespera_state_v2:someone-else', newValue: JSON.stringify(createBaseState(today)), storageArea: localStorage }));
  });

  expect(live.current!.state.tasks.map((t) => t.title)).toEqual(['Mine']);
});

it('keeps this tab’s own notice when adopting the other tab’s board', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(createBaseState(today)));
  mountFromStorage();
  act(() => {
    live.current!.importBackup('not a backup');
  });

  otherTabWrites(createBaseState(today));

  expect(live.current!.state.notice).toBe('import-failed');
});

it('does not write the adopted board straight back (no ping-pong between tabs)', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(createBaseState(today)));
  mountFromStorage();
  const setItem = vi.spyOn(Storage.prototype, 'setItem');

  const tabB = createBaseState(today);
  tabB.tasks = [{ id: 'task-from-b', title: 'Added in the other tab', categoryId: 'cat-work', done: false }];
  otherTabWrites(tabB);

  expect(setItem).toHaveBeenCalledTimes(1); // only the other tab's own write in otherTabWrites
  setItem.mockRestore();
});

it('this tab shows what another tab saved, instead of a stale board', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(createBaseState(today)));
  mountFromStorage();

  const tabB = createBaseState(today);
  tabB.notes = [{ id: 'note-from-b', tagId: 'tag-braindump', text: 'Pinned in the other tab' }];
  otherTabWrites(tabB);

  expect(live.current!.state.notes.map((n) => n.id)).toContain('note-from-b');
});
