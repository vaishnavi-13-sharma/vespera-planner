import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createBaseState, useVespera, type VesperaState } from '../../context/VesperaContext';
import { renderWithVespera } from '../../test/renderWithVespera';
import { HeaderSky, SkyGlyph } from './HeaderSky';
import { RealmSection } from './RealmSection';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sanctuaryCss = readFileSync(resolve(process.cwd(), 'src/components/sanctuary/sanctuary.css'), 'utf8');

function Probe() {
  const { state } = useVespera();
  return <output data-testid="probe">{`${state.settings.realm} ${state.settings.skyAtmosphere}`}</output>;
}

function board(patch: Partial<VesperaState['settings']> = {}): VesperaState {
  const s = createBaseState('2026-11-12');
  return { ...s, settings: { ...s.settings, ...patch } };
}

describe('RealmSection', () => {
  it('offers the four realms, marks the current one, and switches instantly', async () => {
    const user = userEvent.setup();
    renderWithVespera(<><RealmSection /><Probe /></>, board());
    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(within(group).getByRole('radio', { name: /Velvet Twilight/ })).toHaveAttribute('aria-checked', 'true');
    for (const name of [/Sunlit Conservatory/, /Starlit Ballroom/, /Vintage Vanity/]) {
      expect(within(group).getByRole('radio', { name })).toHaveAttribute('aria-checked', 'false');
    }
    await user.click(within(group).getByRole('radio', { name: /Sunlit Conservatory/ }));
    expect(screen.getByTestId('probe')).toHaveTextContent('sunlit true');
    expect(within(group).getByRole('radio', { name: /Sunlit Conservatory/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('walks the realms with the arrow keys, keeping one tab stop', async () => {
    const user = userEvent.setup();
    renderWithVespera(<><RealmSection /><Probe /></>, board({ realm: 'vintage' }));
    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    const vintage = within(group).getByRole('radio', { name: /Vintage Vanity/ });
    expect(within(group).getAllByRole('radio').filter((r) => r.tabIndex === 0)).toEqual([vintage]);
    vintage.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('probe')).toHaveTextContent('velvet true');
    expect(within(group).getByRole('radio', { name: /Velvet Twilight/ })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByTestId('probe')).toHaveTextContent('vintage true');
  });

  it('toggles the time-of-day sky', async () => {
    const user = userEvent.setup();
    renderWithVespera(<><RealmSection /><Probe /></>, board());
    const sky = screen.getByRole('switch', { name: 'Sky follows the time of day' });
    expect(sky).toHaveAttribute('aria-checked', 'true');
    await user.click(sky);
    expect(screen.getByTestId('probe')).toHaveTextContent('velvet false');
  });
});

describe('HeaderSky', () => {
  afterEach(() => vi.useRealTimers());

  const phaseAt = (h: number, m: number, patch = {}) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, h, m));
    const { container, unmount } = renderWithVespera(<HeaderSky />, board(patch));
    const el = container.querySelector('[data-sky-phase]');
    const phase = el?.getAttribute('data-sky-phase') ?? null;
    if (el) expect(el).toHaveAttribute('aria-hidden', 'true');
    unmount();
    return phase;
  };

  it('follows the clock using the day start and end', () => {
    expect(phaseAt(6, 30)).toBe('dawn');
    expect(phaseAt(12, 0)).toBe('day');
    expect(phaseAt(21, 30)).toBe('dusk');
    expect(phaseAt(23, 30)).toBe('night');
    expect(phaseAt(9, 0, { dayStart: 10 * 60 })).toBe('dawn');
  });

  it('renders nothing when the sky is turned off', () => {
    expect(phaseAt(12, 0, { skyAtmosphere: false })).toBeNull();
  });

  it('keeps no moon or sun floating in the corner by the header controls', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 23, 30));
    const { container } = renderWithVespera(<HeaderSky />, board());
    expect(container.querySelector('[data-sky-phase="night"]')).not.toBeNull();
    expect(container.querySelector('.sky-moon')).toBeNull();
  });

  it('keeps the daytime sky clean: no clouds, no pale glow or blur behind the header controls', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, 12, 0));
    const { container } = renderWithVespera(<HeaderSky />, board());
    expect(container.querySelector('[data-sky-phase="day"]')).not.toBeNull();
    expect(container.querySelector('.sky-cloud')).toBeNull();
    const dayRule = /\.sky-day\s*\{([^}]*)\}/.exec(sanctuaryCss)?.[1] ?? '';
    expect(dayRule).not.toBe('');
    expect(dayRule).not.toMatch(/sky-light|vanilla|white|radial-gradient|blur/);
    expect(sanctuaryCss).not.toMatch(/sky-cloud/);
  });
});

describe('SkyGlyph', () => {
  afterEach(() => vi.useRealTimers());

  const glyphAt = (h: number, m: number, patch = {}) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 12, h, m));
    const { container, unmount } = renderWithVespera(<SkyGlyph />, board(patch));
    const el = container.querySelector('[data-sky-glyph]')!;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    const result = `${el.getAttribute('data-sky-glyph')}: ${el.getAttribute('title')}`;
    unmount();
    return result;
  };

  it('shows a small decorative glyph for the time of day, with a title', () => {
    expect(glyphAt(6, 30)).toBe('dawn: Sunrise');
    expect(glyphAt(12, 0)).toBe('day: Daytime');
    expect(glyphAt(21, 30)).toBe('dusk: Sunset');
    expect(glyphAt(23, 30)).toBe('night: Night');
  });

  it('stays even when the sky is turned off', () => {
    expect(glyphAt(12, 0, { skyAtmosphere: false })).toBe('day: Daytime');
  });
});
