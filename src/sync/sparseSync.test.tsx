// Wave 3 · Sync carries the lean stored form. These tests layer a deliberately sparse `toStored` on top of the
// real one (which leaves out defaults once Fixer 2's format lands), so they check the same thing either way:
// pushes send the stored form, sparse rows from other devices apply, and our own sparse echo is recognised.
import { act, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '../components/ui/Toast';
import type { VesperaState } from '../context/types';
import { useVespera } from '../context/VesperaContext';
import { createFakeBackend, ME } from '../test/fakeBackend';
import { createSeedState } from '../test/ownerWeek';
import { storedBoard } from './logic';
import { CONFLICT_BACKUP_PREFIX, PUSH_DEBOUNCE_MS, SyncProvider, useSync } from './SyncProvider';

/** Fields every loader restores when they're missing: a stored board may leave them out. */
const SPARSE_DROPS = ['assistant', 'focusSession', 'lastSummaryWeek', 'focusVeil', 'notice', 'captureLog'] as const;

vi.mock('../context/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/schema')>();
  return {
    ...actual,
    toStored: (state: VesperaState) => {
      const stored = { ...(actual.toStored(state) as Record<string, unknown>) };
      for (const key of ['assistant', 'focusSession', 'lastSummaryWeek', 'focusVeil', 'notice', 'captureLog']) delete stored[key];
      return stored;
    },
  };
});

let latest: VesperaState;
function Probe() {
  const { state, addTask } = useVespera();
  const sync = useSync();
  latest = state;
  return (
    <div>
      <p data-testid="status">{sync.status}</p>
      <p data-testid="tasks">{state.tasks.map((t) => t.title).join(' | ')}</p>
      <button onClick={() => addTask('Fresh quest', state.categories[0].id)}>add</button>
    </div>
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, PUSH_DEBOUNCE_MS + 150)));
const backups = () => Object.keys(localStorage).filter((k) => k.startsWith(CONFLICT_BACKUP_PREFIX));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 12, 0));
});
afterEach(() => vi.useRealTimers());

async function signedIn() {
  const fake = createFakeBackend({ user: ME, rows: { [ME.id]: { state: storedBoard(createSeedState()), updatedAt: '2026-11-12T00:00:00.000Z' } } });
  render(
    <ToastProvider>
      <SyncProvider backend={fake.backend}>
        <Probe />
      </SyncProvider>
    </ToastProvider>,
  );
  await waitFor(() => expect(text('status')).toBe('synced'));
  return fake;
}

describe('sparse boards through sync', () => {
  it('a sparse cloud row opens as the full board', async () => {
    await signedIn();
    expect(text('tasks')).toContain('Eat quick bridge fuel');
    expect(latest.assistant).toEqual({ panelOpen: false });
    expect(latest.captureLog).toEqual([]);
  });

  it('pushes the stored form, and recognises its own sparse echo (no second push, no backup)', async () => {
    const fake = await signedIn();
    act(() => screen.getByText('add').click());
    await settle();
    expect(text('status')).toBe('synced');
    expect(fake.pushes).toHaveLength(1);
    const pushed = fake.pushes[0].state as Record<string, unknown>;
    for (const key of SPARSE_DROPS) expect(pushed).not.toHaveProperty(key);
    expect(pushed).toEqual(JSON.parse(JSON.stringify(storedBoard(latest))));

    await settle(); // the echo (sent before the push call even returned) changed nothing
    expect(fake.pushes).toHaveLength(1);
    expect(backups()).toEqual([]);
  });

  it('applies a sparse board from another device, without echoing it back', async () => {
    const fake = await signedIn();
    const phone = { ...createSeedState(), lastRolloverDate: '2026-11-12', tasks: [{ id: 'phone', title: 'Added on my iPhone', categoryId: 'cat-reset', done: false }] };
    act(() => fake.remoteEdit(ME.id, storedBoard(phone)));
    expect(text('tasks')).toBe('Added on my iPhone');
    await settle();
    expect(fake.pushes).toEqual([]);
    expect(text('status')).toBe('synced');
  });

  it('a sparse cloud row equal to this device’s board settles a conflict without a backup', async () => {
    const fake = await signedIn();
    act(() => screen.getByText('add').click());
    fake.table.set(ME.id, { state: storedBoard(latest), updatedAt: '2099-01-01T00:00:00.000Z' }); // another tab pushed it first
    await settle();
    expect(text('status')).toBe('synced');
    expect(backups()).toEqual([]);
  });
});
