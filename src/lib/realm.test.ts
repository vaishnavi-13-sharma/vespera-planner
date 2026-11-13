import { REALM_PALETTES } from '../context/sanctuary';
import { applyRealm, REALM_CACHE_KEY } from './realm';

describe('applyRealm', () => {
  let meta: HTMLMetaElement;
  let bar: HTMLMetaElement;

  beforeEach(() => {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#1A1110';
    document.head.append(meta);
    bar = document.createElement('meta');
    bar.name = 'apple-mobile-web-app-status-bar-style';
    bar.content = 'black-translucent';
    document.head.append(bar);
  });

  afterEach(() => {
    meta.remove();
    bar.remove();
    applyRealm('velvet');
    localStorage.clear();
  });

  it('paints the light Sunlit Conservatory onto the page', () => {
    applyRealm('sunlit');
    const root = document.documentElement;
    expect(root.dataset.realm).toBe('sunlit');
    expect(root.style.getPropertyValue('--color-espresso')).toBe(REALM_PALETTES.sunlit.espresso);
    expect(root.style.getPropertyValue('--color-gold')).toBe(REALM_PALETTES.sunlit.gold);
    expect(root.style.getPropertyValue('--shadow-color')).toBe(REALM_PALETTES.sunlit.shadow);
    expect(root.style.colorScheme).toBe('light');
    expect(meta.content).toBe(REALM_PALETTES.sunlit.espresso);
    expect(bar.content).toBe('default');
  });

  it('switches back to a dark realm', () => {
    applyRealm('sunlit');
    applyRealm('moonlit');
    const root = document.documentElement;
    expect(root.dataset.realm).toBe('moonlit');
    expect(root.style.getPropertyValue('--color-vanilla')).toBe(REALM_PALETTES.moonlit.vanilla);
    expect(root.style.colorScheme).toBe('dark');
    expect(meta.content).toBe(REALM_PALETTES.moonlit.espresso);
    expect(bar.content).toBe('black-translucent');
  });

  it('remembers the realm on this device so the next load paints it before React starts', () => {
    applyRealm('vintage');
    const cached = JSON.parse(localStorage.getItem(REALM_CACHE_KEY)!);
    expect(cached.realm).toBe('vintage');
    expect(cached.scheme).toBe('dark');
    expect(cached.vars['--color-mahogany']).toBe(REALM_PALETTES.vintage.mahogany);
  });
});
