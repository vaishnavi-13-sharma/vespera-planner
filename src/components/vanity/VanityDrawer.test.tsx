import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStarterState, exportState, parseState, STORAGE_KEY } from '../../context/VesperaContext';
import { renderWithVespera } from '../../test/renderWithVespera';
import { VanityDrawer } from '../VanityDrawer';
import { createSeedState } from '../../test/ownerWeek';

const saved = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!);
const drawer = () => within(screen.getByRole('dialog', { name: 'Settings' }));
const renderDrawer = (state = createSeedState()) => renderWithVespera(<VanityDrawer open onClose={() => {}} />, state);

describe('Vanity Drawer: your day', () => {
  it('sets when the day starts and ends', () => {
    renderDrawer();
    fireEvent.change(drawer().getByLabelText('Day starts'), { target: { value: '06:30' } });
    fireEvent.change(drawer().getByLabelText('Day ends'), { target: { value: '22:00' } });
    expect(saved().settings).toMatchObject({ dayStart: 390, dayEnd: 1320 });
  });

  it('tunes or turns off the running-late nudge', async () => {
    const user = userEvent.setup();
    renderDrawer();
    expect(drawer().getByLabelText('Running-late nudge')).toHaveValue('10');
    await user.selectOptions(drawer().getByLabelText('Running-late nudge'), '0');
    expect(saved().settings.lateOfferMinutes).toBe(0);
  });
});

describe('Vanity Drawer: Gentle Start', () => {
  it('picks the timer length', async () => {
    const user = userEvent.setup();
    renderDrawer();
    const group = within(drawer().getByRole('radiogroup', { name: 'Gentle Start timer' }));
    expect(group.getByRole('radio', { name: '5 min' })).toHaveAttribute('aria-checked', 'true');
    await user.click(group.getByRole('radio', { name: '10 min' }));
    expect(saved().settings.focusMinutes).toBe(10);
  });

  it('edits the tiny-action pool', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(drawer().getByRole('button', { name: 'Remove Sit up and drink a full glass of water' }));
    await user.type(drawer().getByLabelText('New tiny action'), 'Light a candle{Enter}');
    expect(saved().settings.unstickActions).toContain('Light a candle');
    expect(saved().settings.unstickActions).not.toContain('Sit up and drink a full glass of water');
    expect(drawer().getByLabelText('New tiny action')).toHaveValue('');
  });
});

describe('Vanity Drawer: backup & reset', () => {
  afterEach(() => vi.restoreAllMocks());

  it('exports a JSON backup', async () => {
    const user = userEvent.setup();
    const create = vi.fn((_blob: Blob) => 'blob:vespera');
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderDrawer();
    await user.click(drawer().getByRole('button', { name: 'Export backup' }));
    expect(create).toHaveBeenCalled();
    expect(await create.mock.calls[0][0].text()).toContain('"version": 2');
  });

  it('imports a backup', async () => {
    const user = userEvent.setup();
    renderDrawer();
    const file = new File([exportState({ ...createSeedState(), notes: [] })], 'vespera.json', { type: 'application/json' });
    await user.upload(drawer().getByLabelText('Import backup'), file);
    expect(await screen.findByText('Backup restored')).toBeInTheDocument();
    expect(saved().notes).toEqual([]);
  });

  it('refuses a file that is not a backup, changing nothing', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.upload(drawer().getByLabelText('Import backup'), new File(['{"nope":1}'], 'x.json', { type: 'application/json' }));
    expect(await drawer().findByRole('alert')).toHaveTextContent(/isn’t a Vespera backup/);
    expect(saved().tasks).toHaveLength(9);
  });

  it('resets to the starter guide after confirming', async () => {
    const user = userEvent.setup();
    renderDrawer({ ...createSeedState(), tasks: [] });
    await user.click(drawer().getByRole('button', { name: 'Reset to the starter guide' }));
    await user.click(within(screen.getByRole('alertdialog', { name: 'Reset Vespera?' })).getByRole('button', { name: /Reset everything/ }));
    expect(saved().categories[0].id).toBe('tut-cat-start');
  });

  it('offers to clear the starter tutorial only while it is on the board', async () => {
    const user = userEvent.setup();
    renderDrawer(createStarterState('2026-11-12', 600));
    await user.click(drawer().getByRole('button', { name: /Clear starter tutorial/ }));
    await user.click(within(screen.getByRole('alertdialog', { name: 'Clear the starter tutorial?' })).getByRole('button', { name: /Clear it/ }));
    expect(saved().tasks).toEqual([]);
    expect(drawer().queryByRole('button', { name: /Clear starter tutorial/ })).not.toBeInTheDocument();
  });
});

describe('Vanity Drawer: guards', () => {
  it('does not save a day that ends before it starts', () => {
    renderDrawer();
    fireEvent.change(drawer().getByLabelText('Day ends'), { target: { value: '06:00' } });
    expect(drawer().getByText(/has to end after it starts/)).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY) ? parseState(saved())!.settings.dayEnd : 1380).toBe(1380);
  });

  it('ignores a tiny action that is already in the pool', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.type(drawer().getByLabelText('New tiny action'), 'sit up and drink a full glass of water');
    expect(drawer().getByRole('button', { name: 'Add action' })).toBeDisabled();
  });
});
