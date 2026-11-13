import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createBaseState, describeIntent, parseCapture, useVespera, type OneOffBlock, type VesperaState } from '../../context/VesperaContext';
import { renderWithVespera } from '../../test/renderWithVespera';
import { CaptureLauncher } from './CaptureLauncher';
import { QuickScribeButton } from './QuickScribeButton';

const scribe = vi.hoisted(() => ({ via: null as null | 'bridge' | 'key', ask: vi.fn() }));
vi.mock('../../ai/askOracle', () => ({
  useOracleAvailability: () => ({ via: scribe.via }),
  askOracle: scribe.ask,
}));

const TODAY = '2026-11-12';
const board = (extra: Partial<VesperaState> = {}): VesperaState => ({ ...createBaseState(TODAY), ...extra });

function Probe() {
  const { state } = useVespera();
  return (
    <output data-testid="probe">
      {`blocks:${state.blocks.length} series:${state.series.length} tasks:${state.tasks.length} notes:${state.notes.length} `}
      {state.blocks.map((b) => `${b.title}@${b.start}`).join('|')}
    </output>
  );
}

function setup(state = board()) {
  const user = userEvent.setup();
  renderWithVespera(
    <>
      <QuickScribeButton />
      <CaptureLauncher />
      <Probe />
    </>,
    state,
  );
  return user;
}

const dialog = () => screen.queryByRole('dialog', { name: 'Quick Scribe' });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 10, 0));
  scribe.via = null;
  scribe.ask.mockReset();
});
afterEach(() => vi.useRealTimers());

describe('the Quick Scribe pill', () => {
  it('is named Quick Scribe and announces its shortcut', () => {
    setup();
    const pill = screen.getByRole('button', { name: 'Quick Scribe' });
    expect(pill).toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K');
  });

  it('opens the storybook modal, which a ✕ closes', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Quick Scribe' }));
    const modal = dialog()!;
    expect(modal).toHaveAttribute('aria-modal', 'true');
    expect(within(modal).getByLabelText('Capture')).toHaveFocus();
    await user.click(within(modal).getByRole('button', { name: 'Close' }));
    expect(dialog()).not.toBeInTheDocument();
  });

  it('has no floating quill any more', () => {
    setup();
    expect(screen.getAllByRole('button', { name: /quick/i })).toHaveLength(1);
  });
});

describe('opening and closing the modal', () => {
  it('opens with ⌘K or Ctrl+K and closes with Escape', async () => {
    const user = setup();
    expect(dialog()).not.toBeInTheDocument();
    await user.keyboard('{Meta>}k{/Meta}');
    expect(dialog()).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(dialog()).not.toBeInTheDocument();
    await user.keyboard('{Control>}k{/Control}');
    expect(dialog()).toBeInTheDocument();
  });

  it('closes on a backdrop click, keeping the draft for next time', async () => {
    const user = setup();
    await user.keyboard('{Meta>}k{/Meta}');
    await user.type(screen.getByLabelText('Capture'), 'buy stamps');
    await user.click(screen.getByTestId('scribe-backdrop'));
    expect(dialog()).not.toBeInTheDocument();
    await user.keyboard('{Meta>}k{/Meta}');
    expect(screen.getByLabelText('Capture')).toHaveValue('buy stamps');
  });

  it('keeps Tab inside the modal', async () => {
    const user = setup();
    await user.keyboard('{Meta>}k{/Meta}');
    const modal = dialog()!;
    for (let i = 0; i < 12; i++) {
      await user.tab();
      expect(modal).toContainElement(document.activeElement as HTMLElement);
    }
  });
});

