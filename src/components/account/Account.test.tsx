import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SCHEMA_VERSION } from '../../context/schema';
import { saveState, userStorageKey } from '../../context/storage';
import { useVespera } from '../../context/VesperaContext';
import { SyncProvider } from '../../sync/SyncProvider';
import type { SyncBackend } from '../../sync/types';
import { createFakeBackend, ME } from '../../test/fakeBackend';
import { createSeedState } from '../../test/ownerWeek';
import { ToastProvider } from '../ui/Toast';
import { AccountSection } from './AccountSection';
import { FirstSyncPrompt } from './FirstSyncPrompt';
import { page } from './shared';
import { SyncBadge } from './SyncBadge';


function renderAccount(backend: SyncBackend | null) {
  const ui = (
    <>
      <SyncBadge />
      <FirstSyncPrompt />
      <AccountSection />
    </>
  );
  return render(
    <ToastProvider>
      <SyncProvider backend={backend} signedOut={ui}>
        {ui}
      </SyncProvider>
    </ToastProvider>,
  );
}
const sheet = () => within(screen.getByRole('dialog', { name: 'Sign in to sync' }));

describe('account UI', () => {
  it('stays out of the way when sync is not configured', () => {
    renderAccount(null);
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Account')).not.toBeInTheDocument();
  });

  it('signs in with Google', async () => {
    const user = userEvent.setup();
    renderAccount(createFakeBackend().backend);
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    await user.click(sheet().getByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByRole('button', { name: 'Account · Synced' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Sign in to sync' })).not.toBeInTheDocument();
  });

  it('signs in with email and password, showing errors', async () => {
    const user = userEvent.setup();
    renderAccount(createFakeBackend().backend);
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    await user.type(sheet().getByLabelText('Email'), 'friend@example.com');
    await user.type(sheet().getByLabelText('Password'), 'wrong password');
    await user.click(sheet().getByRole('button', { name: 'Sign in' }));
    expect(await sheet().findByRole('alert')).toHaveTextContent('That email and password don’t match');
    await user.clear(sheet().getByLabelText('Password'));
    await user.type(sheet().getByLabelText('Password'), 'correct horse');
    await user.click(sheet().getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('button', { name: 'Account · Synced' })).toBeInTheDocument();
  });

  it('creates an account, asking for a long enough password', async () => {
    const user = userEvent.setup();
    renderAccount(createFakeBackend().backend);
    await user.click(await screen.findByRole('button', { name: 'Sign in' }));
    await user.click(sheet().getByRole('button', { name: 'New here? Create an account' }));
    await user.type(sheet().getByLabelText('Email'), 'friend@example.com');
    await user.type(sheet().getByLabelText('Password'), 'short');
    await user.click(sheet().getByRole('button', { name: 'Create account' }));
    expect(sheet().getByRole('alert')).toHaveTextContent(/at least 8 characters/);
    await user.type(sheet().getByLabelText('Password'), ' and longer');
    await user.click(sheet().getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('button', { name: 'Account · Synced' })).toBeInTheDocument();
  });

  it('asks before bringing this device’s board into a new account', async () => {
    const user = userEvent.setup();
    saveState(createSeedState(), localStorage);
    const fake = createFakeBackend({ user: ME });
    renderAccount(fake.backend);
    const ask = await screen.findByRole('alertdialog', { name: 'Bring this board into your account?' });
    expect(ask).toHaveTextContent('me@example.com');
    await user.click(within(ask).getByRole('button', { name: /Bring this board/ }));
    await waitFor(() => expect(fake.table.has(ME.id)).toBe(true));
    expect(JSON.stringify(fake.table.get(ME.id)!.state)).toContain('Eat quick bridge fuel');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows who is signed in and signs out', async () => {
    const user = userEvent.setup();
    renderAccount(createFakeBackend({ user: ME }).backend);
    expect(await screen.findByText('me@example.com')).toBeInTheDocument();
    expect(screen.getByText('Signed in with Google')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in to sync' })).toBeInTheDocument();
  });

  it('warns before signing out with changes the cloud hasn’t got, and only forgets on a clear yes (VB-02)', async () => {
    const user = userEvent.setup();
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: { state: createSeedState(), updatedAt: '2026-11-12T00:00:00.000Z' } } });
    function Edit() {
      const { state, addTask } = useVespera();
      return <button onClick={() => addTask('Typed while the Wi-Fi was down', state.categories[0].id)}>edit</button>;
    }
    render(
      <ToastProvider>
        <SyncProvider backend={fake.backend}>
          <Edit />
          <AccountSection />
        </SyncProvider>
      </ToastProvider>,
    );
    await screen.findByText(/Synced ·/);
    fake.backend.store.push = async () => {
      throw new TypeError('Failed to fetch');
    };
    await user.click(screen.getByRole('button', { name: 'edit' }));

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    const ask = await screen.findByRole('alertdialog', { name: 'Sign out and forget this device?' });
    await user.click(within(ask).getByRole('button', { name: /Stay signed in/ }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('me@example.com')).toBeInTheDocument();
    expect(localStorage.getItem(userStorageKey(ME.id))).toContain('Typed while the Wi-Fi was down');

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: /Sign out anyway/ }));
    await waitFor(() => expect(screen.queryByText('me@example.com')).not.toBeInTheDocument());
    expect(localStorage.getItem(userStorageKey(ME.id))).toBeNull();
  });

  describe('when a newer Vespera wrote the board', () => {
    const futureRow = () => ({ state: { ...createSeedState(), schemaVersion: SCHEMA_VERSION + 1 }, updatedAt: '2026-11-12T00:00:00.000Z' });
    afterEach(() => vi.restoreAllMocks());

    it('the badge and the account section say so, and explain the pause', async () => {
      const user = userEvent.setup();
      renderAccount(createFakeBackend({ user: ME, rows: { [ME.id]: futureRow() } }).backend);
      const badge = await screen.findByRole('button', { name: 'Account · Update needed' });
      const section = await screen.findByText('Update needed');
      expect(section.parentElement).toHaveTextContent(/paused syncing so it can’t overwrite/);
      expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
      expect(screen.queryByText(/Syncing…/)).not.toBeInTheDocument();

      await user.click(badge);
      const sheet = within(screen.getByRole('dialog', { name: 'Your account' }));
      expect(sheet.getByText('Update needed')).toBeInTheDocument();
      expect(sheet.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    });

    it('Reload reloads the page', async () => {
      const reload = vi.spyOn(page, 'reload').mockImplementation(() => {});
      renderAccount(createFakeBackend({ user: ME, rows: { [ME.id]: futureRow() } }).backend);
      await userEvent.setup().click(await screen.findByRole('button', { name: 'Reload' }));
      expect(reload).toHaveBeenCalledTimes(1);
    });
  });

  it('shows why the cloud refused the board (VB-04)', async () => {
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: { state: createSeedState(), updatedAt: '2026-11-12T00:00:00.000Z' } } });
    fake.backend.store.push = async () => {
      throw { code: '23514', message: 'violates check constraint "user_states_state_size"' };
    };
    function Edit() {
      const { state, addTask } = useVespera();
      return <button onClick={() => addTask('One more', state.categories[0].id)}>edit</button>;
    }
    render(
      <ToastProvider>
        <SyncProvider backend={fake.backend}>
          <Edit />
          <AccountSection />
        </SyncProvider>
      </ToastProvider>,
    );
    await screen.findByText(/Synced ·/);
    await userEvent.setup().click(screen.getByRole('button', { name: 'edit' }));
    expect(await screen.findByText(/over the 2 MB sync limit/, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText(/will sync when you’re back/)).not.toBeInTheDocument();
  });
});
