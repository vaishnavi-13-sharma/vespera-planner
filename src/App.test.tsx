import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { createStarterState } from './context/seed';
import { saveState, STORAGE_KEY, userStorageKey } from './context/storage';
import { conflictBackupKey, GUEST_MOVED_KEY } from './sync/SyncProvider';
import type { SyncBackend } from './sync/types';
import { createFakeBackend, ME } from './test/fakeBackend';

const SECRET_QUEST = 'Secret test quest';
const SECRET_NOTE = 'A private thought about Thursday';

/** A signed-out board with something of its own in it (a quest and a note nobody else should see). */
function seedGuestBoard() {
  const board = createStarterState('2026-11-12', 720);
  board.tasks = [...board.tasks, { id: 'secret', title: SECRET_QUEST, categoryId: board.categories[0].id, done: false }];
  board.notes = [...board.notes, { id: 'secret-note', tagId: board.noteTags[0].id, text: SECRET_NOTE }];
  saveState(board, localStorage);
}

/** Nothing of the board is on the page: no panels, no header tools, no board text. */
function expectNoBoard() {
  for (const name of ['Daily Timeline', 'Quest Board', 'Pinboard']) expect(screen.queryByRole('region', { name })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Open Settings' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Quick Scribe' })).not.toBeInTheDocument();
  expect(document.body.textContent).not.toContain(SECRET_QUEST);
  expect(document.body.textContent).not.toContain(SECRET_NOTE);
}

async function findGate() {
  const gate = await screen.findByRole('main', { name: 'Sign in to Vespera' });
  expect(within(gate).getByRole('heading', { level: 1, name: 'Vespera' })).toBeInTheDocument();
  return gate;
}

async function signOutFromBadge(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Account · Synced' }));
  await user.click(within(screen.getByRole('dialog', { name: 'Your account' })).getByRole('button', { name: 'Sign out' }));
}

