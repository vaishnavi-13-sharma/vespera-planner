import { act, fireEvent, screen, within } from '@testing-library/react';
import { type VesperaState } from '../../context/VesperaContext';
import * as sound from '../../lib/sound';
import { renderWithVespera } from '../../test/renderWithVespera';
import { FocusChamber } from './FocusChamber';
import { formatClock, formatDuration, minutesPhrase } from './format';
import { createSeedState } from '../../test/ownerWeek';

const MIN = 60_000;

describe('focus formatting', () => {
  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(90)).toBe('1h 30m');
  });

  it('formats the countdown clock, rounding up to the second', () => {
    expect(formatClock(25 * MIN)).toBe('25:00');
    expect(formatClock(5 * MIN - 400)).toBe('5:00');
    expect(formatClock(59_001)).toBe('1:00');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(90 * MIN)).toBe('1:30:00');
    expect(formatClock(60 * MIN + 5000)).toBe('1:00:05');
  });

  it('pluralizes minutes', () => {
    expect(minutesPhrase(1)).toBe('1 minute');
    expect(minutesPhrase(10)).toBe('10 minutes');
  });
});

describe('Focus Chamber extras', () => {
  const session = (): VesperaState => ({
    ...createSeedState(),
    focusSession: {
      title: 'Evening reading', date: '2026-11-11', occurrenceKey: 'blk-x',
      rhythm: 'pomodoro25', sound: 'off', startedAt: Date.now(), totalMinutes: 60, pausedAt: null, pausedMs: 0,
    },
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 11, 19, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('ignores Escape: ending a session is deliberate', () => {
    renderWithVespera(<FocusChamber />, session());
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Focus Timer' }), { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Focus Timer' })).toBeInTheDocument();
  });

  it('chimes when focus turns to rest, and omits the quest list without a category', () => {
    const chime = vi.spyOn(sound, 'playChime');
    renderWithVespera(<FocusChamber />, session());
    const chamber = within(screen.getByRole('dialog', { name: 'Focus Timer' }));
    expect(chamber.queryByRole('list', { name: 'Quests for this block' })).not.toBeInTheDocument();
    expect(chamber.getByText(/Cycle 1 of 2/)).toBeInTheDocument();
    expect(chime).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(25 * MIN); });
    expect(chamber.getByText('Rest')).toBeInTheDocument();
    expect(chime).toHaveBeenCalledTimes(1);
  });
});
