import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { STORAGE_KEY } from '../../context/VesperaContext';
import { renderWithVespera } from '../../test/renderWithVespera';
import { VelvetPinboard } from '../VelvetPinboard';
import { createSeedState } from '../../test/ownerWeek';

const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!);
const sheet = () => within(screen.getByRole('dialog', { name: 'Daily 5' }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 11, 12, 0)); // Wed Nov 11
});
afterEach(() => vi.useRealTimers());

async function grade(user: ReturnType<typeof userEvent.setup>, answer: 'Knew it' | 'Not yet') {
  await user.click(sheet().getByRole('button', { name: 'Show definition' }));
  await user.click(sheet().getByRole('button', { name: new RegExp(answer) }));
}

describe('Daily 5', () => {
  it('shows how many cards are due and opens the first one', async () => {
    const user = userEvent.setup();
    renderWithVespera(<VelvetPinboard />);
    await user.click(screen.getByRole('button', { name: 'Study · 4 due' }));
    expect(sheet().getByText('Card 1 of 4')).toBeInTheDocument();
    expect(sheet().getByRole('heading', { name: 'Laconic' })).toBeInTheDocument();
    expect(sheet().queryByText(/very few words/)).not.toBeInTheDocument();
  });

  it('flips a card, grades it, and moves on', async () => {
    const user = userEvent.setup();
    renderWithVespera(<VelvetPinboard />);
    await user.click(screen.getByRole('button', { name: /Study/ }));
    await user.click(sheet().getByRole('button', { name: 'Show definition' }));
    expect(sheet().getByText(/very few words/)).toBeInTheDocument();
    await user.click(sheet().getByRole('button', { name: /Knew it/ }));
    expect(sheet().getByText('Card 2 of 4')).toBeInTheDocument();
    expect(sheet().getByRole('heading', { name: 'Obdurate' })).toBeInTheDocument();
    expect(saved().notes.find((n: { id: string }) => n.id === 'vocab-laconic').review).toEqual({ step: 1, due: '2026-11-14' });
  });

  it('finishes a round with a summary, then has nothing more today', async () => {
    const user = userEvent.setup();
    renderWithVespera(<VelvetPinboard />);
    await user.click(screen.getByRole('button', { name: /Study/ }));
    await grade(user, 'Knew it');
    await grade(user, 'Knew it');
    await grade(user, 'Not yet');
    await grade(user, 'Knew it');
    expect(sheet().getByText('Round complete')).toBeInTheDocument();
    expect(sheet().getByText('3 knew it · 1 not yet')).toBeInTheDocument();
    expect(saved().activity['2026-11-11'].cards).toBe(4);
    await user.click(sheet().getByRole('button', { name: 'One more round' }));
    expect(sheet().getByText(/all caught up/i)).toBeInTheDocument();
  });

  it('is calm when there is nothing to study', async () => {
    const user = userEvent.setup();
    const state = { ...createSeedState(), notes: [] };
    renderWithVespera(<VelvetPinboard />, state);
    await user.click(screen.getByRole('button', { name: 'Study · 0 due' }));
    expect(sheet().getByText(/all caught up/i)).toBeInTheDocument();
  });
});

describe('review hints', () => {
  it('marks new cards and shows when reviewed ones come back', async () => {
    const user = userEvent.setup();
    renderWithVespera(<VelvetPinboard />);
    expect(within(screen.getByRole('article', { name: 'Vocab card: Laconic' })).getByText('New')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Study/ }));
    await grade(user, 'Knew it');
    await user.click(sheet().getByRole('button', { name: 'Close' }));
    expect(within(screen.getByRole('article', { name: 'Vocab card: Laconic' })).getByText('Next review: Sat')).toBeInTheDocument();
  });

  it('says when a card is due today', () => {
    const state = createSeedState();
    state.notes = state.notes.map((n) => (n.id === 'vocab-obdurate' ? { ...n, review: { step: 1, due: '2026-11-10' } } : n));
    renderWithVespera(<VelvetPinboard />, state);
    expect(within(screen.getByRole('article', { name: 'Vocab card: Obdurate' })).getByText('Due today')).toBeInTheDocument();
  });
});
