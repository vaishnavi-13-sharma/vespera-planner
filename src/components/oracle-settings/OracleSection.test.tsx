import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createBaseState } from '../../context/VesperaContext';
import { renderWithVespera } from '../../test/renderWithVespera';
import { OracleSection } from './OracleSection';

/** Words only a developer would know: never shown to the person using Vespera. */
const DEVELOPER_WORDS = /VESPERA_CLAUDE_BRIDGE|npm run dev|\bbridge\b|\bCLI\b/i;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('not on this computer')));
});
afterEach(() => vi.unstubAllGlobals());

it('is called Quick Scribe, and speaks no developer words, even with the key drawer open', async () => {
  const user = userEvent.setup();
  renderWithVespera(<OracleSection />, createBaseState('2026-11-12'));
  expect(screen.getByRole('heading', { name: 'Quick Scribe' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Use your own AI key (optional)' }));
  expect(document.body.textContent).not.toMatch(DEVELOPER_WORDS);
  expect(document.body.textContent).not.toMatch(/oracle/i);
  expect(screen.queryByRole('button', { name: 'Advanced' })).not.toBeInTheDocument();
});

it('says it is free and works offline, and keeps the key in a closed drawer with one plain sentence', async () => {
  const user = userEvent.setup();
  renderWithVespera(<OracleSection />, createBaseState('2026-11-12'));
  expect(screen.getByText('Free and works offline').closest('[role="status"]')).toBeInTheDocument();
  expect(screen.queryByLabelText('Your Anthropic key')).not.toBeInTheDocument();

  const toggle = screen.getByRole('button', { name: 'Use your own AI key (optional)' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText(/your own Anthropic account pays/)).toHaveTextContent(/stays on this device/);

  await user.type(screen.getByLabelText('Your Anthropic key'), 'sk-ant-test');
  await user.click(screen.getByRole('button', { name: 'Save key' }));
  expect(await screen.findByText('Using your key')).toBeInTheDocument();
  expect(localStorage.getItem('vespera_oracle_key')).toBe('sk-ant-test');
  await user.click(screen.getByRole('button', { name: 'Remove key' }));
  expect(await screen.findByText('Free and works offline')).toBeInTheDocument();
  expect(localStorage.getItem('vespera_oracle_key')).toBeNull();
});

it('says "Connected on this computer" when the Scribe can ask this computer', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));
  renderWithVespera(<OracleSection />, createBaseState('2026-11-12'));
  expect(await screen.findByText('Connected on this computer')).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(DEVELOPER_WORDS);
});
