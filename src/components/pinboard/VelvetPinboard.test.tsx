import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithVespera } from '../../test/renderWithVespera';
import { MobileShell } from '../shell/MobileShell';
import { VelvetPinboard } from '../VelvetPinboard';

describe('VelvetPinboard', () => {
  it('pins the seeded notes and vocab cards', () => {
    renderWithVespera(<VelvetPinboard />);
    expect(screen.getAllByRole('article', { name: 'Reminders note' })).toHaveLength(2);
    expect(screen.getByRole('article', { name: 'Brain Dump note' })).toBeInTheDocument();
    expect(screen.getAllByRole('article', { name: /^Vocab card:/ })).toHaveLength(4);
  });

  it('filters by tag', async () => {
    const user = userEvent.setup();
    renderWithVespera(<VelvetPinboard />);
    const vocab = screen.getByRole('button', { name: 'Word Bank' });
    await user.click(vocab);
    expect(vocab).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('article', { name: 'Reminders note' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('article', { name: /^Vocab card:/ })).toHaveLength(4);
    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getAllByRole('article', { name: 'Reminders note' })).toHaveLength(2);
  });

  it('shows an empty state for a tag with no notes', async () => {
    const user = userEvent.setup();
    renderWithVespera(<VelvetPinboard />);
    await user.click(screen.getByRole('button', { name: 'Groceries' }));
    expect(screen.getByText(/nothing pinned here yet/i)).toBeInTheDocument();
  });

  it('reveals a vocab definition on demand', async () => {
    const user = userEvent.setup();
    renderWithVespera(<VelvetPinboard />);
    const card = screen.getByRole('article', { name: 'Vocab card: Laconic' });
    expect(within(card).queryByText(/very few words/)).not.toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: /reveal definition/i }));
    expect(within(card).getByText(/very few words/)).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: /hide definition/i }));
    expect(within(card).queryByText(/very few words/)).not.toBeInTheDocument();
  });

  it('pins a new grocery note', async () => {
    const user = userEvent.setup();
    renderWithVespera(<VelvetPinboard />);
    await user.selectOptions(screen.getByLabelText('Note type'), 'tag-grocery');
    await user.type(screen.getByLabelText('Note'), 'Oat milk, berries');
    await user.click(screen.getByRole('button', { name: 'Pin it' }));
    expect(within(screen.getByRole('article', { name: 'Groceries note' })).getByText('Oat milk, berries')).toBeInTheDocument();
    expect(screen.getByLabelText('Note')).toHaveValue('');
  });

  it('pins a new vocab card with its definition', async () => {
    const user = userEvent.setup();
    renderWithVespera(<VelvetPinboard />);
    await user.selectOptions(screen.getByLabelText('Note type'), 'tag-vocab');
    await user.type(screen.getByLabelText('Word'), 'Garrulous');
    await user.type(screen.getByLabelText('Definition'), 'Excessively talkative.');
    await user.click(screen.getByRole('button', { name: 'Pin it' }));
    const card = screen.getByRole('article', { name: 'Vocab card: Garrulous' });
    await user.click(within(card).getByRole('button', { name: /reveal definition/i }));
    expect(within(card).getByText('Excessively talkative.')).toBeInTheDocument();
  });

  it('unpins a note', async () => {
    const user = userEvent.setup();
    renderWithVespera(<VelvetPinboard />);
    await user.click(screen.getByRole('button', { name: 'Unpin note: Laconic' }));
    expect(screen.queryByRole('article', { name: 'Vocab card: Laconic' })).not.toBeInTheDocument();
  });
});