describe('capturing', () => {
  it('previews each line as you type', async () => {
    const user = setup();
    await user.keyboard('{Meta>}k{/Meta}');
    await user.type(screen.getByLabelText('Capture'), 'Thu 3-5pm study');
    const expected = describeIntent(parseCapture('Thu 3-5pm study', board(), TODAY, 600)!, board());
    expect(within(screen.getByRole('list', { name: 'Preview' })).getByText(expected)).toBeInTheDocument();
  });

  it('saves on Enter and closes at once, then Undo takes it back', async () => {
    const user = setup();
    await user.keyboard('{Meta>}k{/Meta}');
    await user.type(screen.getByLabelText('Capture'), 'Thu 3-5pm study{Enter}');
    expect(screen.getByTestId('probe')).toHaveTextContent('blocks:1');
    expect(dialog()).not.toBeInTheDocument();
    expect(screen.getByText('Captured 1 thing')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByTestId('probe')).toHaveTextContent('blocks:0');
  });

  it('saves with the ✍️ Save button too', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Quick Scribe' }));
    await user.type(screen.getByLabelText('Capture'), 'quest: water the roses');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByTestId('probe')).toHaveTextContent('tasks:1');
    expect(dialog()).not.toBeInTheDocument();
  });

  it('captures a pasted list in one go, and Shift+Enter adds a line', async () => {
    const user = setup();
    await user.keyboard('{Meta>}k{/Meta}');
    await user.type(screen.getByLabelText('Capture'), 'quest: email prof tomorrow{Shift>}{Enter}{/Shift}groceries: milk, eggs');
    expect(within(screen.getByRole('list', { name: 'Preview' })).getAllByRole('listitem')).toHaveLength(2);
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('probe')).toHaveTextContent('tasks:1 notes:1');
    expect(screen.getByText('Captured 2 things')).toBeInTheDocument();
  });

  it('offers exactly four example chips, in plain words', async () => {
    const user = setup();
    await user.keyboard('{Meta>}k{/Meta}');
    const examples = screen.getByRole('group', { name: 'Things to try' });
    expect(within(examples).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Add quest: Finish reading ch. 4',
      'Block 2pm–3pm Deep Focus',
      'Pin note: Buy oat milk',
      'Fri 9am Coffee with Mum',
    ]);
    expect(screen.queryByRole('dialog', { name: 'Settings' })).not.toBeInTheDocument();
  });

  it('fills the page from an example chip, and previews it rightly', async () => {
    const user = setup();
    await user.keyboard('{Meta>}k{/Meta}');
    const examples = screen.getByRole('group', { name: 'Things to try' });
    await user.click(within(examples).getByRole('button', { name: 'Block 2pm–3pm Deep Focus' }));
    expect(screen.getByLabelText('Capture')).toHaveValue('Block 2pm–3pm Deep Focus');
    expect(screen.getByLabelText('Capture')).toHaveFocus();
    const expected = describeIntent(parseCapture('Block 2pm–3pm Deep Focus', board(), TODAY, 600)!, board());
    expect(expected).toMatch(/^Block · .* · 2:00 PM – 3:00 PM/);
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.getByText('Deep Focus')).toBeInTheDocument();
  });

  it.each([
    ['Add quest: Finish reading ch. 4', /^Quest · /],
    ['Pin note: Buy oat milk', /^Note · /],
    ['Fri 9am Coffee with Mum', /^Block · Fri 13 Nov · 9:00 AM – 10:00 AM/],
  ])('reads the chip "%s" as it says', async (chip, preview) => {
    const user = setup();
    await user.keyboard('{Meta>}k{/Meta}');
    await user.click(within(screen.getByRole('group', { name: 'Things to try' })).getByRole('button', { name: chip }));
    expect(screen.getByText(preview)).toBeInTheDocument();
  });

  it('offers a note instead of a guessed quest', async () => {
    const user = setup();
    await user.keyboard('{Meta>}k{/Meta}');
    await user.type(screen.getByLabelText('Capture'), 'buy stamps');
    await user.click(screen.getByRole('button', { name: 'Save as a note instead' }));
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('probe')).toHaveTextContent('tasks:0 notes:1');
  });

  it('stays open and says so when nothing is readable', async () => {
    const user = setup();
    await user.keyboard('{Meta>}k{/Meta}');
    await user.type(screen.getByLabelText('Capture'), '25pm tea{Enter}');
    expect(screen.getByText(/^Not sure:/)).toBeInTheDocument();
    expect(screen.getByText('Nothing to save yet')).toBeInTheDocument();
    expect(dialog()).toBeInTheDocument();
  });

  it('remembers the last thing saved in one quiet line', async () => {
    const user = setup();
    await user.keyboard('{Meta>}k{/Meta}');
    expect(screen.queryByText(/^Last saved:/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Capture'), 'groceries: milk{Enter}');
    await user.keyboard('{Meta>}k{/Meta}');
    expect(screen.getByText(/^Last saved:/)).toHaveTextContent('Note · Groceries');
  });
});

