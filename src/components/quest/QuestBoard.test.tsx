import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type VesperaState } from '../../context/VesperaContext';
import { renderWithVespera } from '../../test/renderWithVespera';
import { QuestBoard } from '../QuestBoard';
import { createSeedState } from '../../test/ownerWeek';

const at = (month: number, day: number, h: number, m = 0) => vi.setSystemTime(new Date(2026, month - 1, day, h, m));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  at(11, 11, 12);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const SWEEP = '5-minute floor sweep around bed and desk (Clear the hair/visual clutter)';
const CATS = ['Quick Reset & Self-Care', 'Job 1 · Deep Research', 'Night Class & Exam Prep', 'Job 2 · Bookshop Shift Queue'];
const region = (name: string) => screen.getByRole('region', { name });
const categoryOrder = () => screen.getAllByRole('region').map((r) => r.getAttribute('aria-label')).filter((n) => n !== 'Quest Board');
const row = (title: string) => screen.getByRole('checkbox', { name: title }).closest('li')!;
const sheet = (name: string) => within(screen.getByRole('dialog', { name }));

describe('categories', () => {
  it('renders the user’s categories in order, each addressable by id', () => {
    renderWithVespera(<QuestBoard />);
    expect(categoryOrder()).toEqual(CATS);
    expect(document.getElementById('quest-category-cat-job2')).toBe(region('Job 2 · Bookshop Shift Queue'));
    expect(within(region('Night Class & Exam Prep')).getAllByRole('checkbox')).toHaveLength(3);
  });

  it('adds a new category', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />);
    await user.click(screen.getByRole('button', { name: 'New category' }));
    await user.type(sheet('New category').getByLabelText('Name'), 'Job 3 · Lab');
    await user.click(sheet('New category').getByRole('button', { name: 'Use 🧪' }));
    await user.click(sheet('New category').getByRole('radio', { name: 'Sage' }));
    await user.click(sheet('New category').getByRole('button', { name: 'Save' }));
    expect(categoryOrder().at(-1)).toBe('Job 3 · Lab');
  });

  it('renames a category and keeps its quests', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />);
    await user.click(screen.getByRole('button', { name: 'Job 2 · Bookshop Shift Queue options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit category' }));
    const name = sheet('Edit category').getByLabelText('Name');
    expect(name).toHaveValue('Job 2 · Bookshop Shift Queue');
    await user.clear(name);
    await user.type(name, 'Front Desk Queue');
    await user.click(sheet('Edit category').getByRole('button', { name: 'Save' }));
    expect(within(region('Front Desk Queue')).getAllByRole('checkbox')).toHaveLength(2);
  });

  it('reorders categories', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />);
    await user.click(screen.getByRole('button', { name: 'Night Class & Exam Prep options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move up' }));
    expect(categoryOrder()).toEqual([CATS[0], CATS[2], CATS[1], CATS[3]]);
  });

  it('archives a category, with undo', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />);
    await user.click(screen.getByRole('button', { name: 'Job 2 · Bookshop Shift Queue options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Archive' }));
    expect(categoryOrder()).toEqual(CATS.slice(0, 3));
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(categoryOrder()).toEqual(CATS);
  });

  it('moves past archived categories in one step, and hides moves at the ends', async () => {
    const user = userEvent.setup();
    const seed = createSeedState();
    const state: VesperaState = { ...seed, categories: seed.categories.map((c) => (c.id === 'cat-job1' ? { ...c, archived: true } : c)) };
    renderWithVespera(<QuestBoard />, state);
    await user.click(screen.getByRole('button', { name: 'Night Class & Exam Prep options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move up' }));
    expect(categoryOrder()).toEqual([CATS[2], CATS[0], CATS[3]]);
    await user.click(screen.getByRole('button', { name: 'Night Class & Exam Prep options' }));
    expect(screen.queryByRole('menuitem', { name: 'Move up' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Move down' })).toBeInTheDocument();
  });

  it('glows and lifts the category linked to the block happening now', () => {
    at(11, 12, 10); // Thursday bookshop shift, linked to Job 2
    renderWithVespera(<QuestBoard />);
    expect(categoryOrder()[0]).toBe('Job 2 · Bookshop Shift Queue');
    expect(within(region('Job 2 · Bookshop Shift Queue')).getByText(/happening now/i)).toBeInTheDocument();
  });

  it('does not glow when nothing linked is happening', () => {
    at(11, 12, 14);
    renderWithVespera(<QuestBoard />);
    expect(categoryOrder()).toEqual(CATS);
    expect(screen.queryByText(/happening now/i)).not.toBeInTheDocument();
  });
});

describe('quests', () => {
  it('stamps a wax seal and unspools today’s golden ribbon', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />);
    const bar = screen.getByRole('progressbar', { name: 'Today’s progress' });
    await user.click(screen.getByRole('checkbox', { name: /language-app/ }));
    expect(screen.getByRole('checkbox', { name: /language-app/ })).toHaveAttribute('aria-checked', 'true');
    expect(bar).toHaveAttribute('aria-valuenow', '11');
    expect(screen.getByText('1 / 9 quests')).toBeInTheDocument();
  });

  it('adds a quest inline', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />);
    await user.type(screen.getByRole('textbox', { name: 'New Job 1 · Deep Research quest' }), 'Clean the dataset{Enter}');
    expect(within(region('Job 1 · Deep Research')).getByRole('checkbox', { name: 'Clean the dataset' })).toBeInTheDocument();
  });

  it('shows due chips, and a gentle "carried over" ribbon once past due', () => {
    at(11, 13, 12); // Friday
    renderWithVespera(<QuestBoard />);
    expect(within(row('Finish full draft of the Night Class personal essay by Thursday night')).getByText(/carried over/i)).toBeInTheDocument();
    const gre = row('Complete 3 Exam Modules by Sunday to prep for daily mock exams');
    expect(within(gre).getByText('Due Sun')).toBeInTheDocument();
    expect(within(gre).queryByText(/carried over/i)).not.toBeInTheDocument();
  });

  it('edits a quest: title, category and due date', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />);
    await user.click(screen.getByRole('button', { name: `${SWEEP} options` }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    const s = sheet('Edit quest');
    await user.clear(s.getByLabelText('Title'));
    await user.type(s.getByLabelText('Title'), 'Quick sweep');
    await user.selectOptions(s.getByLabelText('Category'), 'cat-job1');
    fireEvent.change(s.getByLabelText('Due date'), { target: { value: '2026-11-14' } });
    await user.click(s.getByRole('button', { name: 'Save' }));
    expect(within(region('Job 1 · Deep Research')).getByRole('checkbox', { name: 'Quick sweep' })).toBeInTheDocument();
    expect(within(row('Quick sweep')).getByText('Due Sat')).toBeInTheDocument();
  });

  it('adds the day of the month to due chips more than a week away', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />);
    await user.click(screen.getByRole('button', { name: `${SWEEP} options` }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    fireEvent.change(sheet('Edit quest').getByLabelText('Due date'), { target: { value: '2026-11-26' } });
    await user.click(sheet('Edit quest').getByRole('button', { name: 'Save' }));
    expect(within(row(SWEEP)).getByText('Due Thu 26')).toBeInTheDocument();
  });

  it('clears a due date', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />);
    const title = 'Email Essay draft to tutor before Friday';
    await user.click(screen.getByRole('button', { name: `${title} options` }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    await user.click(sheet('Edit quest').getByRole('button', { name: 'Clear due date' }));
    await user.click(sheet('Edit quest').getByRole('button', { name: 'Save' }));
    expect(within(row(title)).queryByText(/^Due /)).not.toBeInTheDocument();
  });

  it('deletes a quest from its menu', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />);
    await user.click(screen.getByRole('button', { name: /4–5 language-app lessons for the Halloween event skin options/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.queryByRole('checkbox', { name: /language-app/ })).not.toBeInTheDocument();
  });

  it('drags a quest into another category', () => {
    renderWithVespera(<QuestBoard />);
    const setData = vi.fn();
    fireEvent.dragStart(row(SWEEP), { dataTransfer: { setData, effectAllowed: 'move' } });
    expect(setData).toHaveBeenCalledWith('text/plain', 'task-sweep');
    const target = region('Job 2 · Bookshop Shift Queue');
    fireEvent.dragOver(target, { dataTransfer: { dropEffect: 'move' } });
    fireEvent.drop(target, { dataTransfer: { getData: () => 'task-sweep' } });
    expect(within(region('Job 2 · Bookshop Shift Queue')).getByRole('checkbox', { name: SWEEP })).toBeInTheDocument();
  });
});

