// Bringing this device's earlier board in, after the fact: someone who chose "Start fresh" (or signed in
// somewhere the board wasn't brought in) can still move the board this device saved before sign-in.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountSection } from '../components/account/AccountSection';
import { FirstSyncPrompt } from '../components/account/FirstSyncPrompt';
import { ToastProvider } from '../components/ui/Toast';
import { createBaseState, createStarterState } from '../context/seed';
import { saveState, STORAGE_KEY, userStorageKey } from '../context/storage';
import { useVespera } from '../context/VesperaContext';
import type { VesperaState } from '../context/types';
import { createFakeBackend, ME } from '../test/fakeBackend';
import { CONFLICT_BACKUP_PREFIX, GUEST_MOVED_KEY, SyncProvider, useSync } from './SyncProvider';

const TODAY = '2026-11-12';
const BRING = /Bring this device’s earlier board into your account/;

function withQuest(board: VesperaState, id: string, title: string): VesperaState {
  return { ...board, tasks: [...board.tasks, { id, title, categoryId: board.categories[0].id, done: false }] };
}
const guestBoard = () => withQuest(createBaseState(TODAY), 'guest-1', 'Polish the brass candlesticks');
const accountBoard = () => withQuest(createStarterState(TODAY, 600), 'acct-1', 'Write to the duchess');
const accountRow = () => ({ state: accountBoard(), updatedAt: '2026-11-12T00:00:00.000Z' });

function Probe() {
  const { state } = useVespera();
  const { status } = useSync();
  return (
    <>
      <p data-testid="status">{status}</p>
      <p data-testid="quests">{state.tasks.map((t) => t.title).join('|')}</p>
    </>
  );
}

function SignedOut() {
  return <p data-testid="status">{useSync().status}</p>;
}

function renderSignedIn(fake: ReturnType<typeof createFakeBackend>) {
  return render(
    <ToastProvider>
      <SyncProvider backend={fake.backend} signedOut={<SignedOut />}>
        <Probe />
        <FirstSyncPrompt />
        <AccountSection />
      </SyncProvider>
    </ToastProvider>,
  );
}

const synced = () => waitFor(() => expect(screen.getByTestId('status').textContent).toBe('synced'));
const backups = () => Object.keys(localStorage).filter((k) => k.startsWith(`${CONFLICT_BACKUP_PREFIX}${ME.id}_`));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 10, 0));
});
afterEach(() => vi.useRealTimers());

