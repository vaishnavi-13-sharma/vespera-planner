import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithVespera } from '../../test/renderWithVespera';
import { MobileShell } from './MobileShell';
import { PinboardFoldSeal } from './PinboardFoldSeal';
import { revealPanel } from './revealPanel';

type Listener = (e: { matches: boolean }) => void;
let listeners: { media: string; cb: Listener }[] = [];
let width = 1280;

/** Answers each `(min-width: Npx)` query for a window `px` wide. */
const matchesAt = (media: string, px: number) => px >= Number(/min-width:\s*(\d+)px/.exec(media)?.[1] ?? 0);

function setWidth(px: number) {
  width = px;
  listeners = [];
  window.matchMedia = vi.fn().mockImplementation((media: string) => ({
    matches: matchesAt(media, width),
    media,
    addEventListener: (_: string, cb: Listener) => listeners.push({ media, cb }),
    removeEventListener: (_: string, cb: Listener) => (listeners = listeners.filter((l) => l.cb !== cb)),
  })) as unknown as typeof window.matchMedia;
}

/** Resizes the window and fires each query's `change` event. */
function resizeTo(px: number) {
  width = px;
  act(() => listeners.forEach((l) => l.cb({ matches: matchesAt(l.media, px) })));
}

/** The Pinboard places the fold seal in its own header, through the shell's slot. */
const pinboard = (
  <header data-testid="pinboard-header">
    <p>PINBOARD</p>
    <PinboardFoldSeal />
  </header>
);
const shell = () => renderWithVespera(<MobileShell timeline={<p>TIMELINE</p>} quests={<p>QUESTS</p>} pinboard={pinboard} />);

afterEach(() => {
  vi.useRealTimers();
  // @ts-expect-error -- remove the mock so other suites get the jsdom default
  delete window.matchMedia;
});

