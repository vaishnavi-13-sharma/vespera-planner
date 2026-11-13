// VB-01 (recovery half): when a board still manages to crash the app, the error boundary offers
// "Restore a backup" and "Start fresh", and always keeps a copy of the broken board.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { createStarterState, exportState, parseState, STORAGE_KEY, userStorageKey, type VesperaState } from '../context/VesperaContext';
import { BROKEN_BOARD_PREFIX } from './boardRecovery';
import { AppErrorBoundary } from './ErrorBoundary';

const TODAY = '2026-11-12';
const AT = new Date(2026, 10, 12, 12, 0);
const CRASHY = '💥 crashy';

// Stand-in for any render crash a board can cause (the validator should stop known ones first).
vi.mock('./TutorialRibbon', () => ({ TutorialRibbon: () => <CrashOnCrashyBoard /> }));

function CrashOnCrashyBoard() {
  if (localStorage.getItem(STORAGE_KEY)?.includes(CRASHY)) throw new Error('crashy board');
  return null;
}

function board(edit: (s: VesperaState) => void = () => {}): string {
  const s = createStarterState(TODAY, 12 * 60);
  edit(s);
  return exportState(s);
}
const crashyBoard = () => board((s) => (s.categories[0].name = CRASHY));

/** A child that throws while any board it can see is crashy; otherwise shows the board's first quest. */
function Board() {
  const raw = localStorage.getItem(STORAGE_KEY) ?? '';
  if (raw.includes(CRASHY)) throw new Error('crashy board');
  const state = raw ? parseState(JSON.parse(raw)) : null;
  return <p>Board opened: {state?.tasks[0]?.title ?? 'empty'}</p>;
}

function renderBoundary() {
  return render(
    <AppErrorBoundary>
      <Board />
    </AppErrorBoundary>,
  );
}

const brokenCopies = () => Object.keys(localStorage).filter((k) => k.startsWith(BROKEN_BOARD_PREFIX));

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(AT);
  vi.spyOn(console, 'error').mockImplementation(() => {}); // React reports the caught crash loudly
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('shows a calm recovery screen with both ways out instead of a blank page', () => {
  localStorage.setItem(STORAGE_KEY, crashyBoard());
  renderBoundary();

  expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
  expect(screen.getByLabelText('Restore a backup')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Start fresh (keeps a copy of the broken board)' })).toBeInTheDocument();
});

describe('Start fresh', () => {
  it('keeps the broken board as a copy, then opens a new starter board', async () => {
    const user = userEvent.setup();
    const broken = crashyBoard();
    localStorage.setItem(STORAGE_KEY, broken);
    renderBoundary();

    await user.click(screen.getByRole('button', { name: /start fresh/i }));

    expect(localStorage.getItem(`${BROKEN_BOARD_PREFIX}${AT.getTime()}`)).toBe(broken);
    const fresh = parseState(JSON.parse(localStorage.getItem(STORAGE_KEY)!));
    expect(fresh?.categories.some((c) => c.name === CRASHY)).toBe(false);
    expect(screen.getByText(/Board opened/)).toBeInTheDocument();
  });

  it('also sets aside and resets account boards cached on this device, leaving other backups alone', async () => {
    const user = userEvent.setup();
    const account = board((s) => (s.categories[0].name = 'Account board'));
    localStorage.setItem(STORAGE_KEY, crashyBoard());
    localStorage.setItem(userStorageKey('u1'), account);
    localStorage.setItem('vespera_state_v2_conflict_1', 'older conflict copy');
    renderBoundary();

    await user.click(screen.getByRole('button', { name: /start fresh/i }));

    expect(localStorage.getItem(`${BROKEN_BOARD_PREFIX}${AT.getTime()}:u1`)).toBe(account);
    expect(localStorage.getItem(userStorageKey('u1'))).not.toBe(account);
    expect(parseState(JSON.parse(localStorage.getItem(userStorageKey('u1'))!))).not.toBeNull();
    expect(localStorage.getItem('vespera_state_v2_conflict_1')).toBe('older conflict copy');
  });

  it('changes nothing when there is no room to keep the copy', async () => {
    const user = userEvent.setup();
    const broken = crashyBoard();
    localStorage.setItem(STORAGE_KEY, broken);
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key.startsWith(BROKEN_BOARD_PREFIX)) throw new DOMException('full', 'QuotaExceededError');
      setItem.call(this, key, value);
    });
    renderBoundary();

    await user.click(screen.getByRole('button', { name: /start fresh/i }));

    expect(localStorage.getItem(STORAGE_KEY)).toBe(broken);
    expect(screen.getByRole('alert')).toHaveTextContent(/no room/i);
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
  });

  it('brings the whole app back, not just the page under the boundary', async () => {
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, crashyBoard());
    render(<App />);
    expect(screen.queryByRole('region', { name: 'Quest Board' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /start fresh/i }));

    expect(screen.getByRole('region', { name: 'Quest Board' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Daily Timeline' })).toBeInTheDocument();
  });
});

describe('Restore a backup', () => {
  const file = (text: string, name = 'vespera-backup.json') => new File([text], name, { type: 'application/json' });

  it('loads the chosen backup and keeps a copy of the broken board', async () => {
    const user = userEvent.setup();
    const broken = crashyBoard();
    localStorage.setItem(STORAGE_KEY, broken);
    renderBoundary();

    await user.upload(screen.getByLabelText('Restore a backup'), file(board((s) => (s.tasks[0].title = 'Water the ferns'))));

    expect(await screen.findByText('Board opened: Water the ferns')).toBeInTheDocument();
    expect(localStorage.getItem(`${BROKEN_BOARD_PREFIX}${AT.getTime()}`)).toBe(broken);
  });

  it('turns away a file that is not a Vespera backup, gently, and changes nothing', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const broken = crashyBoard();
    localStorage.setItem(STORAGE_KEY, broken);
    renderBoundary();

    await user.upload(screen.getByLabelText('Restore a backup'), file('{"hello":"world"}', 'notes.txt'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/isn.t a Vespera backup/i);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(broken);
    expect(brokenCopies()).toEqual([]);
  });

  it('works when nothing was saved yet (the crash came from elsewhere)', async () => {
    const user = userEvent.setup();
    // The crash is not about storage at all: render once with a crashy board, then clear storage.
    localStorage.setItem(STORAGE_KEY, crashyBoard());
    renderBoundary();
    localStorage.clear();

    await user.upload(screen.getByLabelText('Restore a backup'), file(board((s) => (s.tasks[0].title = 'Fresh start'))));

    expect(await screen.findByText('Board opened: Fresh start')).toBeInTheDocument();
    expect(brokenCopies()).toEqual([]);
  });
});
