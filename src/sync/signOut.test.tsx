// VB-02 · Signing out leaves the whole account board (and any conflict backups) readable on the device.
// SyncProvider caches each account at `vespera_state_v2:<userId>` and saves conflict losers under the
// un-namespaced `vespera_state_v2_conflict_<ms>`. Neither is cleared on sign-out, so on a shared or
// borrowed laptop the next person can read every quest, note and block from localStorage.
import { act, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../components/ui/Toast';
import { createStarterState } from '../context/seed';
import { STORAGE_KEY, userStorageKey } from '../context/storage';
import { useVespera } from '../context/VesperaContext';
import { conflictBackupKey, CONFLICT_BACKUP_PREFIX, pausedSyncKey, PUSH_DEBOUNCE_MS, SyncProvider, useSync, type SignOutResult } from './SyncProvider';
import { createFakeBackend, ME } from '../test/fakeBackend';

const SECRET = 'Pick up results from the clinic';

function Probe() {
  const { state, addTask } = useVespera();
  const sync = useSync();
  return (
    <div>
      <p data-testid="status">{sync.status}</p>
      <button onClick={() => addTask('A quest typed on this device', state.categories[0].id)}>add</button>
      <button onClick={() => void sync.signOut()}>sign out</button>
    </div>
  );
}

/** Signed out, no board is mounted: only the sync status shows (where the app shows its sign-in gate). */
function SignedOut() {
  return <p data-testid="status">{useSync().status}</p>;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 12, 0));
});
afterEach(() => vi.useRealTimers());

/** Every localStorage value that still mentions this account's private data. */
function leftovers(): string[] {
  return Object.keys(localStorage).filter((k) => k !== STORAGE_KEY && (localStorage.getItem(k) ?? '').includes(SECRET));
}

describe('VB-02: sign-out removes the account’s data from this device', () => {
  it('no copy of the signed-out account’s board is left in localStorage', async () => {
    const board = createStarterState('2026-11-12', 720);
    board.tasks = [...board.tasks, { id: 'private', title: SECRET, categoryId: 'cat-admin', done: false }];
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: { state: board, updatedAt: '2026-11-12T00:00:00.000Z' } } });
    render(
      <ToastProvider>
        <SyncProvider backend={fake.backend} signedOut={<SignedOut />}>
          <Probe />
        </SyncProvider>
      </ToastProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('synced'));

    // A conflict (another device wrote later) also leaves a backup copy of the board behind.
    act(() => screen.getByText('add').click());
    const fromPhone = { ...board, tasks: [...board.tasks, { id: 'phone', title: 'Added on the phone', categoryId: 'cat-admin', done: false }] };
    act(() => fake.remoteEdit(ME.id, fromPhone, '2099-01-01T00:00:00.000Z'));
    await act(() => new Promise((resolve) => setTimeout(resolve, PUSH_DEBOUNCE_MS + 150)));
    expect(Object.keys(localStorage).some((k) => k.startsWith(CONFLICT_BACKUP_PREFIX))).toBe(true);

    act(() => screen.getByText('sign out').click());
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed-out'));

    expect(leftovers()).toEqual([]);
  });
});

