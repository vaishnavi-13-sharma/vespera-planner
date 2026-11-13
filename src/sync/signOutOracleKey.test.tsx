// VB-03 · The person's paid Anthropic key outlives sign-out, so the next person on the device spends it.
// The key lives at localStorage['vespera_oracle_key'], unrelated to the account. After "Sign out" the
// Quick Scribe still reports "Using your key" and askOracle still sends requests billed to the key's owner.
import { act, render, screen, waitFor } from '@testing-library/react';
import { hasOracleKey, saveOracleKey } from '../ai/oracleKey';
import { ToastProvider } from '../components/ui/Toast';
import { SyncProvider, useSync } from './SyncProvider';
import { createFakeBackend, ME } from '../test/fakeBackend';
import { createStarterState } from '../context/seed';

function Probe() {
  const sync = useSync();
  return (
    <div>
      <p data-testid="status">{sync.status}</p>
      <button onClick={() => void sync.signOut()}>sign out</button>
    </div>
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 12, 0));
});
afterEach(() => vi.useRealTimers());

describe('VB-03: signing out does not leave a paid key behind for the next person', () => {
  it('sign-out removes (or at least disables) the stored Anthropic key', async () => {
    const fake = createFakeBackend({ user: ME, rows: { [ME.id]: { state: createStarterState('2026-11-12', 720), updatedAt: '2026-11-12T00:00:00.000Z' } } });
    render(
      <ToastProvider>
        <SyncProvider backend={fake.backend} signedOut={<Probe />}>
          <Probe />
        </SyncProvider>
      </ToastProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('synced'));
    expect(saveOracleKey('sk-ant-test-not-a-real-key')).toBe(true);

    act(() => screen.getByText('sign out').click());
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('signed-out'));

    expect(hasOracleKey()).toBe(false);
  });
});
