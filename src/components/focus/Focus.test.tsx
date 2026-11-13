import { act, fireEvent, screen, within } from '@testing-library/react';
import { STORAGE_KEY, type FocusSession, type VesperaState } from '../../context/VesperaContext';
import * as sound from '../../lib/sound';
import { renderWithVespera } from '../../test/renderWithVespera';
import { TimelinePanel } from '../TimelinePanel';
import { FocusChamber } from './FocusChamber';
import { createSeedState } from '../../test/ownerWeek';

const MIN = 60_000;
const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!);
const card = (name: string) => screen.getByRole('article', { name });
const FOCUS_BLOCK = 'Job 1 Research Push & Essay Draft';

function withSession(over: Partial<FocusSession> = {}): VesperaState {
  return {
    ...createSeedState(),
    focusSession: {
      title: FOCUS_BLOCK, categoryId: 'cat-job1', date: '2026-11-11', occurrenceKey: 'blk-wed-focus',
      rhythm: 'pomodoro25', sound: 'off', startedAt: Date.now(), totalMinutes: 90, pausedAt: null, pausedMs: 0, ...over,
    },
  };
}
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
const chamber = () => within(screen.getByRole('dialog', { name: 'Focus Timer' }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 11, 19, 0));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Focus button and chooser', () => {
  it('appears on focus and flexible blocks, not anchors', () => {
    renderWithVespera(<TimelinePanel />);
    expect(within(card(FOCUS_BLOCK)).getByRole('button', { name: 'Focus' })).toBeInTheDocument();
    expect(within(card('Workout & Shower Reset')).getByRole('button', { name: 'Focus' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Thu 12' }));
    expect(within(card('Job 2: Bookshop Shift (Use for Essay Polish & Exam)')).queryByRole('button', { name: 'Focus' })).not.toBeInTheDocument();
  });

  it('offers rhythms sized to the block, remembers defaults, and lights the candle', () => {
    renderWithVespera(<><TimelinePanel /><FocusChamber /></>);
    fireEvent.click(within(card(FOCUS_BLOCK)).getByRole('button', { name: 'Focus' }));
    const sheet = within(screen.getByRole('dialog', { name: 'Focus session' }));
    const rhythm = within(sheet.getByRole('radiogroup', { name: 'Rhythm' }));
    expect(rhythm.getByRole('radio', { name: 'Whole block · 1h 30m' })).toHaveAttribute('aria-checked', 'false');
    expect(rhythm.getByRole('radio', { name: '25 min focus + 5 min rest' })).toHaveAttribute('aria-checked', 'true');
    expect(within(sheet.getByRole('radiogroup', { name: 'Sound' })).getByRole('radio', { name: 'Rain' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(rhythm.getByRole('radio', { name: 'Whole block · 1h 30m' }));
    fireEvent.click(within(sheet.getByRole('radiogroup', { name: 'Sound' })).getByRole('radio', { name: 'Fire' }));
    fireEvent.click(sheet.getByRole('button', { name: 'Start the timer' }));
    expect(screen.queryByRole('dialog', { name: 'Focus session' })).not.toBeInTheDocument();
    expect(saved().focusSession).toMatchObject({ rhythm: 'whole', sound: 'fire', totalMinutes: 90, occurrenceKey: 'blk-wed-focus' });
    expect(screen.getByRole('dialog', { name: 'Focus Timer' })).toBeInTheDocument();
  });
});

describe('Focus Chamber', () => {
  it('shows the block, the phase, the countdown and the linked quests', () => {
    renderWithVespera(<FocusChamber />, withSession());
    expect(chamber().getByText(FOCUS_BLOCK)).toBeInTheDocument();
    expect(chamber().getByText('Focus')).toBeInTheDocument();
    expect(chamber().getByRole('timer')).toHaveTextContent('25:00');
    expect(within(chamber().getByRole('list', { name: 'Quests for this block' })).getByText(/Complete tutor's new research task/)).toBeInTheDocument();
  });

  it('counts down into a rest phase', () => {
    renderWithVespera(<FocusChamber />, withSession());
    tick(25 * MIN);
    expect(chamber().getByText('Rest')).toBeInTheDocument();
    expect(chamber().getByRole('timer')).toHaveTextContent('5:00');
  });

  it('pauses and resumes', () => {
    renderWithVespera(<FocusChamber />, withSession());
    tick(1 * MIN);
    fireEvent.click(chamber().getByRole('button', { name: 'Pause' }));
    tick(5 * MIN);
    expect(chamber().getByText('Paused')).toBeInTheDocument();
    expect(chamber().getByRole('timer')).toHaveTextContent('24:00');
    fireEvent.click(chamber().getByRole('button', { name: 'Resume' }));
    tick(1 * MIN);
    expect(chamber().getByRole('timer')).toHaveTextContent('23:00');
  });

  it('ending early logs the focus minutes spent', () => {
    renderWithVespera(<FocusChamber />, withSession());
    tick(10 * MIN);
    fireEvent.click(chamber().getByRole('button', { name: 'End session' }));
    expect(screen.queryByRole('dialog', { name: 'Focus Timer' })).not.toBeInTheDocument();
    expect(saved().activity['2026-11-11'].focusMinutes).toBe(10);
    expect(screen.getByRole('status')).toHaveTextContent('10 minutes of focus logged');
  });

  it('finishes on its own when the candle burns down', () => {
    const chime = vi.spyOn(sound, 'playChime');
    renderWithVespera(<FocusChamber />, withSession({ rhythm: 'whole', totalMinutes: 2 }));
    tick(2 * MIN + 1000);
    expect(screen.queryByRole('dialog', { name: 'Focus Timer' })).not.toBeInTheDocument();
    expect(saved().activity['2026-11-11'].focusMinutes).toBe(2);
    expect(screen.getByRole('status')).toHaveTextContent(/session complete/i);
    expect(chime).toHaveBeenCalled();
  });

  it('plays the ambient sound while focusing, and stops it on pause', () => {
    const stop = vi.fn();
    const start = vi.spyOn(sound, 'startAmbient').mockReturnValue(stop);
    renderWithVespera(<FocusChamber />, withSession({ sound: 'rain' }));
    expect(start).toHaveBeenCalledWith('rain', 0.5);
    fireEvent.click(chamber().getByRole('button', { name: 'Pause' }));
    expect(stop).toHaveBeenCalled();
  });

  it('picks up where it left off after a reload', () => {
    renderWithVespera(<FocusChamber />, withSession({ startedAt: Date.now() - 10 * MIN }));
    expect(chamber().getByRole('timer')).toHaveTextContent('15:00');
  });
});