describe('VB-02: sign-out edge cases', () => {
  const OTHER = 'user-someone-else';

  function renderSignedIn(fake: ReturnType<typeof createFakeBackend>) {
    let result: SignOutResult | null = null;
    function Leave() {
      const { state, addTask } = useVespera();
      const sync = useSync();
      return (
        <div>
          <p data-testid="status">{sync.status}</p>
          <button onClick={() => addTask('A quest typed on this device', state.categories[0].id)}>add</button>
          <button onClick={() => void sync.signOut().then((r) => (result = r))}>sign out</button>
          <button onClick={() => void sync.signOut({ force: true }).then((r) => (result = r))}>sign out anyway</button>
        </div>
      );
    }
    render(
      <ToastProvider>
        <SyncProvider backend={fake.backend} signedOut={<SignedOut />}>
          <Leave />
        </SyncProvider>
      </ToastProvider>,
    );
    return () => result;
  }

  const boardRow = () => ({ state: createStarterState('2026-11-12', 720), updatedAt: '2026-11-12T00:00:00.000Z' });

  it('pushes a just-made edit before forgetting the board, so nothing is lost', async () => {
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: boardRow() } });
    const result = renderSignedIn(fake);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('synced'));
    act(() => screen.getByText('add').click()); // still inside the push debounce
    act(() => screen.getByText('sign out').click());
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed-out'));
    expect(result()).toBe('signed-out');
    expect(JSON.stringify(fake.table.get(ME.id)!.state)).toContain('A quest typed on this device');
    expect(localStorage.getItem(userStorageKey(ME.id))).toBeNull();
  });

  it('keeps the account (and asks) when edits can’t reach the cloud, until told to forget anyway', async () => {
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: boardRow() } });
    const result = renderSignedIn(fake);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('synced'));
    fake.backend.store.push = async () => {
      throw new TypeError('Failed to fetch');
    };
    act(() => screen.getByText('add').click());
    act(() => screen.getByText('sign out').click());
    await waitFor(() => expect(result()).toBe('unsynced'));
    expect(screen.getByTestId('status').textContent).toBe('offline');
    expect(localStorage.getItem(userStorageKey(ME.id))).toContain('A quest typed on this device');

    act(() => screen.getByText('sign out anyway').click());
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed-out'));
    expect(localStorage.getItem(userStorageKey(ME.id))).toBeNull();
  });

  it('forgets only this account: the signed-out board, other accounts and other settings stay', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(createStarterState('2026-11-12', 720)));
    localStorage.setItem(userStorageKey(OTHER), '{"other":true}');
    localStorage.setItem(conflictBackupKey(OTHER, 1), '{"other":true}');
    localStorage.setItem('vespera_realm', 'sunlit');
    // Left behind for this account: an unreadable save set aside, and a backup from before backups were per account.
    localStorage.setItem(`${userStorageKey(ME.id)}_unreadable_abc123`, SECRET);
    localStorage.setItem(`${CONFLICT_BACKUP_PREFIX}1731400000000`, SECRET);
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: boardRow() } });
    renderSignedIn(fake);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('synced'));
    act(() => screen.getByText('sign out').click());
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed-out'));

    expect(leftovers()).toEqual([]);
    expect(Object.keys(localStorage).filter((k) => k.includes(ME.id))).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem(userStorageKey(OTHER))).not.toBeNull();
    expect(localStorage.getItem(conflictBackupKey(OTHER, 1))).not.toBeNull();
    expect(localStorage.getItem('vespera_realm')).toBe('sunlit');
  });

  it('also forgets the account’s pre-migration snapshots and its paused-sync marker (Wave 3)', async () => {
    localStorage.setItem(`vespera_backup_v2:${ME.id}`, SECRET);
    localStorage.setItem(`vespera_backup_v3:${ME.id}`, SECRET);
    localStorage.setItem(pausedSyncKey(ME.id), '1');
    localStorage.setItem('vespera_backup_v2', 'the signed-out board’s own snapshot');
    localStorage.setItem(`vespera_backup_v2:${OTHER}`, '{"other":true}');
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: boardRow() } });
    renderSignedIn(fake);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('synced'));
    act(() => screen.getByText('sign out').click());
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed-out'));

    expect(Object.keys(localStorage).filter((k) => k.includes(ME.id))).toEqual([]);
    expect(leftovers()).toEqual([]);
    expect(localStorage.getItem('vespera_backup_v2')).not.toBeNull();
    expect(localStorage.getItem(`vespera_backup_v2:${OTHER}`)).not.toBeNull();
  });

  it('files conflict backups under the account they belong to', async () => {
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: boardRow() } });
    renderSignedIn(fake);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('synced'));
    act(() => screen.getByText('add').click());
    const fromPhone = createStarterState('2026-11-12', 720);
    fromPhone.tasks = [...fromPhone.tasks, { id: 'phone', title: 'Added on the phone', categoryId: fromPhone.categories[0].id, done: false }];
    act(() => fake.remoteEdit(ME.id, fromPhone, '2099-01-01T00:00:00.000Z'));
    await act(() => new Promise((resolve) => setTimeout(resolve, PUSH_DEBOUNCE_MS + 150)));
    const backups = Object.keys(localStorage).filter((k) => k.startsWith(CONFLICT_BACKUP_PREFIX));
    expect(backups).toHaveLength(1);
    expect(backups[0].startsWith(`${CONFLICT_BACKUP_PREFIX}${ME.id}_`)).toBe(true);
  });
});
