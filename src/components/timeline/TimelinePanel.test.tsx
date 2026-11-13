import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type VesperaState } from '../../context/VesperaContext';
import { renderWithVespera } from '../../test/renderWithVespera';
import { TimelinePanel } from '../TimelinePanel';
import { createSeedState } from '../../test/ownerWeek';

const at = (month: number, day: number, h: number, m = 0) => vi.setSystemTime(new Date(2026, month - 1, day, h, m));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  at(11, 11, 12);
});
afterEach(() => vi.useRealTimers());

const card = (name: string | RegExp) => screen.getByRole('article', { name });
const tabs = () => screen.getAllByRole('tab').map((t) => t.textContent);
const DESK = 'Job 2: Bookshop Shift (Use for Essay Polish & Exam)';
const CLASS = 'Class Attendance & Project Team Check-in';

describe('rolling week', () => {
  it('shows 7 dated tabs from today and pages a week at a time', async () => {
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    expect(tabs()).toEqual(['Wed 11', 'Thu 12', 'Fri 13', 'Sat 14', 'Sun 15', 'Mon 16', 'Tue 17']);
    expect(screen.getByRole('tab', { name: 'Wed 11' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: 'Today' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next week' }));
    expect(tabs()).toEqual(['Wed 18', 'Thu 19', 'Fri 20', 'Sat 21', 'Sun 22', 'Mon 23', 'Tue 24']);
    expect(screen.getByRole('tab', { name: 'Wed 18' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('button', { name: 'Today' }));
    expect(tabs()[0]).toBe('Wed 11');
    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(tabs()[0]).toBe('Wed 4');
  });

  it('shows repeating blocks every week', async () => {
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    await user.click(screen.getByRole('tab', { name: 'Thu 19' }));
    expect(card(DESK)).toBeInTheDocument();
  });
});

describe('now line', () => {
  it('draws a now line between blocks on today and marks the block in progress', () => {
    at(11, 11, 18, 12);
    renderWithVespera(<TimelinePanel />);
    const line = screen.getByRole('separator', { name: 'Now · 6:12 PM' });
    const cook = card('Unpack Groceries, Cook & Eat');
    expect(cook).toHaveAttribute('aria-current', 'time');
    expect(cook.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(line.compareDocumentPosition(card('Workout & Shower Reset')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('is only drawn on today', async () => {
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    await user.click(screen.getByRole('tab', { name: 'Thu 12' }));
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });
});

describe('running late', () => {
  it('offers to slide the rest of today to now', async () => {
    at(11, 11, 18, 12);
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    const offer = screen.getByRole('group', { name: 'Running behind' });
    expect(offer).toHaveTextContent(/running late/i);
    await user.click(within(offer).getByRole('button', { name: 'Move the rest of today to now' }));
    expect(within(card('Unpack Groceries, Cook & Eat')).getByText('6:12 PM – 6:57 PM')).toBeInTheDocument();
    expect(within(card('Workout & Shower Reset')).getByText('6:57 PM – 7:42 PM')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Running behind' })).not.toBeInTheDocument();
  });

  it("'I'm on it' dismisses the offer and marks the block begun", async () => {
    at(11, 11, 18, 12);
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    await user.click(within(screen.getByRole('group', { name: 'Running behind' })).getByRole('button', { name: "I'm on it" }));
    expect(screen.queryByRole('group', { name: 'Running behind' })).not.toBeInTheDocument();
    expect(within(card('Unpack Groceries, Cook & Eat')).getByText('Started')).toBeInTheDocument();
  });

  it('respects the nudge setting', () => {
    at(11, 11, 18, 12);
    const state: VesperaState = { ...createSeedState(), settings: { ...createSeedState().settings, lateOfferMinutes: 0 } };
    renderWithVespera(<TimelinePanel />, state);
    expect(screen.queryByRole('group', { name: 'Running behind' })).not.toBeInTheDocument();
  });
});

describe('block cards', () => {
  it('shows the repeat rule and skips just today, with undo', async () => {
    at(11, 12, 12);
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    expect(within(card(CLASS)).getByText('Weekly · Thu')).toBeInTheDocument();
    expect(within(card('Send Finished Essay to Tutor for Review')).queryByRole('button', { name: 'Skip today' })).not.toBeInTheDocument();
    await user.click(within(card(CLASS)).getByRole('button', { name: 'Skip today' }));
    expect(screen.queryByRole('article', { name: CLASS })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Skipped/);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(card(CLASS)).toBeInTheDocument();
  });

  it('links to its quest category and jumps there', async () => {
    at(11, 12, 12);
    const user = userEvent.setup();
    const target = document.createElement('section');
    target.id = 'quest-category-cat-job2';
    target.scrollIntoView = vi.fn();
    document.body.appendChild(target);
    renderWithVespera(<TimelinePanel />);
    await user.click(within(card(DESK)).getByRole('button', { name: /Job 2 · Bookshop Shift Queue · 2 open/ }));
    expect(target.scrollIntoView).toHaveBeenCalled();
    target.remove();
  });

  it('pushes movable blocks 30 minutes with ripple; anchors cannot be pushed', async () => {
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    await user.click(within(card('Unpack Groceries, Cook & Eat')).getByRole('button', { name: /push 30m/i }));
    expect(within(card('Unpack Groceries, Cook & Eat')).getByText('6:00 PM – 6:45 PM')).toBeInTheDocument();
    expect(within(card('Workout & Shower Reset')).getByText('6:45 PM – 7:30 PM')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Thu 12' }));
    expect(within(card(DESK)).getByText('Locked')).toBeInTheDocument();
    expect(within(card(DESK)).queryByRole('button', { name: /push 30m/i })).not.toBeInTheDocument();
  });
});

describe('block editor', () => {
  const editor = (name = 'Edit block') => within(screen.getByRole('dialog', { name }));

  it("edits a one-off's title and time without asking about scope", async () => {
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    await user.click(screen.getByRole('button', { name: 'Edit Workout & Shower Reset' }));
    await user.clear(editor().getByLabelText('Title'));
    await user.type(editor().getByLabelText('Title'), 'Evening Workout');
    fireEvent.change(editor().getByLabelText('Start'), { target: { value: '18:30' } });
    fireEvent.change(editor().getByLabelText('End'), { target: { value: '19:15' } });
    await user.click(editor().getByRole('button', { name: 'Save' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(within(card('Evening Workout')).getByText('6:30 PM – 7:15 PM')).toBeInTheDocument();
  });

  it('makes a one-off repeat weekly on chosen days', async () => {
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    await user.click(screen.getByRole('button', { name: 'Edit Workout & Shower Reset' }));
    await user.selectOptions(editor().getByLabelText('Repeat'), 'weekly');
    expect(editor().getByRole('button', { name: 'Wednesday' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(editor().getByRole('button', { name: 'Monday' }));
    await user.click(editor().getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('tab', { name: 'Mon 16' }));
    expect(within(card('Workout & Shower Reset')).getByText('Weekly · Mon, Wed')).toBeInTheDocument();
  });

  it('edits just one occurrence of a repeating block', async () => {
    at(11, 12, 12);
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    await user.click(screen.getByRole('button', { name: `Edit ${DESK}` }));
    fireEvent.change(editor().getByLabelText('Start'), { target: { value: '10:00' } });
    await user.click(editor().getByRole('button', { name: 'Save' }));
    const ask = within(screen.getByRole('alertdialog', { name: 'Save repeating block' }));
    await user.click(ask.getByRole('button', { name: /just this one/i }));
    expect(within(card(DESK)).getByText('10:00 AM – 1:00 PM')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    expect(within(card(DESK)).getByText('9:00 AM – 1:00 PM')).toBeInTheDocument();
  });

  it('edits this and all future occurrences', async () => {
    at(11, 12, 12);
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    await user.click(screen.getByRole('button', { name: `Edit ${DESK}` }));
    fireEvent.change(editor().getByLabelText('Start'), { target: { value: '10:00' } });
    await user.click(editor().getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('button', { name: /this and all future/i }));
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    expect(within(card(DESK)).getByText('10:00 AM – 1:00 PM')).toBeInTheDocument();
  });

  it('deletes this and all future occurrences, keeping the past', async () => {
    at(11, 12, 12);
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    await user.click(screen.getByRole('button', { name: 'Next week' }));
    await user.click(screen.getByRole('button', { name: `Edit ${CLASS}` }));
    await user.click(editor().getByRole('button', { name: 'Delete' }));
    const ask = within(screen.getByRole('alertdialog', { name: 'Delete repeating block' }));
    await user.click(ask.getByRole('button', { name: /this and all future/i }));
    expect(screen.queryByRole('article', { name: CLASS })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(card(CLASS)).toBeInTheDocument();
  });

  it('links a block to a quest category', async () => {
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    await user.click(screen.getByRole('button', { name: 'Edit Workout & Shower Reset' }));
    await user.selectOptions(editor().getByLabelText('Linked quest category'), 'cat-grad');
    await user.click(editor().getByRole('button', { name: 'Save' }));
    expect(within(card('Workout & Shower Reset')).getByRole('button', { name: /Night Class & Exam Prep · 3 open/ })).toBeInTheDocument();
  });

  it('can end a repeat on a date', async () => {
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    await user.click(screen.getByRole('button', { name: 'Edit Workout & Shower Reset' }));
    await user.selectOptions(editor().getByLabelText('Repeat'), 'daily');
    await user.selectOptions(editor().getByLabelText('Ends'), 'on');
    fireEvent.change(editor().getByLabelText('End date'), { target: { value: '2026-11-13' } });
    await user.click(editor().getByRole('button', { name: 'Save' }));
    await user.click(screen.getByRole('tab', { name: 'Fri 13' }));
    expect(card('Workout & Shower Reset')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Sat 14' }));
    expect(screen.queryByRole('article', { name: 'Workout & Shower Reset' })).not.toBeInTheDocument();
  });

  it('untimed blocks keep a label instead of times', async () => {
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    await user.click(screen.getByRole('button', { name: 'Edit Workout & Shower Reset' }));
    await user.click(editor().getByLabelText('No set time'));
    await user.clear(editor().getByLabelText('Time label'));
    await user.type(editor().getByLabelText('Time label'), 'After dinner');
    await user.click(editor().getByRole('button', { name: 'Save' }));
    expect(within(card('Workout & Shower Reset')).getByText('After dinner')).toBeInTheDocument();
  });
});

describe('quick add', () => {
  it('adds a timed block inline to the selected date', async () => {
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    await user.click(screen.getByRole('tab', { name: 'Mon 16' }));
    expect(screen.getByText(/nothing planned for this day/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Block title'), 'Laundry reset');
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '10:30' } });
    await user.click(screen.getByRole('button', { name: 'Add block' }));
    expect(within(card('Laundry reset')).getByText('10:00 AM – 10:30 AM')).toBeInTheDocument();
  });

  it('"More options" opens the editor prefilled', async () => {
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    await user.click(screen.getByRole('tab', { name: 'Mon 16' }));
    await user.type(screen.getByLabelText('Block title'), 'Laundry reset');
    await user.click(screen.getByRole('button', { name: 'More options' }));
    const sheet = within(screen.getByRole('dialog', { name: 'New block' }));
    expect(sheet.getByLabelText('Title')).toHaveValue('Laundry reset');
    expect(sheet.getByLabelText('Date')).toHaveValue('2026-11-16');
    await user.click(sheet.getByRole('button', { name: 'Save' }));
    expect(card('Laundry reset')).toBeInTheDocument();
  });
});
