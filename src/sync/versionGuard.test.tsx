// Wave 3 · The version guard: a device must never overwrite (or strip) a board written by newer Vespera.
// When a pulled, live or conflicting row is from the future, or the database refuses a downgrade (VSP01),
// sync pauses as 'update-required': nothing is applied, nothing is pushed, and local edits stay on the device.
import { act, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../components/ui/Toast';
import { SCHEMA_VERSION } from '../context/schema';
import { parseState, persistable, saveState, userStorageKey } from '../context/storage';
import { useVespera } from '../context/VesperaContext';
import { createFakeBackend, ME } from '../test/fakeBackend';
import { createSeedState } from '../test/ownerWeek';
import { syncFingerprint } from './logic';
import { CONFLICT_BACKUP_PREFIX, PUSH_DEBOUNCE_MS, SyncProvider, useSync } from './SyncProvider';

// saveState never overwrites a newer stored board (Fixer 2's rule in src/context/storage.ts). It's restated here
// so these tests check sync on its own: every board sync caches goes through saveState, and sync never pushes it.
vi.mock('../context/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/storage')>();
  const { isFromTheFuture } = await import('../context/schema');
  return {
    ...actual,
    saveState: (...args: Parameters<typeof actual.saveState>) => {
      const [, storage, key] = args;
      try {
        const raw = storage?.getItem(key ?? actual.STORAGE_KEY);
        if (raw && isFromTheFuture(JSON.parse(raw))) return;
      } catch {
        // unreadable: the real saveState decides
      }
      actual.saveState(...args);
    },
  };
});

function Probe() {
  const { state, addTask } = useVespera();
  const sync = useSync();
  return (
    <div>
      <p data-testid="status">{sync.status}</p>
      <p data-testid="problem">{sync.problem ?? ''}</p>
      <p data-testid="tasks">{state.tasks.map((t) => t.title).join(' | ')}</p>
      <button onClick={() => addTask('Fresh quest', state.categories[0].id)}>add</button>
    </div>
  );
}

const renderSync = (fake: ReturnType<typeof createFakeBackend>) =>
  render(
    <ToastProvider>
      <SyncProvider backend={fake.backend}>
        <Probe />
      </SyncProvider>
    </ToastProvider>,
  );
const text = (id: string) => screen.getByTestId(id).textContent;
const owner = () => createSeedState();
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, PUSH_DEBOUNCE_MS + 150)));
const backups = () => Object.keys(localStorage).filter((k) => k.startsWith(CONFLICT_BACKUP_PREFIX));

/** A board newer Vespera wrote: a higher schemaVersion and a field this code has never heard of. */
function futureBoard(title = 'Written by newer Vespera') {
  const board = persistable(owner());
  return {
    ...board,
    schemaVersion: SCHEMA_VERSION + 1,
    tasks: [{ id: 'future', title, categoryId: board.categories[0].id, done: false }],
    constellations: [{ id: 'c1', stars: 7 }],
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 12, 0));
});
afterEach(() => vi.useRealTimers());

async function signedIn() {
  const fake = createFakeBackend({ user: ME, rows: { [ME.id]: { state: owner(), updatedAt: '2026-11-12T00:00:00.000Z' } } });
  renderSync(fake);
  await waitFor(() => expect(text('status')).toBe('synced'));
  return fake;
}