describe('Ask AI', () => {
  it('is hidden when no AI route is available', async () => {
    const user = setup();
    await user.keyboard('{Meta>}k{/Meta}');
    await user.type(screen.getByLabelText('Capture'), 'buy stamps');
    expect(screen.queryByRole('button', { name: 'Ask AI' })).not.toBeInTheDocument();
  });

  it('replaces a guessed line with the Scribe’s reading, still waiting for Enter', async () => {
    scribe.via = 'bridge';
    scribe.ask.mockResolvedValue({ ok: true, via: 'bridge', intents: [{ kind: 'note', text: 'buy stamps', tagId: 'tag-reminder' }] });
    const user = setup();
    await user.keyboard('{Meta>}k{/Meta}');
    await user.type(screen.getByLabelText('Capture'), 'buy stamps');
    await user.click(screen.getByRole('button', { name: 'Ask AI' }));
    expect(await screen.findByText('Note · Reminders')).toBeInTheDocument();
    expect(screen.getByText('AI suggestion')).toBeInTheDocument();
    expect(screen.getByTestId('probe')).toHaveTextContent('notes:0');
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('probe')).toHaveTextContent('notes:1');
  });

  it('shows the Scribe’s failure gently', async () => {
    scribe.via = 'key';
    scribe.ask.mockResolvedValue({ ok: false, reason: 'unreadable', message: 'AI couldn’t understand that line.' });
    const user = setup();
    await user.keyboard('{Meta>}k{/Meta}');
    await user.type(screen.getByLabelText('Capture'), 'buy stamps');
    await user.click(screen.getByRole('button', { name: 'Ask AI' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('AI couldn’t understand that line.');
  });
});

describe('Plan my day, inside the modal', () => {
  const meeting: OneOffBlock = { id: 'b-meet', date: TODAY, title: 'Meeting', kind: 'anchor', start: 10 * 60 + 30, end: 22 * 60 + 30 };
  const tasks: VesperaState['tasks'] = [
    { id: 't-a', title: 'Draft essay', categoryId: 'cat-study', done: false, dueDate: TODAY },
    { id: 't-b', title: 'Pay rent', categoryId: 'cat-admin', done: false, dueDate: '2026-11-10' },
  ];

  async function openPlan(state: VesperaState) {
    const user = setup(state);
    await user.keyboard('{Meta>}k{/Meta}');
    const toggle = screen.getByRole('button', { name: 'Plan my day' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    return user;
  }

  it('is folded away until asked, then suggests quests for the free gaps and adds only the checked ones', async () => {
    const user = await openPlan(board({ tasks, blocks: [meeting] }));
    const plan = screen.getByRole('group', { name: 'Suggested plan' });
    const boxes = within(plan).getAllByRole('checkbox');
    expect(boxes.map((b) => b.getAttribute('aria-label'))).toEqual(['Pay rent · 10:00 AM – 10:30 AM', 'Draft essay · 10:30 PM – 11:00 PM']);
    await user.click(boxes[1]);
    await user.click(screen.getByRole('button', { name: 'Add 1 block' }));
    expect(screen.getByTestId('probe')).toHaveTextContent('Meeting@630|Pay rent@600');
    expect(screen.getByText('Added 1 block to today')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Suggested plan' })).not.toBeInTheDocument();
  });

  it('says so kindly when the day is full', async () => {
    await openPlan(board({ tasks, blocks: [{ ...meeting, start: 9 * 60, end: 23 * 60 }] }));
    expect(screen.getByText('No free time left today.')).toBeInTheDocument();
  });

  it('folds away again with Not now', async () => {
    const user = await openPlan(board({ tasks }));
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('group', { name: 'Suggested plan' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Plan my day' })).toHaveAttribute('aria-expanded', 'false');
  });
});