describe('Chronicle', () => {
  const withHistory = (): VesperaState => ({
    ...createSeedState(),
    chronicle: [
      { id: 'old-2', title: 'Mailed the forms', categoryId: 'cat-reset', done: true, completedOn: '2026-11-10' },
      { id: 'old-1', title: 'Old quest', categoryId: 'cat-reset', done: true, completedOn: '2026-11-09' },
    ],
  });

  it('lists finished quests by day and restores one', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />, withHistory());
    await user.click(screen.getByRole('button', { name: /History/ }));
    const s = sheet('History');
    const days = s.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(days).toEqual(['Tuesday, November 10', 'Monday, November 9']);
    await user.click(s.getByRole('button', { name: 'Restore Old quest' }));
    expect(s.queryByText('Old quest')).not.toBeInTheDocument();
    expect(within(region('Quick Reset & Self-Care')).getByRole('checkbox', { name: 'Old quest' })).toHaveAttribute('aria-checked', 'false');
  });

  it('has a gentle empty state', async () => {
    const user = userEvent.setup();
    renderWithVespera(<QuestBoard />);
    await user.click(screen.getByRole('button', { name: /History/ }));
    expect(sheet('History').getByText(/nothing here yet/i)).toBeInTheDocument();
  });
});

describe('Gentle Start', () => {
  it('uses the configured timer length and completes the picked quest', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const user = userEvent.setup();
    const state: VesperaState = { ...createSeedState(), settings: { ...createSeedState().settings, focusMinutes: 2 } };
    renderWithVespera(<QuestBoard />, state);
    await user.click(screen.getByRole('button', { name: /gentle start/i }));
    const veil = within(screen.getByRole('dialog', { name: 'Gentle Start' }));
    expect(veil.getByText(SWEEP)).toBeInTheDocument();
    expect(veil.getByRole('timer')).toHaveTextContent('2:00');
    await user.click(veil.getByRole('button', { name: /i did it/i }));
    expect(screen.getByRole('checkbox', { name: SWEEP })).toHaveAttribute('aria-checked', 'true');
  });

  it('counts down on screen', () => {
    vi.useRealTimers();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 11, 12, 0));
    renderWithVespera(<QuestBoard />);
    fireEvent.click(screen.getByRole('button', { name: /gentle start/i }));
    expect(screen.getByRole('timer')).toHaveTextContent('5:00');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('4:59');
  });
});