describe('a row from a newer Vespera', () => {
  it('on sign-in: is not applied, nothing is pushed, and local edits keep saving on this device only', async () => {
    saveState(owner(), localStorage, userStorageKey(ME.id)); // this device's copy of the account
    const future = futureBoard();
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: { state: future, updatedAt: '2026-11-12T00:00:00.000Z' } } });
    renderSync(fake);
    await waitFor(() => expect(text('status')).toBe('update-required'));
    expect(text('tasks')).toContain('Eat quick bridge fuel');
    expect(text('tasks')).not.toContain('Written by newer Vespera');
    expect(text('problem')).toBe('');

    act(() => screen.getByText('add').click());
    await settle();
    expect(text('status')).toBe('update-required');
    expect(fake.pushes).toEqual([]);
    expect(fake.table.get(ME.id)!.state).toEqual(future);
    expect(localStorage.getItem(userStorageKey(ME.id))).toContain('Fresh quest');
  });

  it('live, over Realtime: pauses instead of applying it, and stops pushing', async () => {
    const fake = await signedIn();
    const future = futureBoard();
    act(() => fake.remoteEdit(ME.id, future));
    expect(text('status')).toBe('update-required');
    expect(text('tasks')).not.toContain('Written by newer Vespera');

    act(() => screen.getByText('add').click());
    await settle();
    expect(text('status')).toBe('update-required');
    expect(fake.pushes).toEqual([]);
    expect(fake.table.get(ME.id)!.state).toEqual(future);
  });

  it('pulled on focus: pauses too', async () => {
    const fake = await signedIn();
    fake.table.set(ME.id, { state: futureBoard(), updatedAt: '2026-11-12T08:00:00.000Z' }); // no Realtime event
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });
    await waitFor(() => expect(text('status')).toBe('update-required'));
    expect(text('tasks')).not.toContain('Written by newer Vespera');
  });

  it('met in a push conflict: neither adopted, backed up over, nor overwritten', async () => {
    const fake = await signedIn();
    act(() => screen.getByText('add').click());
    const future = futureBoard();
    fake.table.set(ME.id, { state: future, updatedAt: '2099-01-01T00:00:00.000Z' }); // newer code wrote first, unheard
    await settle();
    expect(text('status')).toBe('update-required');
    expect(text('tasks')).toContain('Fresh quest');
    expect(fake.table.get(ME.id)!.state).toEqual(future);
    expect(backups()).toEqual([]);
  });

  it('is spotted by the row’s schema_version column alone', async () => {
    const fake = await signedIn();
    act(() => fake.remoteEdit(ME.id, { ...persistable(owner()), tasks: [] }, undefined, { schemaVersion: SCHEMA_VERSION + 1 }));
    expect(text('status')).toBe('update-required');
    expect(text('tasks')).toContain('Eat quick bridge fuel');
  });
});

describe('a newer board cached on this device (e.g. after a rollback)', () => {
  const cacheFuture = () => {
    const raw = JSON.stringify(futureBoard('Kept by newer Vespera'));
    localStorage.setItem(userStorageKey(ME.id), raw);
    return raw;
  };

  it('is never overwritten by the cloud board, and nothing is pushed', async () => {
    const raw = cacheFuture();
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: { state: owner(), updatedAt: '2026-11-12T00:00:00.000Z' } } });
    renderSync(fake);
    await waitFor(() => expect(text('status')).toBe('update-required'));
    await settle();
    expect(localStorage.getItem(userStorageKey(ME.id))).toBe(raw);
    expect(fake.pushes).toEqual([]);
  });

  it('is never uploaded (stripped) when the cloud row is missing, nor overwritten', async () => {
    const raw = cacheFuture();
    const fake = createFakeBackend({ user: ME });
    renderSync(fake);
    await waitFor(() => expect(text('status')).toBe('update-required'));
    await settle();
    expect(localStorage.getItem(userStorageKey(ME.id))).toBe(raw);
    expect(fake.pushes).toEqual([]);
    expect(fake.table.has(ME.id)).toBe(false);
  });
});

