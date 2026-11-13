// The permanent vocabulary guard: Vespera is vintage fairy tale, castle and storybook only. It fails if any banned
// word (src/test/wording.ts) reaches the rendered app, the starter board, or the copy tables that feed the UI.
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { NoticeBanner } from '../components/NoticeBanner';
import {
  createStarterState,
  describeIntent,
  exportState,
  parseCaptures,
  REALMS,
  SEAL_COLORS,
  SEAL_EMBLEMS,
  STORAGE_KEY,
  type CaptureIntent,
  type Notice,
  type VesperaState,
} from '../context/VesperaContext';
import { AUTH_MESSAGES } from '../sync/authErrors';
import { createFakeBackend } from './fakeBackend';
import { renderWithVespera } from './renderWithVespera';
import { findBannedWords, findFloweryWords, findWordingIssues } from './wording';

const TODAY = '2026-11-12';
const NOW = 10 * 60 + 20;
const SIZES = [
  ['phone', 390],
  ['tablet', 900],
  ['desktop', 1280],
] as const;

/** Answers each `(min-width: Npx)` query for a window `px` wide, as in MobileShell.test.tsx. */
function setWidth(px: number) {
  window.matchMedia = vi.fn().mockImplementation((media: string) => ({
    matches: px >= Number(/min-width:\s*(\d+)px/.exec(media)?.[1] ?? 0),
    media,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

/** Everything a person can read or hear: the page text plus labels, titles, placeholders and alt text. */
function bannedOnScreen(): string[] {
  const attributes = [...document.body.querySelectorAll('*')].flatMap((el) =>
    ['aria-label', 'aria-description', 'aria-roledescription', 'aria-valuetext', 'title', 'placeholder', 'alt'].map((a) => el.getAttribute(a) ?? ''),
  );
  const heard = [document.body.textContent ?? '', ...attributes].join('\n');
  return findWordingIssues(heard);
}

function starter(patch: Partial<VesperaState> = {}): VesperaState {
  return { ...createStarterState(TODAY, NOW), ...patch };
}

function openApp(state: VesperaState) {
  localStorage.setItem(STORAGE_KEY, exportState(state));
  render(<App />);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 10, 20));
});

afterEach(() => {
  vi.useRealTimers();
  // @ts-expect-error -- remove the mock so other suites get the jsdom default
  delete window.matchMedia;
});

describe.each(SIZES)('the rendered app on a %s (%ipx)', (_name, px) => {
  beforeEach(() => setWidth(px));

  it('speaks only plain fairy tale on the board, in Settings and in History', async () => {
    const user = userEvent.setup();
    openApp(starter({ chronicle: [{ id: 'old-1', title: 'Mailed the letters', categoryId: 'cat-reset', done: true, completedOn: '2026-11-11' }] }));
    expect(bannedOnScreen()).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Open Settings' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
    expect(bannedOnScreen()).toEqual([]);
    await user.click(within(screen.getByRole('dialog', { name: 'Settings' })).getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: /^History/ }));
    expect(screen.getByRole('dialog', { name: 'History' })).toBeInTheDocument();
    expect(bannedOnScreen()).toEqual([]);
  });

  it('speaks only plain fairy tale with the Gentle Start overlay open', async () => {
    const user = userEvent.setup();
    openApp(starter());
    await user.click(screen.getByRole('button', { name: /^Gentle Start/ }));
    expect(screen.getByRole('dialog', { name: 'Gentle Start' })).toBeInTheDocument();
    expect(bannedOnScreen()).toEqual([]);
  });

  it('speaks only plain fairy tale with the Focus Timer open', () => {
    const s = starter();
    const block = s.blocks[0];
    openApp({
      ...s,
      focusSession: {
        title: block.title, date: block.date, occurrenceKey: block.id, rhythm: 'pomodoro25', sound: 'off',
        startedAt: Date.now(), totalMinutes: 60, pausedAt: null, pausedMs: 0,
      },
    });
    expect(screen.getByRole('dialog', { name: /Focus Timer/ })).toBeInTheDocument();
    expect(bannedOnScreen()).toEqual([]);
  });
});

describe('the sign-in gate', () => {
  it('speaks only plain fairy tale, in both modes and with each auth message', async () => {
    const user = userEvent.setup();
    render(<App backend={createFakeBackend().backend} />);
    expect(await screen.findByRole('main', { name: 'Sign in to Vespera' })).toBeInTheDocument();
    expect(bannedOnScreen()).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'New here? Create an account' }));
    expect(bannedOnScreen()).toEqual([]);
    expect(findWordingIssues(Object.values(AUTH_MESSAGES).join('\n'))).toEqual([]);
    cleanup();

    render(<App backend={null} localOnlyAllowed={false} />);
    expect(bannedOnScreen()).toEqual([]);
    cleanup();

    const loading = createFakeBackend();
    render(<App backend={{ ...loading.backend, auth: { ...loading.backend.auth, getUser: () => new Promise(() => {}) } }} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(bannedOnScreen()).toEqual([]);
  });
});