describe('the sign-in gate', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 12, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('is all a signed-out visitor sees: no panels, no Vanity, no Quick Scribe, nothing from the board', async () => {
    seedGuestBoard();
    render(<App backend={createFakeBackend().backend} />);
    const gate = await findGate();
    expect(within(gate).getByText('a storybook planner')).toBeInTheDocument();
    expect(within(gate).getByText(/Your board stays private to you/)).toBeInTheDocument();
    expect(within(gate).getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
    expect(within(gate).getByLabelText('Email')).toBeInTheDocument();
    expect(within(gate).getByLabelText('Password')).toBeInTheDocument();
    expect(within(gate).getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expectNoBoard();
  });

  it('shows only a quiet candle while it checks the session, and mounts no board', () => {
    seedGuestBoard();
    const fake = createFakeBackend();
    const backend: SyncBackend = { ...fake.backend, auth: { ...fake.backend.auth, getUser: () => new Promise(() => {}) } };
    localStorage.setItem('vespera_state_v1', JSON.stringify({ blocks: [], tasks: [], notes: [] }));
    localStorage.removeItem(STORAGE_KEY);
    render(<App backend={backend} />);
    expect(screen.getByText('Loading…')).toHaveAttribute('role', 'status');
    expectNoBoard();
    expect(screen.queryByRole('main', { name: 'Sign in to Vespera' })).not.toBeInTheDocument();
    // No VesperaProvider was created: it would have saved a board under the signed-out key.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('opens the board once someone signs in', async () => {
    const user = userEvent.setup();
    render(<App backend={createFakeBackend().backend} />);
    const gate = await findGate();
    await user.type(within(gate).getByLabelText('Email'), 'friend@example.com');
    await user.type(within(gate).getByLabelText('Password'), 'correct horse');
    await user.click(within(gate).getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('region', { name: 'Quest Board' })).toBeInTheDocument();
    expect(screen.queryByRole('main', { name: 'Sign in to Vespera' })).not.toBeInTheDocument();
  });

  it('shows the friendly error, never the raw one, when a password is wrong', async () => {
    const user = userEvent.setup();
    render(<App backend={createFakeBackend().backend} />);
    const gate = await findGate();
    await user.type(within(gate).getByLabelText('Email'), 'friend@example.com');
    await user.type(within(gate).getByLabelText('Password'), 'wrong password');
    await user.click(within(gate).getByRole('button', { name: 'Sign in' }));
    expect(await within(gate).findByRole('alert')).toHaveTextContent('That email and password don’t match');
  });

  it('asks for at least 8 characters when creating an account', async () => {
    const user = userEvent.setup();
    render(<App backend={createFakeBackend().backend} />);
    const gate = await findGate();
    await user.click(within(gate).getByRole('button', { name: 'New here? Create an account' }));
    await user.type(within(gate).getByLabelText('Email'), 'friend@example.com');
    await user.type(within(gate).getByLabelText('Password'), 'short');
    await user.click(within(gate).getByRole('button', { name: 'Create account' }));
    expect(within(gate).getByRole('alert')).toHaveTextContent(/at least 8 characters/);
  });

  it('says gently when Google sign-in is switched off', async () => {
    const user = userEvent.setup();
    const fake = createFakeBackend();
    fake.backend.auth.signInWithGoogle = async () => 'provider_disabled';
    render(<App backend={fake.backend} />);
    const gate = await findGate();
    await user.click(within(gate).getByRole('button', { name: 'Continue with Google' }));
    expect(await within(gate).findByRole('alert')).toHaveTextContent('Google sign-in isn’t switched on yet. Use email for now.');
  });

  it('starts a new account with no cloud board and no signed-out board from the Welcome guide, never from older saves', async () => {
    const user = userEvent.setup();
    // Only a v1 save and an old snapshot on this device: neither is a board to bring.
    localStorage.setItem('vespera_state_v1', JSON.stringify({ blocks: [], tasks: [{ id: 'v1', title: SECRET_QUEST, category: 'reset', done: false }], notes: [] }));
    localStorage.setItem('vespera_backup_v2', JSON.stringify({ tasks: [{ title: SECRET_QUEST }] }));
    const fake = createFakeBackend();
    render(<App backend={fake.backend} />);
    await user.click(within(await findGate()).getByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByRole('region', { name: 'Start Here' })).toBeInTheDocument();
    await waitFor(() => expect(fake.table.has(ME.id)).toBe(true));
    expect(screen.queryByRole('alertdialog', { name: 'Bring this board into your account?' })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(SECRET_QUEST);
    expect(JSON.stringify(fake.table.get(ME.id)!.state)).not.toContain(SECRET_QUEST);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('after the board was brought into the account, sign-out clears every signed-out copy and returns to the gate', async () => {
    const user = userEvent.setup();
    seedGuestBoard();
    const fake = createFakeBackend({ user: ME });
    render(<App backend={fake.backend} />);
    const ask = await screen.findByRole('alertdialog', { name: 'Bring this board into your account?' });
    await user.click(within(ask).getByRole('button', { name: /Bring this board/ }));
    await waitFor(() => expect(JSON.stringify(fake.table.get(ME.id)?.state ?? '')).toContain(SECRET_QUEST));
    expect(localStorage.getItem(GUEST_MOVED_KEY)).toBe(ME.id);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    const preSignIn = [
      'vespera_state_v1',
      STORAGE_KEY,
      `${STORAGE_KEY}_backup_before_links`,
      `${STORAGE_KEY}_conflict_1731400000000`,
      `${STORAGE_KEY}_unreadable_abc123`,
      'vespera_backup_v1',
      'vespera_backup_v2',
      'vespera_backup_v2_x1y2',
    ];
    for (const key of preSignIn) localStorage.setItem(key, SECRET_QUEST);
    const OTHER = 'user-someone-else';
    const others = [userStorageKey(OTHER), conflictBackupKey(OTHER, 1), `vespera_backup_v2:${OTHER}`, `${userStorageKey(OTHER)}_unreadable_abc`];
    for (const key of others) localStorage.setItem(key, '{"other":true}');
    localStorage.setItem('vespera_realm', 'sunlit');

    await signOutFromBadge(user);
    await findGate();
    expectNoBoard();
    for (const key of preSignIn) expect(localStorage.getItem(key), key).toBeNull();
    expect(Object.keys(localStorage).filter((k) => k.includes(ME.id))).toEqual([]);
    for (const key of others) expect(localStorage.getItem(key), key).not.toBeNull();
    expect(localStorage.getItem('vespera_realm')).toBe('sunlit');
    expect(Object.values(localStorage).some((v) => String(v).includes(SECRET_QUEST))).toBe(false);
  });

  it('without a bring (Start fresh), sign-out keeps the signed-out board: the only copy is never erased', async () => {
    const user = userEvent.setup();
    seedGuestBoard();
    localStorage.setItem('vespera_state_v1', JSON.stringify({ blocks: [], tasks: [], notes: [] }));
    localStorage.setItem('vespera_backup_v2', 'an older snapshot');
    const fake = createFakeBackend({ user: ME });
    render(<App backend={fake.backend} />);
    const ask = await screen.findByRole('alertdialog', { name: 'Bring this board into your account?' });
    await user.click(within(ask).getByRole('button', { name: /Start fresh/ }));
    expect(await screen.findByRole('region', { name: 'Start Here' })).toBeInTheDocument();
    expect(localStorage.getItem(GUEST_MOVED_KEY)).toBeNull();

    await signOutFromBadge(user);
    await findGate();
    expectNoBoard();
    expect(localStorage.getItem(STORAGE_KEY)).toContain(SECRET_QUEST);
    expect(localStorage.getItem('vespera_state_v1')).not.toBeNull();
    expect(localStorage.getItem('vespera_backup_v2')).toBe('an older snapshot');
  });

  it('without sign-in set up, a production build shows only the not-set-up gate', () => {
    seedGuestBoard();
    render(<App backend={null} localOnlyAllowed={false} />);
    const gate = screen.getByRole('main', { name: 'Sign in to Vespera' });
    expect(within(gate).getByRole('heading', { level: 1, name: 'Vespera' })).toBeInTheDocument();
    expect(within(gate).getByText('Sign-in isn’t set up for this copy of Vespera yet.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expectNoBoard();
  });
});

describe('App shell', () => {
  it('lays out the three panels, with nothing tucked beneath the Pinboard', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'Vespera' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Daily Timeline' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Quest Board' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Pinboard' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
});

describe('Quick Scribe', () => {
  it('sits in the header beside the Vanity Drawer button, the only way in besides ⌘K', () => {
    render(<App />);
    const pill = screen.getByRole('button', { name: 'Quick Scribe' });
    const gear = screen.getByRole('button', { name: 'Open Settings' });
    expect(pill.parentElement).toBe(gear.parentElement);
    expect(screen.getAllByRole('button', { name: /scribe|capture/i })).toEqual([pill]);
  });

  it('opens the centered storybook modal from the pill, saves and closes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Quick Scribe' }));
    const modal = screen.getByRole('dialog', { name: 'Quick Scribe' });
    await user.type(within(modal).getByLabelText('Capture'), 'quest: water the roses{Enter}');
    expect(screen.queryByRole('dialog', { name: 'Quick Scribe' })).not.toBeInTheDocument();
    expect(screen.getByText('Captured 1 thing')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Quest Board' })).getByText('Water the roses')).toBeInTheDocument();
  });
});

describe('App shell (v2)', () => {
  it('opens and closes the Vanity Drawer from the header', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('shows a gentle notice when the v1 upgrade fails, and dismisses it', async () => {
    const user = userEvent.setup();
    localStorage.setItem('vespera_state_v1', JSON.stringify({ version: 1 }));
    render(<App />);
    expect(screen.getByRole('alert')).toHaveTextContent(/started fresh/);
    await user.click(screen.getByRole('button', { name: 'Dismiss notice' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('starter tutorial', () => {
  it('greets a brand-new board with the Start Here ribbon, and clears it on request', async () => {
    const user = userEvent.setup();
    render(<App />);
    const ribbon = screen.getByRole('region', { name: 'Starter tutorial' });
    expect(screen.getByRole('region', { name: 'Start Here' })).toBeInTheDocument();
    await user.click(within(ribbon).getByRole('button', { name: /Clear starter tutorial/ }));
    await user.click(within(screen.getByRole('alertdialog', { name: 'Clear the starter tutorial?' })).getByRole('button', { name: /Clear it/ }));
    expect(screen.queryByRole('region', { name: 'Starter tutorial' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Start Here' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Work' })).toBeInTheDocument();
  });
});
