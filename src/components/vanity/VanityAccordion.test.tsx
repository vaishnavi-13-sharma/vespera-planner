import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createStarterState } from '../../context/VesperaContext';
import { SyncProvider } from '../../sync/SyncProvider';
import { createFakeBackend, ME } from '../../test/fakeBackend';
import { renderWithVespera } from '../../test/renderWithVespera';
import { ToastProvider } from '../ui/Toast';
import { VanityDrawer } from '../VanityDrawer';

const drawer = () => within(screen.getByRole('dialog', { name: 'Settings' }));
const header = (title: string) => drawer().getByRole('button', { name: title });
const renderDrawer = () => renderWithVespera(<VanityDrawer open onClose={() => {}} />, createStarterState('2026-11-12', 600));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});
afterEach(() => vi.unstubAllGlobals());

const SECTIONS: [title: string, summary: string][] = [
  ['Theme', 'Velvet Twilight · sky on'],
  ['Wax seal', 'Burgundy · Crescent Moon'],
  ['Pinboard', 'Brass tacks'],
  ['Desk trinket', 'Castle kitten'],
  ['Quick Scribe', 'Free and offline'],
  ['Your day', '7:00 AM – 11:00 PM'],
  ['Gentle Start', '5-minute timer'],
  ['Effects & sounds', 'Sparkles, sounds on'],
  ['Backup & reset', 'Export or import'],
];

describe('Vanity Drawer accordion', () => {
  it('starts with every section folded, each showing its title and a one-line summary', () => {
    renderDrawer();
    for (const [title, summary] of SECTIONS) {
      const button = header(title);
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAccessibleDescription(summary);
      const panel = document.getElementById(button.getAttribute('aria-controls')!)!;
      expect(panel).toHaveAttribute('role', 'region');
      expect(panel).toHaveAccessibleName(title);
      expect(panel).toHaveAttribute('inert');
    }
  });

  it('opens one section at a time', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(header('Theme'));
    expect(header('Theme')).toHaveAttribute('aria-expanded', 'true');
    expect(drawer().getByRole('region', { name: 'Theme' })).not.toHaveAttribute('inert');

    await user.click(header('Wax seal'));
    expect(header('Wax seal')).toHaveAttribute('aria-expanded', 'true');
    expect(header('Theme')).toHaveAttribute('aria-expanded', 'false');
    expect(drawer().getAllByRole('button', { expanded: true }).filter((b) => b.hasAttribute('aria-controls'))).toHaveLength(1);

    await user.click(header('Wax seal'));
    expect(header('Wax seal')).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles with Enter and Space', async () => {
    const user = userEvent.setup();
    renderDrawer();
    header('Effects & sounds').focus();
    await user.keyboard('{Enter}');
    expect(header('Effects & sounds')).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard(' ');
    expect(header('Effects & sounds')).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps each summary current', async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(header('Theme'));
    await user.click(drawer().getByRole('radio', { name: /Sunlit Conservatory/ }));
    await user.click(drawer().getByRole('switch', { name: /sky/i }));
    expect(header('Theme')).toHaveAccessibleDescription('Sunlit Conservatory · sky off');

    await user.click(header('Desk trinket'));
    await user.click(drawer().getByRole('radio', { name: /Firefly jar/ }));
    expect(header('Desk trinket')).toHaveAccessibleDescription('Firefly jar');

    await user.click(header('Effects & sounds'));
    await user.click(drawer().getByRole('switch', { name: /Sounds/ }));
    expect(header('Effects & sounds')).toHaveAccessibleDescription('Sparkles on, sounds off');
  });

  it('shows who is signed in on the Account header', async () => {
    const fake = createFakeBackend({ user: ME });
    render(
      <ToastProvider>
        <SyncProvider backend={fake.backend}>
          <VanityDrawer open onClose={() => {}} />
        </SyncProvider>
      </ToastProvider>,
    );
    const account = await screen.findByRole('button', { name: 'Account' });
    expect(account).toHaveAccessibleDescription('Signed in as me@example.com');
    expect(account).toHaveAttribute('aria-expanded', 'false');
  });
});
