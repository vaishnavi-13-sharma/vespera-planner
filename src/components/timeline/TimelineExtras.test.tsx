import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithVespera } from '../../test/renderWithVespera';
import { TimelinePanel } from '../TimelinePanel';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 12, 0));
});
afterEach(() => vi.useRealTimers());

const card = (name: string) => screen.getByRole('article', { name });
const CLASS = 'Class Attendance & Project Team Check-in';

describe('timeline extras', () => {
  it('only offers "This and all future" when a repeat rule changes', async () => {
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    await user.click(screen.getByRole('button', { name: `Edit ${CLASS}` }));
    const sheet = within(screen.getByRole('dialog', { name: 'Edit block' }));
    await user.click(sheet.getByRole('button', { name: 'Friday' }));
    await user.click(sheet.getByRole('button', { name: 'Save' }));
    const ask = within(screen.getByRole('alertdialog', { name: 'Save repeating block' }));
    expect(ask.queryByRole('button', { name: /just this one/i })).not.toBeInTheDocument();
    await user.click(ask.getByRole('button', { name: /this and all future/i }));
    expect(within(card(CLASS)).getByText('Weekly · Thu, Fri')).toBeInTheDocument();
  });

  it('deletes a one-off right away, with undo', async () => {
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    const title = 'Send Finished Essay to Tutor for Review';
    await user.click(screen.getByRole('button', { name: `Edit ${title}` }));
    await user.click(within(screen.getByRole('dialog', { name: 'Edit block' })).getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('article', { name: title })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(card(title)).toBeInTheDocument();
  });

  it('moves between day tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    screen.getByRole('tab', { name: 'Thu 12' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Fri 13' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Fri 13' })).toHaveFocus();
  });

  it('names other days on the skip button', async () => {
    const user = userEvent.setup();
    renderWithVespera(<TimelinePanel />);
    await user.click(screen.getByRole('tab', { name: 'Fri 13' }));
    expect(within(card('Job 2: Bookshop Shift (Exam Module 1 & Vocab)')).getByRole('button', { name: 'Skip Fri' })).toBeInTheDocument();
  });
});
