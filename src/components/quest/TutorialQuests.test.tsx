import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStarterState } from '../../context/VesperaContext';
import { renderWithVespera } from '../../test/renderWithVespera';
import { QuestBoard } from '../QuestBoard';

const TODAY = '2026-11-12';
const starter = () => createStarterState(TODAY, 10 * 60 + 30);
const startHere = () => within(screen.getByRole('region', { name: 'Start Here' }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 10, 12, 10, 30));
});
afterEach(() => vi.useRealTimers());

describe('the clickable tutorial quests', () => {
  it('opens Gentle Start from the Gentle Start quest', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />, starter());
    await user.click(startHere().getByRole('button', { name: /^Feeling stuck\? Tap “Gentle Start”.*focus timer$/ }));
    expect(screen.getByRole('dialog', { name: 'Gentle Start' })).toBeInTheDocument();
  });

  it('opens the due-date quest’s own editor', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />, starter());
    await user.click(startHere().getByRole('button', { name: 'Give this quest a due date: ⋯ → Edit' }));
    const editor = within(screen.getByRole('dialog', { name: 'Edit quest' }));
    expect(editor.getByDisplayValue('Give this quest a due date: ⋯ → Edit')).toBeInTheDocument();
  });

  it('opens the Chronicle from the Chronicle quest', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />, starter());
    await user.click(startHere().getByRole('button', { name: /^Check History tomorrow to see your completed tasks$/ }));
    expect(screen.getByRole('dialog', { name: 'History' })).toBeInTheDocument();
  });

  it('opens its category’s ⋯ menu from the category quest', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />, starter());
    await user.click(startHere().getByRole('button', { name: /^Tap the ⋯ menu on any category.*change its color$/ }));
    expect(screen.getByRole('button', { name: 'Start Here options' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'Start Here options' })).toBeInTheDocument();
  });

  it('briefly lights up the drag quest’s handle', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />, starter());
    await user.click(startHere().getByRole('button', { name: 'Drag this quest into another category' }));
    const row = screen.getByRole('checkbox', { name: 'Drag this quest into another category' }).closest('li')!;
    const grip = row.querySelector('[data-grip]')!;
    expect(grip).toHaveAttribute('data-spotlight');
    act(() => vi.advanceTimersByTime(2100));
    expect(grip).not.toHaveAttribute('data-spotlight');
  });

  it('leaves the wax seal checking the quest off, and ordinary quests unchanged', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />, starter());
    const seal = startHere().getByRole('checkbox', { name: /Tap “Gentle Start” for a quick/ });
    await user.click(seal);
    expect(seal).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('dialog', { name: 'Gentle Start' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Check off a task to light today’s candle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Drink a glass of water' })).not.toBeInTheDocument();
    expect(screen.getByText('Drink a glass of water')).toBeInTheDocument();
  });
});