describe('bringing this device’s earlier board in', () => {
  it('is not offered without a guest board on this device', async () => {
    renderSignedIn(createFakeBackend({ user: ME, rows: { [ME.id]: accountRow() } }));
    await synced();
    expect(screen.queryByRole('button', { name: BRING })).not.toBeInTheDocument();
  });

  it('is not offered when the guest board is only an untouched starter guide', async () => {
    saveState(createStarterState(TODAY, 600), localStorage);
    renderSignedIn(createFakeBackend({ user: ME, rows: { [ME.id]: accountRow() } }));
    await synced();
    expect(screen.queryByRole('button', { name: BRING })).not.toBeInTheDocument();
  });

  it('is not offered once the guest board has been moved into an account', async () => {
    saveState(guestBoard(), localStorage);
    localStorage.setItem(GUEST_MOVED_KEY, 'user-someone-else');
    renderSignedIn(createFakeBackend({ user: ME, rows: { [ME.id]: accountRow() } }));
    await synced();
    expect(screen.queryByRole('button', { name: BRING })).not.toBeInTheDocument();
  });

  it('replaces the account’s board after a clear yes, keeping the old one as a backup', async () => {
    const user = userEvent.setup();
    saveState(guestBoard(), localStorage);
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: accountRow() } });
    renderSignedIn(fake);
    await synced();
    expect(screen.getByTestId('quests')).toHaveTextContent('Write to the duchess');

    // Cancel changes nothing.
    await user.click(screen.getByRole('button', { name: BRING }));
    const ask = screen.getByRole('alertdialog', { name: /earlier board/ });
    expect(ask).toHaveTextContent(
      'Replace your account’s board with the one this device saved before you signed in? Your account’s current board is kept as a backup on this device.',
    );
    await user.click(within(ask).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('quests')).toHaveTextContent('Write to the duchess');
    expect(backups()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    await user.click(screen.getByRole('button', { name: BRING }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /Bring it in/ }));

    await waitFor(() => expect(localStorage.getItem(GUEST_MOVED_KEY)).toBe(ME.id));
    expect(screen.getByTestId('quests')).toHaveTextContent('Polish the brass candlesticks');
    expect(screen.getByTestId('quests')).not.toHaveTextContent('Write to the duchess');
    // Pushed: the cloud row is the earlier board now.
    expect(JSON.stringify(fake.table.get(ME.id)!.state)).toContain('Polish the brass candlesticks');
    expect(JSON.stringify(fake.table.get(ME.id)!.state)).not.toContain('Write to the duchess');
    // The account's board is kept as a backup, filed under this account.
    expect(backups()).toHaveLength(1);
    expect(localStorage.getItem(backups()[0])).toContain('Write to the duchess');
    // Moved, not copied: the guest key is gone, and so is the offer.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.queryByRole('button', { name: BRING })).not.toBeInTheDocument();
    expect(await screen.findByText('Your earlier board is now in your account')).toBeInTheDocument();
  });

  it('is offered after "Start fresh", and brings the board in later', async () => {
    const user = userEvent.setup();
    saveState(guestBoard(), localStorage);
    const fake = createFakeBackend({ user: ME });
    renderSignedIn(fake);
    await user.click(within(await screen.findByRole('alertdialog', { name: 'Bring this board into your account?' })).getByRole('button', { name: /Start fresh/ }));
    await synced();
    expect(screen.getByTestId('quests')).not.toHaveTextContent('Polish the brass candlesticks');

    await user.click(await screen.findByRole('button', { name: BRING }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /Bring it in/ }));
    await waitFor(() => expect(localStorage.getItem(GUEST_MOVED_KEY)).toBe(ME.id));
    expect(JSON.stringify(fake.table.get(ME.id)!.state)).toContain('Polish the brass candlesticks');
  });

  it('keeps the guest board (and the offer) when the cloud can’t be reached', async () => {
    const user = userEvent.setup();
    saveState(guestBoard(), localStorage);
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: accountRow() } });
    renderSignedIn(fake);
    await synced();
    fake.backend.store.push = async () => {
      throw new TypeError('Failed to fetch');
    };
    await user.click(screen.getByRole('button', { name: BRING }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /Bring it in/ }));
    expect(await screen.findByText(/will reach your account once Vespera can sync/)).toBeInTheDocument();
    expect(localStorage.getItem(GUEST_MOVED_KEY)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toContain('Polish the brass candlesticks');
    expect(backups()).toHaveLength(1);
  });

  it('then lets sign-out remove every pre-sign-in copy, with the account’s backups', async () => {
    const user = userEvent.setup();
    saveState(guestBoard(), localStorage);
    localStorage.setItem('vespera_backup_v2', 'the guest board’s own snapshot');
    localStorage.setItem('vespera_realm', 'sunlit');
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: accountRow() } });
    renderSignedIn(fake);
    await synced();
    await user.click(screen.getByRole('button', { name: BRING }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /Bring it in/ }));
    await waitFor(() => expect(localStorage.getItem(GUEST_MOVED_KEY)).toBe(ME.id));
    await synced();

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed-out'));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('vespera_backup_v2')).toBeNull();
    expect(localStorage.getItem(GUEST_MOVED_KEY)).toBeNull();
    expect(localStorage.getItem(userStorageKey(ME.id))).toBeNull();
    expect(Object.keys(localStorage).filter((k) => k.includes(ME.id))).toEqual([]);
    expect(localStorage.getItem('vespera_realm')).toBe('sunlit');
  });
});
