// VB-04 · When the server refuses a board (e.g. the 2 MB `user_states_state_size` check), sync claims
// "Offline" forever and edits silently never reach the cloud. Every push error is caught as `offline`
// (SyncProvider push → catch → setStatus('offline')); the 'error' status exists but is never set, and the
// client has no size cap of its own, so a big board (or a large imported backup) stops syncing for good
// while the badge promises "Changes … will sync when you're back".
import { act, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../components/ui/Toast';
import { createStarterState } from '../context/seed';
import { useVespera } from '../context/VesperaContext';
import { PUSH_DEBOUNCE_MS, SyncProvider, useSync } from './SyncProvider';
import { createFakeBackend, ME } from '../test/fakeBackend';

function Probe() {
  const { state, addTask } = useVespera();
  const sync = useSync();
  return (
    <div>
      <p data-testid="status">{sync.status}</p>
      <button onClick={() => addTask('One more quest', state.categories[0].id)}>add</button>
    </div>
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 12, 0));
});
afterEach(() => vi.useRealTimers());

describe('VB-04: a board the server refuses is reported as a sync problem, not as offline', () => {
  it('a check-constraint rejection sets status "error"', async () => {
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: { state: createStarterState('2026-11-12', 720), updatedAt: '2026-11-12T00:00:00.000Z' } } });
    // What PostgREST returns when the board is over the migration's 2 MB limit. The network is fine.
    fake.backend.store.push = async () => {
      throw { code: '23514', message: 'new row for relation "user_states" violates check constraint "user_states_state_size"' };
    };
    render(
      <ToastProvider>
        <SyncProvider backend={fake.backend}>
          <Probe />
        </SyncProvider>
      </ToastProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('synced'));

    act(() => screen.getByText('add').click());
    await act(() => new Promise((resolve) => setTimeout(resolve, PUSH_DEBOUNCE_MS + 150)));

    expect(navigator.onLine).toBe(true);
    expect(screen.getByTestId('status').textContent).toBe('error');
  });
});

describe('VB-04: refusals, size and the network', () => {
  function ProbeWithProblem() {
    const { state, addTask, addNote } = useVespera();
    const sync = useSync();
    return (
      <div>
        <p data-testid="status">{sync.status}</p>
        <p data-testid="problem">{sync.problem ?? ''}</p>
        <button onClick={() => addTask('One more quest', state.categories[0].id)}>add</button>
        <button onClick={() => addNote(state.noteTags[0].id, 'n'.repeat(2_100_000))}>huge</button>
      </div>
    );
  }
  const renderIt = (fake: ReturnType<typeof createFakeBackend>) =>
    render(
      <ToastProvider>
        <SyncProvider backend={fake.backend}>
          <ProbeWithProblem />
        </SyncProvider>
      </ToastProvider>,
    );
  const wait = () => act(() => new Promise((resolve) => setTimeout(resolve, PUSH_DEBOUNCE_MS + 150)));
  const row = () => ({ state: createStarterState('2026-11-12', 720), updatedAt: '2026-11-12T00:00:00.000Z' });

  it('never sends a board over the cloud’s 2 MB limit, and says why in plain words', async () => {
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: row() } });
    renderIt(fake);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('synced'));
    const pushesBefore = fake.pushes.length;
    act(() => screen.getByText('huge').click());
    await wait();
    expect(fake.pushes.length).toBe(pushesBefore);
    expect(screen.getByTestId('status').textContent).toBe('error');
    expect(screen.getByTestId('problem').textContent).toMatch(/over the 2 MB sync limit/);
  });

  it('a dropped connection is still “offline”, with no alarming message', async () => {
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: row() } });
    fake.backend.store.push = async () => {
      throw { message: 'TypeError: Failed to fetch', code: '' }; // what supabase-js reports for a network failure
    };
    renderIt(fake);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('synced'));
    act(() => screen.getByText('add').click());
    await wait();
    expect(screen.getByTestId('status').textContent).toBe('offline');
    expect(screen.getByTestId('problem').textContent).toBe('');
  });

  it('recovers once the server accepts again', async () => {
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: row() } });
    const realPush = fake.backend.store.push;
    fake.backend.store.push = async () => {
      throw { code: '42501', message: 'permission denied' };
    };
    renderIt(fake);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('synced'));
    act(() => screen.getByText('add').click());
    await wait();
    expect(screen.getByTestId('status').textContent).toBe('error');
    expect(screen.getByTestId('problem').textContent).toMatch(/didn’t accept your latest changes/);
    fake.backend.store.push = realPush;
    act(() => screen.getByText('add').click());
    await wait();
    expect(screen.getByTestId('status').textContent).toBe('synced');
    expect(screen.getByTestId('problem').textContent).toBe('');
  });
});