describe('MobileShell: the Full Vanity Triptych (1100px and up)', () => {
  it('shows all three panels side by side, with no tabs', () => {
    setWidth(1280);
    shell();
    for (const t of ['TIMELINE', 'QUESTS', 'PINBOARD']) expect(screen.getByText(t)).toBeVisible();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Panels' })).not.toBeInTheDocument();
  });

  it('uses the triptych when matchMedia is missing', () => {
    shell();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    for (const t of ['TIMELINE', 'QUESTS', 'PINBOARD']) expect(screen.getByText(t)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Fold Pinboard' })).toBeInTheDocument();
  });

  it('folds the Pinboard into a strip, keeps it mounted, and remembers the fold', async () => {
    const user = userEvent.setup();
    setWidth(1280);
    const { unmount } = shell();
    const fold = screen.getByRole('button', { name: 'Fold Pinboard' });
    expect(fold).toHaveAttribute('aria-expanded', 'true');
    await user.click(fold);

    const unfold = screen.getByRole('button', { name: 'Unfold Pinboard' });
    expect(unfold).toHaveAttribute('aria-expanded', 'false');
    expect(unfold).toHaveTextContent('📜 Pinboard');
    expect(screen.getByText('PINBOARD')).toBeInTheDocument();
    expect(screen.getByText('PINBOARD')).not.toBeVisible();
    expect(screen.getByText('QUESTS')).toBeVisible();
    expect(localStorage.getItem('vespera_pinboard_folded')).toBe('true');

    unmount();
    shell();
    await user.click(screen.getByRole('button', { name: 'Unfold Pinboard' }));
    expect(screen.getByText('PINBOARD')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Fold Pinboard' })).toHaveAttribute('aria-expanded', 'true');
    expect(localStorage.getItem('vespera_pinboard_folded')).toBe('false');
  });

  it('puts the fold seal in the Pinboard’s own header row, not a floating corner', () => {
    setWidth(1280);
    shell();
    const fold = screen.getByRole('button', { name: 'Fold Pinboard' });
    expect(screen.getByTestId('pinboard-header')).toContainElement(fold);
    expect(fold.className).not.toMatch(/\babsolute\b/);
    expect(document.getElementById(fold.getAttribute('aria-controls')!)).toContainElement(screen.getByText('PINBOARD'));
  });
});

describe('MobileShell: revealing a panel from elsewhere', () => {
  it('turns to the asked-for tab on a phone and page on a tablet, and does nothing in the triptych', () => {
    setWidth(390);
    const { unmount } = shell();
    act(() => revealPanel('pinboard'));
    expect(screen.getByRole('tab', { name: /Pinboard/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('PINBOARD')).toBeVisible();
    unmount();

    setWidth(900);
    const second = shell();
    act(() => revealPanel('pinboard'));
    expect(screen.getByRole('tab', { name: /Pinboard/ })).toHaveAttribute('aria-selected', 'true');
    act(() => revealPanel('quests'));
    expect(screen.getByRole('tab', { name: /Quest Board/ })).toHaveAttribute('aria-selected', 'true');
    second.unmount();

    setWidth(1280);
    shell();
    act(() => revealPanel('timeline'));
    for (const t of ['TIMELINE', 'QUESTS', 'PINBOARD']) expect(screen.getByText(t)).toBeVisible();
  });
});

describe('MobileShell: the Two-Page Open Storybook (768–1099px)', () => {
  it('keeps the Timeline on the left page and bookmarks Quests and Pinboard on the right', async () => {
    const user = userEvent.setup();
    setWidth(900);
    const { unmount } = shell();
    const pages = screen.getByRole('tablist', { name: 'Pages' });
    expect(within(pages).getAllByRole('tab').map((t) => t.textContent)).toEqual([
      expect.stringContaining('Quest Board'),
      expect.stringContaining('Pinboard'),
    ]);
    expect(within(pages).getByRole('tab', { name: /Quest Board/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('TIMELINE')).toBeVisible();
    expect(screen.getByText('QUESTS')).toBeVisible();
    expect(screen.getByText('PINBOARD')).not.toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'Panels' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fold Pinboard' })).not.toBeInTheDocument();

    await user.click(within(pages).getByRole('tab', { name: /Pinboard/ }));
    expect(screen.getByText('PINBOARD')).toBeVisible();
    expect(screen.getByText('TIMELINE')).toBeVisible();
    expect(screen.getByText('QUESTS')).not.toBeVisible();
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', within(pages).getByRole('tab', { name: /Pinboard/ }).getAttribute('aria-controls'));
    expect(localStorage.getItem('vespera_page_tab')).toBe('pinboard');

    unmount();
    shell();
    expect(screen.getByRole('tab', { name: /Pinboard/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows no Happening Now pill', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 10, 0));
    setWidth(900);
    shell();
    expect(screen.queryByRole('button', { name: /^Happening now:/ })).not.toBeInTheDocument();
  });
});

describe('MobileShell: the Pocket Storybook (under 768px)', () => {
  it('shows one panel at a time with a bottom tab bar, starting on Quests', () => {
    setWidth(390);
    shell();
    expect(screen.getByRole('navigation', { name: 'Panels' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Quests/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('QUESTS')).toBeVisible();
    expect(screen.getByText('TIMELINE')).not.toBeVisible();
    expect(screen.getByText('PINBOARD')).not.toBeVisible();
  });

  it('switches panels, keeps them mounted, and remembers the choice', async () => {
    const user = userEvent.setup();
    setWidth(390);
    const { unmount } = shell();
    await user.click(screen.getByRole('tab', { name: /Pinboard/ }));
    expect(screen.getByText('PINBOARD')).toBeVisible();
    expect(screen.getByText('QUESTS')).toBeInTheDocument();
    expect(screen.getByText('QUESTS')).not.toBeVisible();
    unmount();
    shell();
    expect(screen.getByRole('tab', { name: /Pinboard/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('moves between tabs with the arrow keys and links tabs to their panels', async () => {
    const user = userEvent.setup();
    setWidth(390);
    shell();
    const quests = screen.getByRole('tab', { name: /Quests/ });
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', quests.getAttribute('aria-controls'));
    quests.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Pinboard/ })).toHaveFocus();
    expect(screen.getByText('PINBOARD')).toBeVisible();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /Timeline/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('TIMELINE')).toBeVisible();
  });

  it('falls back to Quests when the remembered tab is unknown', () => {
    localStorage.setItem('vespera_mobile_tab', 'ballroom');
    setWidth(390);
    shell();
    expect(screen.getByRole('tab', { name: /Quests/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('moves through the tiers as the window widens, without losing a panel', () => {
    setWidth(390);
    shell();
    const quests = screen.getByText('QUESTS');
    resizeTo(900);
    expect(screen.queryByRole('navigation', { name: 'Panels' })).not.toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Pages' })).toBeInTheDocument();
    expect(screen.getByText('TIMELINE')).toBeVisible();
    resizeTo(1280);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    for (const t of ['TIMELINE', 'QUESTS', 'PINBOARD']) expect(screen.getByText(t)).toBeVisible();
    expect(screen.getByText('QUESTS')).toBe(quests);
  });

  describe('Happening Now pill', () => {
    const at = (h: number, m = 0) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 10, 12, h, m)); // Thu Nov 12 2026
    };

    it('shows the block in progress on Quests and jumps to the Timeline when tapped', async () => {
      at(10);
      const user = userEvent.setup();
      setWidth(390);
      shell();
      const pill = screen.getByRole('button', { name: /^Happening now: Job 2: Bookshop Shift/ });
      expect(pill).toHaveTextContent('Now: Job 2: Bookshop Shift (Use for Essay Polish & Exam) · until 1:00 PM');
      // The bookshop shift is an anchor: no focus launcher.
      expect(screen.queryByRole('button', { name: 'Focus' })).not.toBeInTheDocument();

      await user.click(pill);
      expect(screen.getByRole('tab', { name: /Timeline/ })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('TIMELINE')).toBeVisible();
      expect(screen.queryByRole('button', { name: /^Happening now:/ })).not.toBeInTheDocument();
    });

    it('offers the focus launcher beside a movable block', () => {
      at(20, 30);
      setWidth(390);
      shell();
      expect(screen.getByRole('button', { name: /^Happening now: Send Finished Essay/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Focus' })).toBeInTheDocument();
    });

    it('stays away when nothing timed is in progress', () => {
      at(8);
      setWidth(390);
      shell();
      expect(screen.queryByRole('button', { name: /^Happening now:/ })).not.toBeInTheDocument();
    });
  });
});
