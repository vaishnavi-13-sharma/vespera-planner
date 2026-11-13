import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { exportState, hasTutorial, STORAGE_KEY, useVespera, VesperaProvider } from './VesperaContext';
import { createSeedState } from '../test/ownerWeek';

function Probe() {
  const { state, today, nowMinutes, toggleTask, importBackup, resetToStarter, dismissNotice } = useVespera();
  const sweep = state.tasks.find((t) => t.id === 'task-sweep');
  return (
    <div>
      <p data-testid="clock">{`${today} ${nowMinutes}`}</p>
      <p data-testid="chronicle">{state.chronicle.length}</p>
      <p data-testid="tutorial">{hasTutorial(state) ? 'yes' : 'no'}</p>
      <p data-testid="notice">{state.notice ?? 'none'}</p>
      <button onClick={() => toggleTask('task-sweep')}>{sweep ? (sweep.done ? 'done' : 'open') : 'gone'}</button>
      <button onClick={() => importBackup('garbage')}>bad import</button>
      <button onClick={() => importBackup(exportState({ ...createSeedState(), tasks: [] }))}>good import</button>
      <button onClick={resetToStarter}>reset</button>
      <button onClick={dismissNotice}>dismiss</button>
    </div>
  );
}

describe('VesperaProvider', () => {
  afterEach(() => vi.useRealTimers());

  it('seeds and persists under vespera_state_v2', async () => {
    const user = userEvent.setup();
    render(<VesperaProvider initialState={createSeedState()}><Probe /></VesperaProvider>);
    await user.click(screen.getByRole('button', { name: 'open' }));
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.version).toBe(2);
    expect(saved.tasks.find((t: { id: string }) => t.id === 'task-sweep').done).toBe(true);
  });

  it('exposes today and the minute of the day, ticking every minute', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 12, 9, 0));
    render(<VesperaProvider initialState={createSeedState()}><Probe /></VesperaProvider>);
    expect(screen.getByTestId('clock')).toHaveTextContent('2026-11-12 540');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId('clock')).toHaveTextContent('2026-11-12 541');
  });

  it('catches the clock up as soon as the app comes back into view', () => {
    vi.useFakeTimers({ toFake: ['Date'] }); // the minute timer is asleep, as in a backgrounded phone app
    vi.setSystemTime(new Date(2026, 10, 12, 9, 0));
    render(<VesperaProvider initialState={createSeedState()}><Probe /></VesperaProvider>);
    vi.setSystemTime(new Date(2026, 10, 12, 11, 30));
    expect(screen.getByTestId('clock')).toHaveTextContent('2026-11-12 540');
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(screen.getByTestId('clock')).toHaveTextContent('2026-11-12 690');
  });

  it('rolls finished quests into the Chronicle when the date changes', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 12, 23, 59));
    render(<VesperaProvider initialState={createSeedState()}><Probe /></VesperaProvider>);
    act(() => {
      screen.getByRole('button', { name: 'open' }).click();
    });
    expect(screen.getByTestId('chronicle')).toHaveTextContent('0');
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId('clock')).toHaveTextContent('2026-11-13 0');
    expect(screen.getByTestId('chronicle')).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: 'gone' })).toBeInTheDocument();
  });

  it('imports a valid backup and flags an invalid one', async () => {
    const user = userEvent.setup();
    render(<VesperaProvider initialState={createSeedState()}><Probe /></VesperaProvider>);
    await user.click(screen.getByRole('button', { name: 'bad import' }));
    expect(screen.getByTestId('notice')).toHaveTextContent('import-failed');
    await user.click(screen.getByRole('button', { name: 'dismiss' }));
    expect(screen.getByTestId('notice')).toHaveTextContent('none');
    await user.click(screen.getByRole('button', { name: 'good import' }));
    expect(screen.getByRole('button', { name: 'gone' })).toBeInTheDocument();
    expect(screen.getByTestId('tutorial')).toHaveTextContent('no');
    await user.click(screen.getByRole('button', { name: 'reset' }));
    expect(screen.getByTestId('tutorial')).toHaveTextContent('yes');
  });

  it('throws a helpful error outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/VesperaProvider/);
    vi.restoreAllMocks();
  });
});
