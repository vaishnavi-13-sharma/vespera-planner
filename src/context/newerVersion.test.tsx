// A board saved by a newer Vespera opens read-only here: a banner says so, and nothing this
// (older) code does ever writes over the newer board.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoticeBanner } from '../components/NoticeBanner';
import { SparkleProvider } from '../components/ui/Sparkles';
import { ToastProvider } from '../components/ui/Toast';
import { createSeedState } from '../test/ownerWeek';
import { live } from './storageHarness';
import { persistable, STORAGE_KEY, toStored, useVespera, VesperaProvider } from './VesperaContext';

const MESSAGE = 'A newer version of Vespera is available. This device is running an older one, so your board is read-only to keep newer changes safe.';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 9, 0));
});
afterEach(() => vi.useRealTimers());

const futureSave = () => JSON.stringify({ ...(toStored(persistable(createSeedState())) as object), schemaVersion: 99, somethingNew: [1, 2, 3] });

function Probe() {
  live.current = useVespera();
  return null;
}

function mount() {
  return render(
    <VesperaProvider>
      <ToastProvider>
        <SparkleProvider>
          <NoticeBanner />
          <Probe />
        </SparkleProvider>
      </ToastProvider>
    </VesperaProvider>,
  );
}

it('shows the newer-version banner with a Reload button and no dismiss', () => {
  localStorage.setItem(STORAGE_KEY, futureSave());
  mount();
  expect(screen.getByRole('alert')).toHaveTextContent(MESSAGE);
  expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Dismiss notice' })).not.toBeInTheDocument();
});

it('Reload reloads the page', async () => {
  localStorage.setItem(STORAGE_KEY, futureSave());
  const reload = vi.fn();
  const original = window.location;
  Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } });
  try {
    mount();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledOnce();
  } finally {
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  }
});

it('shows the board but leaves the stored text byte-for-byte unchanged after edits', () => {
  const raw = futureSave();
  localStorage.setItem(STORAGE_KEY, raw);
  mount();
  expect(live.current!.state.tasks.length).toBeGreaterThan(0);

  act(() => live.current!.addTask('Typed on the older device', 'cat-reset'));
  act(() => live.current!.updateSettings({ volume: 0.1 }));
  expect(live.current!.state.tasks.some((t) => t.title === 'Typed on the older device')).toBe(true);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  expect(localStorage.length).toBe(1);
});

it('stays read-only for the session: dismissing, importing or starting over never clears the notice', () => {
  const raw = futureSave();
  localStorage.setItem(STORAGE_KEY, raw);
  mount();
  act(() => live.current!.dismissNotice());
  act(() => live.current!.resetToStarter());
  act(() => void live.current!.importBackup(JSON.stringify(toStored(persistable(createSeedState())))));
  expect(live.current!.state.notice).toBe('newer-version');
  expect(screen.getByRole('alert')).toHaveTextContent(MESSAGE);
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});

it('turns read-only when another tab saves a newer board, and never writes over it', () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toStored(persistable(createSeedState()))));
  mount();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();

  const raw = futureSave();
  const oldValue = localStorage.getItem(STORAGE_KEY);
  localStorage.setItem(STORAGE_KEY, raw);
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, oldValue, newValue: raw, storageArea: localStorage }));
  });
  expect(screen.getByRole('alert')).toHaveTextContent(MESSAGE);
  act(() => live.current!.addTask('After the other tab', 'cat-reset'));
  expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
});
