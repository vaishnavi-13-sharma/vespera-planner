// Paints the chosen Realm onto the page by swapping the values of the theme's color tokens.
import { REALM_PALETTES, REALMS, type PaletteToken } from '../context/sanctuary';
import type { RealmId } from '../context/types';

/** Read by public/realm-boot.js before first paint, so a light realm never flashes dark. */
export const REALM_CACHE_KEY = 'vespera_realm';

const cssVar = (token: PaletteToken) => (token === 'shadow' ? '--shadow-color' : `--color-${token}`);

export function applyRealm(realm: RealmId, root: HTMLElement = document.documentElement): void {
  const palette = REALM_PALETTES[realm] ?? REALM_PALETTES.velvet;
  const scheme = REALMS.find((r) => r.id === realm)?.light ? 'light' : 'dark';
  const vars: Record<string, string> = {};
  for (const [token, value] of Object.entries(palette) as [PaletteToken, string][]) {
    vars[cssVar(token)] = value;
    root.style.setProperty(cssVar(token), value);
  }
  root.dataset.realm = realm;
  root.style.colorScheme = scheme;
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', palette.espresso);
  // iPhone status bar: dark text on a light realm, light text over a dark one.
  document
    .querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]')
    ?.setAttribute('content', scheme === 'light' ? 'default' : 'black-translucent');
  try {
    localStorage.setItem(REALM_CACHE_KEY, JSON.stringify({ realm, scheme, vars }));
  } catch {
    // Storage blocked: the realm still applies, it just paints a moment later on the next load.
  }
}
