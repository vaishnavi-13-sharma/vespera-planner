import { act, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../components/ui/Toast';
import { createStarterState } from '../context/seed';
import { saveState, STORAGE_KEY, userStorageKey } from '../context/storage';
import { useVespera } from '../context/VesperaContext';
import { createFakeBackend, ME } from '../test/fakeBackend';
import { createSeedState } from '../test/ownerWeek';
import { ADOPTED_PUSH_DELAY_MS, CONFLICT_BACKUP_PREFIX, GUEST_MOVED_KEY, PUSH_DEBOUNCE_MS, SyncProvider, useSync } from './SyncProvider';
import type { SyncBackend } from './types';

function Probe() {
  const { state, addTask } = useVespera();
  const sync = useSync();
  return (
    <div>
      <p data-testid="status">{sync.status}</p>
      <p data-testid="pending">{String(sync.pendingFirstSync)}</p>
      <p data-testid="user">{sync.user?.email ?? 'none'}</p>
      <p data-testid="first-category">{state.categories[0]?.name}</p>
      <p data-testid="tasks">{state.tasks.map((t) => t.title).join(' | ')}</p>
      <button onClick={() => addTask('Fresh quest', state.categories[0].id)}>add</button>
      <button onClick={() => void sync.signOut()}>sign out</button>
      <button onClick={() => void sync.signInWithGoogle()}>google</button>
      <button onClick={() => void sync.resolveFirstSync('upload')}>bring it</button>
      <button onClick={() => void sync.resolveFirstSync('fresh')}>start fresh</button>
    </div>
  );
}

/** Signed out, no board is mounted: only this shows (where the app shows its sign-in gate). */
function SignedOutProbe() {
  const sync = useSync();
  return (
    <div>
      <p data-testid="status">{sync.status}</p>
      <p data-testid="user">none</p>
      <button onClick={() => void sync.signInWithGoogle()}>google</button>
    </div>
  );
}

const renderSync = (backend: SyncBackend | null) =>
  render(
    <ToastProvider>
      <SyncProvider backend={backend} signedOut={<SignedOutProbe />} loading={<p>loading</p>}>
        <Probe />
      </SyncProvider>
    </ToastProvider>,
  );
const text = (id: string) => screen.getByTestId(id).textContent;
const owner = () => createSeedState();
/** Wait out the push debounce on real timers. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, PUSH_DEBOUNCE_MS + 150)));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 12, 0));
});
afterEach(() => vi.useRealTimers());

describe('without a backend', () => {
  it('runs local-only on the guest board', () => {
    saveState(owner(), localStorage);
    renderSync(null);
    expect(text('status')).toBe('local-only');
    expect(text('first-category')).toBe('Quick Reset & Self-Care');
    expect(text('tasks')).toContain('Eat quick bridge fuel');
  });
});

describe('signing in', () => {
  it('loads the account’s cloud board and caches it per account', async () => {
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: { state: owner(), updatedAt: '2026-11-12T00:00:00.000Z' } } });
    renderSync(fake.backend);
    await waitFor(() => expect(text('status')).toBe('synced'));
    expect(text('tasks')).toContain('Eat quick bridge fuel');
    expect(localStorage.getItem(userStorageKey(ME.id))).toContain('Eat quick bridge fuel');
  });

  it('starts a brand-new account from the starter guide without asking when this device has nothing of its own', async () => {
    const fake = createFakeBackend();
    renderSync(fake.backend);
    await waitFor(() => expect(text('status')).toBe('signed-out'));
    act(() => screen.getByText('google').click());
    await waitFor(() => expect(text('status')).toBe('synced'));
    expect(text('pending')).toBe('false');
    expect(text('first-category')).toBe('Start Here');
    expect((fake.table.get(ME.id)!.state as { categories: { id: string }[] }).categories[0].id).toBe('tut-cat-start');
  });

  it('asks before bringing this device’s board into a new account, then moves it', async () => {
    saveState(owner(), localStorage);
    const fake = createFakeBackend({ user: ME });
    renderSync(fake.backend);
    await waitFor(() => expect(text('pending')).toBe('true'));
    expect(text('tasks')).toContain('Eat quick bridge fuel'); // still showing this device's board meanwhile
    act(() => screen.getByText('bring it').click());
    await waitFor(() => expect(text('status')).toBe('synced'));
    expect(JSON.stringify(fake.table.get(ME.id)!.state)).toContain('Eat quick bridge fuel');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('while a sign-in’s board is on its way, shows nothing else kept on this device', async () => {
    saveState(owner(), localStorage);
    const fake = createFakeBackend({ user: ME });
    fake.backend.store.fetch = () => new Promise(() => {});
    renderSync(fake.backend);
    expect(await screen.findByText('loading')).toBeInTheDocument();
    expect(screen.queryByTestId('tasks')).not.toBeInTheDocument();
  });

  it('marks the signed-out board as moved only once it is in the account', async () => {
    saveState(owner(), localStorage);
    const fake = createFakeBackend({ user: ME });
    renderSync(fake.backend);
    await waitFor(() => expect(text('pending')).toBe('true'));
    expect(localStorage.getItem(GUEST_MOVED_KEY)).toBeNull();
    act(() => screen.getByText('bring it').click());
    await waitFor(() => expect(text('status')).toBe('synced'));
    expect(localStorage.getItem(GUEST_MOVED_KEY)).toBe(ME.id);
  });

  it('doesn’t mark it moved when the bring couldn’t reach the cloud', async () => {
    saveState(owner(), localStorage);
    const fake = createFakeBackend({ user: ME });
    renderSync(fake.backend);
    await waitFor(() => expect(text('pending')).toBe('true'));
    fake.backend.store.push = async () => {
      throw new TypeError('Failed to fetch');
    };
    act(() => screen.getByText('bring it').click());
    await waitFor(() => expect(text('status')).toBe('offline'));
    expect(localStorage.getItem(GUEST_MOVED_KEY)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Eat quick bridge fuel');
  });

  it('can start the new account fresh instead', async () => {
    saveState(owner(), localStorage);
    const fake = createFakeBackend({ user: ME });
    renderSync(fake.backend);
    await waitFor(() => expect(text('pending')).toBe('true'));
    act(() => screen.getByText('start fresh').click());
    await waitFor(() => expect(text('first-category')).toBe('Start Here'));
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull(); // the device's own board is left alone
  });

  it('treats an untouched starter guide as nothing to bring', async () => {
    saveState(createStarterState('2026-11-12', 720), localStorage);
    const fake = createFakeBackend({ user: ME });
    renderSync(fake.backend);
    await waitFor(() => expect(text('status')).toBe('synced'));
    expect(text('pending')).toBe('false');
  });
});

describe('keeping devices in step', () => {
  async function signedIn() {
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: { state: owner(), updatedAt: '2026-11-12T00:00:00.000Z' } } });
    renderSync(fake.backend);
    await waitFor(() => expect(text('status')).toBe('synced'));
    return fake;
  }

  it('pushes local changes after a short pause', async () => {
    const fake = await signedIn();
    act(() => screen.getByText('add').click());
    expect(text('status')).toBe('syncing');
    await settle();
    expect(text('status')).toBe('synced');
    expect(JSON.stringify(fake.table.get(ME.id)!.state)).toContain('Fresh quest');
  });

  it('applies changes from another device live, without echoing them back', async () => {
    const fake = await signedIn();
    const pushesBefore = fake.pushes.length;
    act(() => fake.remoteEdit(ME.id, { ...owner(), lastRolloverDate: '2026-11-12', tasks: [{ id: 'phone', title: 'Added on my iPhone', categoryId: 'cat-reset', done: false }] }));
    expect(text('tasks')).toBe('Added on my iPhone');
    await settle();
    expect(fake.pushes.length).toBe(pushesBefore);
  });

  it('pulls the latest cloud board when the app comes back into view (no Realtime event)', async () => {
    const fake = await signedIn();
    fake.table.set(ME.id, { state: { ...owner(), lastRolloverDate: '2026-11-12', tasks: [{ id: 'away', title: 'Added while this app slept', categoryId: 'cat-reset', done: false }] }, updatedAt: '2026-11-12T13:00:00.000Z' });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(text('tasks')).not.toBe('Added while this app slept');
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(text('tasks')).toBe('Added while this app slept'));
  });

  it('when both changed, keeps the newer side and backs up the other', async () => {
    const fake = await signedIn();
    act(() => screen.getByText('add').click()); // local edit at 12:00 local time
    // another device wrote later (server time after "now"), before our push lands
    act(() => fake.remoteEdit(ME.id, { ...owner(), tasks: [{ id: 'later', title: 'Written later elsewhere', categoryId: 'cat-reset', done: false }] }, '2099-01-01T00:00:00.000Z'));
    await settle();
    expect(text('tasks')).toBe('Written later elsewhere');
    const backups = Object.keys(localStorage).filter((k) => k.startsWith(CONFLICT_BACKUP_PREFIX));
    expect(backups).toHaveLength(1);
    expect(localStorage.getItem(backups[0])).toContain('Fresh quest');
    expect(screen.getByRole('status')).toHaveTextContent(/newer version/);
  });

  it('signing out mounts no board at all, not even this device’s signed-out one', async () => {
    saveState(owner(), localStorage);
    await signedIn();
    act(() => screen.getByText('sign out').click());
    await waitFor(() => expect(text('status')).toBe('signed-out'));
    expect(text('user')).toBe('none');
    expect(screen.queryByTestId('tasks')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Eat quick bridge fuel');
  });
});

describe('another tab of this device (CG-02)', () => {
  /** What Fixer 2's storage listener does: the other tab saved the board, and this tab adopts it. */
  function OtherTab() {
    const { applyRemoteState } = useVespera();
    return (
      <button
        onClick={() => {
          const key = userStorageKey(ME.id);
          const board = JSON.parse(localStorage.getItem(key)!);
          board.tasks = [...board.tasks, { id: 'tab-b', title: 'Typed in the other tab', categoryId: board.categories[0].id, done: false }];
          const newValue = JSON.stringify(board);
          localStorage.setItem(key, newValue);
          window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
          applyRemoteState(board);
        }}
      >
        other tab saves
      </button>
    );
  }

  async function signedInWithTwoTabs() {
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: { state: owner(), updatedAt: '2026-11-12T00:00:00.000Z' } } });
    render(
      <ToastProvider>
        <SyncProvider backend={fake.backend}>
          <Probe />
          <OtherTab />
        </SyncProvider>
      </ToastProvider>,
    );
    await waitFor(() => expect(text('status')).toBe('synced'));
    return fake;
  }
  const backups = () => Object.keys(localStorage).filter((k) => k.startsWith(CONFLICT_BACKUP_PREFIX));

  it('doesn’t push a board the other tab already saved, and settles on its echo without a backup', async () => {
    const fake = await signedInWithTwoTabs();
    const pushesBefore = fake.pushes.length;
    act(() => screen.getByText('other tab saves').click());
    expect(text('tasks')).toContain('Typed in the other tab');
    await settle();
    expect(fake.pushes.length).toBe(pushesBefore); // that tab pushes it, not this one

    // The other tab's push arrives over Realtime.
    act(() => fake.remoteEdit(ME.id, JSON.parse(localStorage.getItem(userStorageKey(ME.id))!)));
    expect(text('status')).toBe('synced');
    await act(() => new Promise((resolve) => setTimeout(resolve, ADOPTED_PUSH_DELAY_MS + 200)));
    expect(fake.pushes.length).toBe(pushesBefore);
    expect(backups()).toEqual([]);
    expect(screen.queryByText(/newer version/)).not.toBeInTheDocument();
  }, 10_000);

  it('pushes it after all if the other tab never does (closed mid-save)', async () => {
    const fake = await signedInWithTwoTabs();
    act(() => screen.getByText('other tab saves').click());
    await act(() => new Promise((resolve) => setTimeout(resolve, ADOPTED_PUSH_DELAY_MS + 200)));
    expect(JSON.stringify(fake.table.get(ME.id)!.state)).toContain('Typed in the other tab');
    expect(text('status')).toBe('synced');
  }, 10_000);

  it('a conflict with an identical cloud board keeps no backup', async () => {
    const fake = await signedInWithTwoTabs();
    act(() => screen.getByText('add').click());
    // The other tab pushed this very board first; this tab hasn't heard (no Realtime event).
    fake.table.set(ME.id, { state: JSON.parse(localStorage.getItem(userStorageKey(ME.id))!), updatedAt: '2099-01-01T00:00:00.000Z' });
    await settle();
    expect(text('status')).toBe('synced');
    expect(backups()).toEqual([]);
  });
});