describe('the copy behind the UI', () => {
  it('keeps the starter board clean, ids included', () => {
    expect(findWordingIssues(JSON.stringify(createStarterState(TODAY, NOW)))).toEqual([]);
    expect(findWordingIssues(JSON.stringify(createStarterState(TODAY, 22 * 60)))).toEqual([]);
  });

  it('keeps realms and wax seals clean', () => {
    expect(findWordingIssues(JSON.stringify(REALMS))).toEqual([]);
    expect(findWordingIssues(JSON.stringify(SEAL_COLORS))).toEqual([]);
    expect(findWordingIssues(JSON.stringify(SEAL_EMBLEMS))).toEqual([]);
  });

  it('keeps every notice clean', () => {
    // A Record over the union, so a new notice fails to typecheck until it's listed here.
    const notices: Record<Notice, true> = { 'migration-failed': true, 'import-failed': true, 'save-unreadable': true, 'save-repaired': true, 'newer-version': true };
    for (const notice of Object.keys(notices) as Notice[]) {
      renderWithVespera(<NoticeBanner />, starter({ notice }));
      expect(screen.getByRole('alert').textContent).toBeTruthy();
      expect(bannedOnScreen()).toEqual([]);
      cleanup();
    }
  });

  it('keeps every capture preview clean', () => {
    const s = starter();
    const intents: Record<CaptureIntent['kind'], CaptureIntent> = {
      block: { kind: 'block', title: 'Tea with the duchess', date: TODAY, start: 15 * 60, end: 16 * 60, categoryId: 'cat-work', repeat: { freq: 'weekly', interval: 2, weekdays: [4] } },
      quest: { kind: 'quest', title: 'Polish the carriage', categoryId: 'cat-admin', dueDate: '2026-11-14' },
      note: { kind: 'note', text: 'Ribbons for the ball', tagId: 'tag-reminder' },
      vocab: { kind: 'vocab', word: 'Halcyon', definition: 'Calm', tagId: 'tag-vocab' },
      slide: { kind: 'slide', minutes: 30, date: TODAY, occurrenceKey: 'x', label: 'Sample Focus Block' },
      unknown: { kind: 'unknown', text: '?', reason: 'Give the quest a name' },
    };
    const lines = ['quest:', 'note:', 'vocab:', 'slide evening', 'slide 9h', 'block 11pm-1am', 'quest: tidy the parlor by friday', 'note: buy ribbon', 'vocab: Ephemeral - fleeting', 'tea 3-4pm daily', 'slide 15m'];
    const previews = [
      ...Object.values(intents).map((i) => describeIntent(i, s)),
      ...parseCaptures(lines.join('\n'), s, TODAY, NOW).map((p) => describeIntent(p.intent, s)),
    ];
    expect(previews.length).toBeGreaterThan(lines.length);
    expect(findWordingIssues(previews.join('\n'))).toEqual([]);
  });
});

describe('the banned-word list', () => {
  it('catches witchy words in any case and form, and lets fairy-tale and everyday words through', () => {
    for (const bad of ['Break the Spell', 'POTIONS', 'Pocket Grimoire', 'witchy', 'a little ritual', 'Alchemy vial', 'Moonlit Apothecary', 'Cat familiar', 'The Oracle', "Today's elixir", 'lavender tinctures', 'a cursed board', 'brewing a plan', 'runes']) {
      expect(findBannedWords(bad), bad).not.toEqual([]);
    }
    for (const fine of ['Gentle Start', 'spelling bee', 'cursor', '#c8a96e', 'tea brewing', 'brew a pot of tea', 'prune the roses', 'Starlit Ballroom', 'Castle kitten', 'Rosewater vial', 'golden ribbon']) {
      expect(findBannedWords(fine), fine).toEqual([]);
    }
  });
});

describe('the plain-language list', () => {
  it('catches flowery words in any case and form, and lets plain words and field names through', () => {
    for (const bad of ['your candlelit sanctuary', 'little KEEPSAKES', 'Five-minute kindnesses', 'the kitten slumbers', 'Whispers of the day', '5-min unstick', 'Little brass  knobs', 'the candles are snuffed', 'The candles flickered out']) {
      expect(findFloweryWords(bad), bad).not.toEqual([]);
    }
    for (const fine of ['a storybook planner', 'unstickActions', 'Check off a task to light today’s candle', 'Notes, lists & flashcards', 'Quick 5-minute tasks to get moving', 'flicker of gold']) {
      expect(findFloweryWords(fine), fine).toEqual([]);
    }
  });
});