describe('the database refusing a downgrade (VSP01)', () => {
  it('reads “update-required”, never “error” or “offline”, and stops pushing until reload', async () => {
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: { state: owner(), updatedAt: '2026-11-12T00:00:00.000Z' } } });
    let calls = 0;
    fake.backend.store.push = async () => {
      calls++;
      throw { code: 'VSP01', message: 'schema downgrade' };
    };
    renderSync(fake);
    await waitFor(() => expect(text('status')).toBe('synced'));
    act(() => screen.getByText('add').click());
    await settle();
    expect(text('status')).toBe('update-required');
    expect(text('problem')).toBe('');
    expect(calls).toBe(1);

    act(() => screen.getByText('add').click());
    await settle();
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });
    expect(calls).toBe(1);
    expect(text('status')).toBe('update-required');
    expect(localStorage.getItem(userStorageKey(ME.id))).toContain('Fresh quest');
  });

  it('comes from the fake server too, like the 0003 trigger', async () => {
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: { state: owner(), updatedAt: '2026-11-12T00:00:00.000Z', schemaVersion: SCHEMA_VERSION + 1 } } });
    await expect(fake.backend.store.push(ME.id, persistable(owner()), '2026-11-12T00:00:00.000Z')).rejects.toEqual({ code: 'VSP01', message: 'schema downgrade' });
  });
});

describe('after the reload', () => {
  it('edits made while paused are kept as a backup when the cloud board is opened', async () => {
    const paused = createFakeBackend({ user: ME, rows: { [ME.id]: { state: futureBoard(), updatedAt: '2026-11-12T00:00:00.000Z' } } });
    const first = renderSync(paused);
    await waitFor(() => expect(text('status')).toBe('update-required'));
    act(() => screen.getByText('add').click()); // saved on this device only
    await settle();
    first.unmount();

    // Reloaded (now able to read the cloud board): the cloud board opens, and the paused edits are kept aside.
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: { state: owner(), updatedAt: '2026-11-12T09:00:00.000Z' } } });
    renderSync(fake);
    await waitFor(() => expect(text('status')).toBe('synced'));
    expect(text('tasks')).not.toContain('Fresh quest');
    expect(backups()).toHaveLength(1);
    expect(localStorage.getItem(backups()[0])).toContain('Fresh quest');
    expect(screen.getByRole('status')).toHaveTextContent(/saved as a backup/);
  });

  it('if those edits can’t be set aside (storage full), they stay as they are and syncing waits', async () => {
    const paused = createFakeBackend({ user: ME, rows: { [ME.id]: { state: futureBoard(), updatedAt: '2026-11-12T00:00:00.000Z' } } });
    const first = renderSync(paused);
    await waitFor(() => expect(text('status')).toBe('update-required'));
    act(() => screen.getByText('add').click());
    await settle();
    first.unmount();
    const kept = localStorage.getItem(userStorageKey(ME.id));
    expect(kept).toContain('Fresh quest');

    const realSetItem = Storage.prototype.setItem;
    const full = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key.startsWith(CONFLICT_BACKUP_PREFIX)) throw new DOMException('full', 'QuotaExceededError');
      realSetItem.call(this, key, value);
    });
    try {
      const fake = createFakeBackend({ user: ME, rows: { [ME.id]: { state: owner(), updatedAt: '2026-11-12T09:00:00.000Z' } } });
      renderSync(fake);
      await waitFor(() => expect(text('status')).toBe('error'));
      expect(text('problem')).toMatch(/too full to set aside/);
      expect(text('tasks')).toContain('Fresh quest');
      await settle();
      // The board re-saves itself on mount (key order may differ), but nothing in it was replaced.
      const board = (raw: string | null) => syncFingerprint(parseState(JSON.parse(raw!))!);
      expect(board(localStorage.getItem(userStorageKey(ME.id)))).toBe(board(kept));
      expect(fake.pushes).toEqual([]);
    } finally {
      full.mockRestore();
    }
  });

  it('a plain sign-in with an older copy on this device keeps no backup', async () => {
    saveState(owner(), localStorage, userStorageKey(ME.id));
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: { state: { ...owner(), tasks: [] }, updatedAt: '2026-11-12T09:00:00.000Z' } } });
    renderSync(fake);
    await waitFor(() => expect(text('status')).toBe('synced'));
    expect(backups()).toEqual([]);
  });
});
