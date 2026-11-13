import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createBaseState, useVespera, type OneOffBlock, type VesperaState } from '../../context/VesperaContext';
import { renderWithVespera } from '../../test/renderWithVespera';
import { DeskShelf } from './DeskShelf';
import { FocusKitten } from './FocusKitten';
import { TrinketSection } from './TrinketSection';

const TODAY = '2026-11-12';

function board(patch: Partial<VesperaState['settings']> = {}, extra: Partial<VesperaState> = {}): VesperaState {
  const s = createBaseState(TODAY);
  return { ...s, ...extra, settings: { ...s.settings, ...patch } };
}

const study: OneOffBlock = { id: 'b-study', date: TODAY, title: 'Study', kind: 'focus', start: 10 * 60, end: 11 * 60 };

function at(h: number, m = 0) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, h, m));
}

afterEach(() => vi.useRealTimers());

describe('DeskShelf: castle kitten', () => {
  it('naps when nothing is happening', () => {
    at(14);
    renderWithVespera(<DeskShelf />, board({ trinket: 'cat' }, { blocks: [study] }));
    expect(screen.getByRole('button', { name: 'Castle kitten, napping' })).toBeInTheDocument();
  });

  it('wakes while a block is happening', () => {
    at(10, 30);
    renderWithVespera(<DeskShelf />, board({ trinket: 'cat' }, { blocks: [study] }));
    expect(screen.getByRole('button', { name: 'Castle kitten, awake' })).toBeInTheDocument();
  });

  it('wears spectacles during a focus session', () => {
    at(10, 30);
    const focusSession: VesperaState['focusSession'] = {
      title: 'Study', date: TODAY, occurrenceKey: 'b-study', rhythm: 'whole', sound: 'off',
      startedAt: new Date(2026, 10, 12, 10, 0).getTime(), totalMinutes: 60, pausedAt: null, pausedMs: 0,
    };
    renderWithVespera(<DeskShelf />, board({ trinket: 'cat' }, { blocks: [study], focusSession }));
    expect(screen.getByRole('button', { name: 'Castle kitten, wearing glasses' })).toBeInTheDocument();
  });

  it('reacts to a tap', async () => {
    const user = userEvent.setup();
    renderWithVespera(<DeskShelf />, board({ trinket: 'cat', sounds: false }));
    const cat = screen.getByRole('button', { name: /Castle kitten/ });
    await user.click(cat);
    expect(cat).toHaveAttribute('data-reacting', 'true');
  });
});

describe('DeskShelf: vial and jar', () => {
  it('fills the vial with today’s quest progress', () => {
    at(12);
    const tasks: VesperaState['tasks'] = [
      { id: 't1', title: 'A', categoryId: 'cat-work', done: true, completedOn: TODAY },
      { id: 't2', title: 'B', categoryId: 'cat-work', done: false },
      { id: 't3', title: 'C', categoryId: 'cat-study', done: false },
    ];
    renderWithVespera(<DeskShelf />, board({ trinket: 'vial' }, { tasks }));
    expect(screen.getByRole('button', { name: 'Rosewater vial, 1 of 3 quests' })).toBeInTheDocument();
  });

  it('keeps one firefly per small win this week, up to twelve', () => {
    at(12);
    const activity: VesperaState['activity'] = {
      '2026-11-08': { quests: 9, spells: 0, focusMinutes: 0, cards: 0 },
      '2026-11-09': { quests: 2, spells: 1, focusMinutes: 25, cards: 0 },
      '2026-11-12': { quests: 0, spells: 0, focusMinutes: 0, cards: 1 },
    };
    const { container, unmount } = renderWithVespera(<DeskShelf />, board({ trinket: 'jar' }, { activity }));
    expect(screen.getByRole('button', { name: 'Firefly jar, 5 small wins this week' })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-firefly]')).toHaveLength(5);
    unmount();
    const busy = renderWithVespera(<DeskShelf />, board({ trinket: 'jar' }, { activity: { '2026-11-10': { quests: 20, spells: 0, focusMinutes: 0, cards: 0 } } }));
    expect(screen.getByRole('button', { name: 'Firefly jar, 20 small wins this week' })).toBeInTheDocument();
    expect(busy.container.querySelectorAll('[data-firefly]')).toHaveLength(12);
  });

  it('bubbles when a quest is sealed and glows once every quest is done', async () => {
    at(12); // "today" must be TODAY, or a quest finished TODAY counts as yesterday's
    const user = userEvent.setup();
    function Seal() {
      const { toggleTask } = useVespera();
      return <button type="button" onClick={() => toggleTask('t2')}>Seal B</button>;
    }
    const tasks: VesperaState['tasks'] = [
      { id: 't1', title: 'A', categoryId: 'cat-work', done: true, completedOn: TODAY },
      { id: 't2', title: 'B', categoryId: 'cat-work', done: false },
    ];
    const { container } = renderWithVespera(<><DeskShelf /><Seal /></>, board({ trinket: 'vial' }, { tasks }));
    expect(container.querySelector('.tk-bubbles')).toBeNull();
    expect(container.querySelector('.tk-vial')).not.toHaveAttribute('data-full');
    await user.click(screen.getByRole('button', { name: 'Seal B' }));
    expect(screen.getByRole('button', { name: 'Rosewater vial, 2 of 2 quests' })).toBeInTheDocument();
    expect(container.querySelector('.tk-bubbles')).not.toBeNull();
    expect(container.querySelector('.tk-vial')).toHaveAttribute('data-full', 'true');
  });

  it('hides the shelf when no trinket is chosen', () => {
    const { container } = renderWithVespera(<DeskShelf />, board({ trinket: 'none' }));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('FocusKitten', () => {
  it('shows the spectacled cat in the Focus Chamber only for the cat trinket', () => {
    const { unmount } = renderWithVespera(<FocusKitten />, board({ trinket: 'cat' }));
    expect(screen.getByRole('img', { name: 'Your castle kitten, wearing glasses' })).toBeInTheDocument();
    unmount();
    const { container } = renderWithVespera(<FocusKitten />, board({ trinket: 'jar' }));
    expect(container).toBeEmptyDOMElement();
  });
});

describe('TrinketSection', () => {
  function Probe() {
    const { state } = useVespera();
    return <output data-testid="probe">{state.settings.trinket}</output>;
  }

  it('chooses the desk trinket', async () => {
    const user = userEvent.setup();
    renderWithVespera(<><TrinketSection /><Probe /></>, board());
    const group = screen.getByRole('radiogroup', { name: 'Desk trinket' });
    expect(within(group).getAllByRole('radio').map((r) => r.textContent?.trim())).toEqual(['Castle kitten', 'Rosewater vial', 'Firefly jar', 'None']);
    expect(within(group).getByRole('radio', { name: /Castle kitten/ })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(group).getByRole('radio', { name: /Firefly jar/ }));
    expect(screen.getByTestId('probe')).toHaveTextContent('jar');
  });
});