describe('the Pinboard header', () => {
  afterEach(() => {
    // @ts-expect-error -- remove the mock so other suites get the jsdom default
    delete window.matchMedia;
  });

  it('keeps Edit tags, Study and the fold seal in one cluster beside the title', () => {
    window.matchMedia = vi.fn().mockImplementation((media: string) => ({
      matches: media.includes('min-width'),
      media,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    renderWithVespera(<MobileShell timeline={<p>TIMELINE</p>} quests={<p>QUESTS</p>} pinboard={<VelvetPinboard />} />);
    const pinboard = screen.getByRole('region', { name: 'Pinboard' });
    const tools = within(pinboard).getByRole('group', { name: 'Pinboard tools' });
    expect(within(tools).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Edit tags',
      expect.stringMatching(/^Study · \d+ due$/),
      'Fold Pinboard',
    ]);
    expect(tools.closest('header')).toContainElement(within(pinboard).getByRole('heading', { name: 'Pinboard' }));
  });

  it('has one scrolling filter row, with All first', () => {
    renderWithVespera(<VelvetPinboard />);
    const filters = screen.getByRole('group', { name: 'Filter notes' });
    expect(filters.className).toMatch(/\boverflow-x-auto\b/);
    expect(filters.className).not.toMatch(/\bflex-wrap\b/);
    expect(within(filters).getAllByRole('button')[0]).toHaveAccessibleName('All');
    expect(filters.closest('header')).toBeNull();
  });
});

describe('editing tags', () => {
  const tagsSheet = () => within(screen.getByRole('dialog', { name: 'Edit tags' }));

  it('renames a tag', async () => {
    const user = userEvent.setup();
    renderWithVespera(<VelvetPinboard />);
    await user.click(screen.getByRole('button', { name: 'Edit tags' }));
    const name = tagsSheet().getByLabelText('Name of Groceries');
    await user.clear(name);
    await user.type(name, 'Market');
    await user.click(tagsSheet().getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Market' })).toBeInTheDocument();
  });

  it('deletes a tag and moves its notes to another tag of the same kind', async () => {
    const user = userEvent.setup();
    renderWithVespera(<VelvetPinboard />);
    await user.click(screen.getByRole('button', { name: 'Edit tags' }));
    expect(tagsSheet().getByRole('button', { name: 'Delete Word Bank tag' })).toBeDisabled();
    await user.click(tagsSheet().getByRole('button', { name: 'Delete Reminders tag' }));
    await user.click(tagsSheet().getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('button', { name: 'Reminders' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('article', { name: 'Brain Dump note' })).toHaveLength(3);
  });

  it('adds a tag, including a new vocab deck', async () => {
    const user = userEvent.setup();
    renderWithVespera(<VelvetPinboard />);
    await user.click(screen.getByRole('button', { name: 'Edit tags' }));
    await user.type(tagsSheet().getByLabelText('New tag name'), 'Spanish');
    await user.click(tagsSheet().getByLabelText('Vocab cards'));
    await user.click(tagsSheet().getByRole('button', { name: 'Add tag' }));
    await user.click(tagsSheet().getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Spanish' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Note type'), screen.getByRole('option', { name: /Spanish/ }));
    expect(screen.getByLabelText('Word')).toBeInTheDocument();
  });
});

describe('editing tags: details', () => {
  it('says where a deleted tag’s notes went and resets a filter on that tag', async () => {
    const user = userEvent.setup();
    renderWithVespera(<VelvetPinboard />);
    await user.click(screen.getByRole('button', { name: 'Reminders' }));
    await user.click(screen.getByRole('button', { name: 'Edit tags' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Edit tags' })).getByRole('button', { name: 'Delete Reminders tag' }));
    expect(screen.getByRole('status')).toHaveTextContent('Its 2 notes moved to 💭 Brain Dump');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('labels vocab cards with their own deck', async () => {
    const user = userEvent.setup();
    renderWithVespera(<VelvetPinboard />);
    await user.click(screen.getByRole('button', { name: 'Edit tags' }));
    const name = within(screen.getByRole('dialog', { name: 'Edit tags' })).getByLabelText('Name of Word Bank');
    await user.clear(name);
    await user.type(name, 'Word Hoard');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(within(screen.getByRole('article', { name: 'Vocab card: Laconic' })).getByText(/Word Hoard/)).toBeInTheDocument();
  });
});
