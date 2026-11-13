import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { STORAGE_KEY, type VesperaState } from '../../context/VesperaContext';
import * as sound from '../../lib/sound';
import { renderWithVespera } from '../../test/renderWithVespera';
import { CandleRow } from './CandleRow';
import { DelightSettings } from './DelightSettings';
import { SeasonalDecor } from './SeasonalDecor';
import { WeeklySummary } from './WeeklySummary';
import { createSeedState } from '../../test/ownerWeek';

const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!);
const at = (y: number, m: number, d: number) => vi.setSystemTime(new Date(y, m - 1, d, 12, 0));
const day = (quests = 0, focusMinutes = 0, cards = 0) => ({ quests, spells: 0, focusMinutes, cards });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  at(2026, 11, 11);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('CandleRow', () => {
  it('lights a candle for each day with a small win this week', () => {
    const state: VesperaState = { ...createSeedState(), activity: { '2026-11-09': day(1), '2026-11-11': day(0, 0, 3) } };
    renderWithVespera(<CandleRow />, state);
    const row = within(screen.getByRole('group', { name: "This week's candles" }));
    expect(row.getAllByRole('img').map((c) => c.getAttribute('aria-label'))).toEqual([
      'Mon 9: lit', 'Tue 10: unlit', 'Wed 11: lit', 'Thu 12: not yet', 'Fri 13: not yet', 'Sat 14: not yet', 'Sun 15: not yet',
    ]);
    expect(screen.getByText('2 candles lit this week')).toBeInTheDocument();
  });

  it('invites the first candle when none are lit', () => {
    renderWithVespera(<CandleRow />);
    expect(screen.getByText('Check off a task to light today’s candle')).toBeInTheDocument();
  });
});

describe('SeasonalDecor', () => {
  it('dresses Vespera for the season', () => {
    const { container } = renderWithVespera(<SeasonalDecor />);
    expect(document.querySelector('[data-season="winter"]')).toBeInTheDocument();
    expect(container.querySelector('[data-season]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('stays bare when switched off or out of season', () => {
    const off = createSeedState();
    off.settings = { ...off.settings, seasonal: false };
    renderWithVespera(<SeasonalDecor />, off);
    expect(document.querySelector('[data-season]')).not.toBeInTheDocument();
  });

  it('has nothing to show in midsummer', () => {
    at(2027, 7, 4);
    renderWithVespera(<SeasonalDecor />);
    expect(document.querySelector('[data-season]')).not.toBeInTheDocument();
  });
});

describe('WeeklySummary', () => {
  it('recaps last week once, then tucks away', async () => {
    at(2026, 11, 16);
    const user = userEvent.setup();
    const state: VesperaState = { ...createSeedState(), activity: { '2026-11-10': day(3, 50, 5), '2026-11-12': day(2, 150) } };
    renderWithVespera(<WeeklySummary />, state);
    const note = screen.getByRole('note', { name: 'Last week' });
    expect(note).toHaveTextContent('2 candles lit · 5 quests · 3h 20m of focus · 5 cards');
    await user.click(within(note).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('note', { name: 'Last week' })).not.toBeInTheDocument();
    expect(saved().lastSummaryWeek).toBe('2026-11-16');
  });

  it('shows nothing when last week was empty', () => {
    renderWithVespera(<WeeklySummary />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});

describe('DelightSettings', () => {
  it('toggles each delight', async () => {
    const user = userEvent.setup();
    renderWithVespera(<DelightSettings />);
    for (const [name, key] of [['Sparkles', 'sparkles'], ['Sounds', 'sounds'], ['Seasonal touches', 'seasonal'], ['Weekly summary', 'weeklySummary']] as const) {
      const sw = screen.getByRole('switch', { name });
      expect(sw).toHaveAttribute('aria-checked', 'true');
      await user.click(sw);
      expect(sw).toHaveAttribute('aria-checked', 'false');
      expect(saved().settings[key]).toBe(false);
    }
  });

  it('sets the volume and tests the sound', async () => {
    const user = userEvent.setup();
    const chime = vi.spyOn(sound, 'playChime');
    renderWithVespera(<DelightSettings />);
    fireEvent.change(screen.getByRole('slider', { name: 'Volume' }), { target: { value: '80' } });
    expect(saved().settings.volume).toBe(0.8);
    await user.click(screen.getByRole('button', { name: 'Test sound' }));
    expect(chime).toHaveBeenCalledWith(0.8);
  });

  it('disables the volume while sounds are off', async () => {
    const user = userEvent.setup();
    renderWithVespera(<DelightSettings />);
    await user.click(screen.getByRole('switch', { name: 'Sounds' }));
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeDisabled();
  });
});
