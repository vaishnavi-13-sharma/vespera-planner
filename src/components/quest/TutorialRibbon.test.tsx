import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStarterState, type VesperaState } from '../../context/VesperaContext';
import { renderWithVespera } from '../../test/renderWithVespera';
import { QuestBoard } from '../QuestBoard';
import { MobileShell } from '../shell/MobileShell';
import { TutorialRibbon } from '../TutorialRibbon';

/** A window `px` wide; `reduced` answers prefers-reduced-motion. */
function setWindow(px: number, reduced = false) {
  window.matchMedia = vi.fn().mockImplementation((media: string) => ({
    matches: media.includes('reduced-motion') ? reduced : px >= Number(/min-width:\s*(\d+)px/.exec(media)?.[1] ?? 0),
    media,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

const scrolls = vi.fn();
const board = (patch: Partial<VesperaState> = {}) => ({ ...createStarterState('2026-11-12', 10 * 60 + 30), ...patch });
const app = (state = board()) =>
  renderWithVespera(
    <>
      <TutorialRibbon />
      <MobileShell timeline={<p>TIMELINE</p>} quests={<QuestBoard />} pinboard={<p>PINBOARD</p>} />
    </>,
    state,
  );
const startHere = () => document.getElementById('quest-category-tut-cat-start')!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 10, 12, 10, 30));
  scrolls.mockClear();
  Element.prototype.scrollIntoView = scrolls;
});
afterEach(() => {
  vi.useRealTimers();
  // @ts-expect-error -- jsdom has no scrollIntoView or matchMedia of its own
  delete Element.prototype.scrollIntoView;
  // @ts-expect-error -- see above
  delete window.matchMedia;
});

describe('the Start Here ribbon', () => {
  it('switches a phone to the Quests tab, scrolls to Start Here and rings it in gold for 2 seconds', async () => {
    localStorage.setItem('vespera_mobile_tab', 'pinboard');
    setWindow(390);
    const user = userEvent.setup();
    app();
    expect(screen.getByRole('tab', { name: /Pinboard/ })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: 'Start Here' }));
    expect(screen.getByRole('tab', { name: /Quests/ })).toHaveAttribute('aria-selected', 'true');
    expect(startHere()).toBeVisible();
    expect(scrolls).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(scrolls.mock.contexts[0]).toBe(startHere());
    expect(startHere()).toHaveAttribute('data-spotlight');
    act(() => vi.advanceTimersByTime(2100));
    expect(startHere()).not.toHaveAttribute('data-spotlight');
  });

  it('turns to the Quest Board page on a tablet', async () => {
    localStorage.setItem('vespera_page_tab', 'pinboard');
    setWindow(900);
    const user = userEvent.setup();
    app();
    await user.click(screen.getByRole('button', { name: 'Start Here' }));
    expect(screen.getByRole('tab', { name: /Quest Board/ })).toHaveAttribute('aria-selected', 'true');
    expect(startHere()).toBeVisible();
  });

  it('jumps without the smooth glide under reduced motion', async () => {
    setWindow(1280, true);
    const user = userEvent.setup();
    app();
    await user.click(screen.getByRole('button', { name: 'Start Here' }));
    expect(scrolls).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('stays plain words once the Start Here category is archived', () => {
    setWindow(1280);
    const state = board();
    app({ ...state, categories: state.categories.map((c) => (c.id === 'tut-cat-start' ? { ...c, archived: true } : c)) });
    expect(screen.getByRole('region', { name: 'Starter tutorial' })).toHaveTextContent('Start Here');
    expect(screen.queryByRole('button', { name: 'Start Here' })).not.toBeInTheDocument();
  });
});
