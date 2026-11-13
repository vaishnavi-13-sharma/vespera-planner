// The Chronicle sheet shows months archived by compaction below the recent entries (Wave 3).
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChronicleSheet } from '../components/quest/ChronicleSheet';
import { renderWithVespera } from '../test/renderWithVespera';
import { createBaseState, type VesperaState } from './VesperaContext';

const october = { month: '2026-10', total: 42, byCategory: { 'cat-work': 30, 'cat-study': 11, 'cat-gone': 1 }, titles: ['Ship the deck', 'Read chapter 3'] };
const july = { month: '2026-07', total: 1, byCategory: { 'cat-admin': 1 }, titles: ['Renew passport'] };

function board(patch: Partial<VesperaState>): VesperaState {
  return { ...createBaseState('2026-11-12'), ...patch };
}

const sheet = () => within(screen.getByRole('dialog', { name: 'History' }));

it('lists archived months below the recent entries, newest first, each collapsed', () => {
  renderWithVespera(
    <ChronicleSheet onClose={() => {}} />,
    board({ chronicle: [{ id: 'c1', title: 'Recent win', categoryId: 'cat-work', done: true, completedOn: '2026-11-10' }], chronicleArchive: [july, october] }),
  );
  const months = sheet().getAllByRole('button', { name: /quests?$/ });
  expect(months.map((m) => m.textContent)).toEqual(['October 2026 · 42 quests', 'July 2026 · 1 quest']);
  expect(months.every((m) => m.getAttribute('aria-expanded') === 'false')).toBe(true);
  // Recent entries come first and can still be restored.
  const recent = sheet().getByText('Recent win');
  expect(recent.compareDocumentPosition(months[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(sheet().getByRole('button', { name: 'Restore Recent win' })).toBeInTheDocument();
  expect(sheet().queryByText('Ship the deck')).not.toBeInTheDocument();
});

it('expands a month to its counts per category (with emoji) and its titles, which can’t be restored', async () => {
  const user = userEvent.setup();
  renderWithVespera(<ChronicleSheet onClose={() => {}} />, board({ chronicleArchive: [october] }));
  const month = sheet().getByRole('button', { name: 'October 2026 · 42 quests' });
  await user.click(month);
  expect(month).toHaveAttribute('aria-expanded', 'true');

  const details = sheet().getByRole('region', { name: 'October 2026' });
  expect(within(details).getByText('💼 Work · 30')).toBeInTheDocument();
  expect(within(details).getByText('📚 Study · 11')).toBeInTheDocument();
  expect(within(details).getByText('✨ A deleted category · 1')).toBeInTheDocument();
  expect(within(details).getByText('Ship the deck')).toBeInTheDocument();
  expect(within(details).getByText('Read chapter 3')).toBeInTheDocument();
  expect(within(details).queryByRole('button')).not.toBeInTheDocument();

  await user.click(month);
  expect(month).toHaveAttribute('aria-expanded', 'false');
  expect(sheet().queryByText('Ship the deck')).not.toBeInTheDocument();
});

it('says how many more quests a month held than the titles it kept', async () => {
  const user = userEvent.setup();
  renderWithVespera(<ChronicleSheet onClose={() => {}} />, board({ chronicleArchive: [october] }));
  await user.click(sheet().getByRole('button', { name: 'October 2026 · 42 quests' }));
  expect(sheet().getByText('…and 40 more')).toBeInTheDocument();
});

it('shows the archive instead of the empty message when only old quests remain', () => {
  renderWithVespera(<ChronicleSheet onClose={() => {}} />, board({ chronicleArchive: [july] }));
  expect(sheet().queryByText(/Nothing here yet/)).not.toBeInTheDocument();
  expect(sheet().getByRole('button', { name: 'July 2026 · 1 quest' })).toBeInTheDocument();
});

it('still shows the empty message for a brand-new Chronicle', () => {
  renderWithVespera(<ChronicleSheet onClose={() => {}} />, board({}));
  expect(sheet().getByText(/Nothing here yet/)).toBeInTheDocument();
});
