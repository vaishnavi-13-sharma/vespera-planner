// Personal Sanctuary (Build E): realms, the wax-seal signet, fasteners, the desk trinket and the header sky.
import { mondayOf } from './delight';
import { addDays } from './dates';
import { occurrencesForDate } from './recurrence';
import { DEFAULT_SETTINGS } from './seed';
import { currentOccurrence } from './selectors';
import type { CatMood, DateKey, Fastener, RealmId, SealColor, SealEmblem, Settings, Signet, SkyPhase, TrinketKind, VesperaState } from './types';

export const REALM_IDS: RealmId[] = ['velvet', 'sunlit', 'moonlit', 'vintage'];

export interface RealmInfo {
  id: RealmId;
  name: string;
  tagline: string;
  light: boolean;
}

export const REALMS: RealmInfo[] = [
  { id: 'velvet', name: 'Velvet Twilight', tagline: 'Dark espresso brown with warm gold. The original.', light: false },
  { id: 'sunlit', name: 'Sunlit Conservatory', tagline: 'Light cream with fern green and terracotta.', light: true },
  { id: 'moonlit', name: 'Starlit Ballroom', tagline: 'Deep midnight blue with silver and lilac.', light: false },
  { id: 'vintage', name: 'Vintage Vanity', tagline: 'Dusty rose with champagne gold.', light: false },
];

/** Token names stay the same in every realm; they name a role (see CLAUDE.md). */
export type PaletteToken = 'espresso' | 'mahogany' | 'parchment' | 'ink' | 'vanilla' | 'taupe' | 'burgundy' | 'rose' | 'gold' | 'sage' | 'shadow';

/** Paper notes stay paper in every realm. */
const PAPER = { parchment: '#f7efe5', ink: '#2b1b19' } as const;

export const REALM_PALETTES: Record<RealmId, Record<PaletteToken, string>> = {
  velvet: {
    espresso: '#1a1110', mahogany: '#261817', vanilla: '#f7efe5', taupe: '#c4aba6',
    burgundy: '#6e1e2a', rose: '#d9a7b0', gold: '#c8a96e', sage: '#7a9a8b', shadow: '#000000', ...PAPER,
  },
  sunlit: {
    espresso: '#f3eee0', mahogany: '#fbf8ef', vanilla: '#26352a', taupe: '#5e6b5a',
    burgundy: '#a4513b', rose: '#a85a4a', gold: '#8c6a22', sage: '#3f7352', shadow: '#5a4632', ...PAPER,
  },
  moonlit: {
    espresso: '#0e1520', mahogany: '#16212f', vanilla: '#e6eef2', taupe: '#a3b3bf',
    burgundy: '#4b2a5c', rose: '#c9a9dc', gold: '#d6c58e', sage: '#6db3a3', shadow: '#000000', ...PAPER,
  },
  vintage: {
    espresso: '#2a1d22', mahogany: '#3a2a30', vanilla: '#f7e9e6', taupe: '#cdb2b5',
    burgundy: '#8c3b4e', rose: '#ebb3bf', gold: '#e2c79a', sage: '#9db49a', shadow: '#000000', ...PAPER,
  },
};

/** Seal colors are real wax: the same in every realm. */
export const SEAL_COLORS: { id: SealColor; name: string; wax: string; impression: string }[] = [
  { id: 'burgundy', name: 'Burgundy', wax: '#7a1f2e', impression: '#3e0d16' },
  { id: 'gold', name: 'Gold', wax: '#c9a24e', impression: '#7a5a1c' },
  { id: 'rose', name: 'Rose', wax: '#c97b8a', impression: '#7a3443' },
  { id: 'sage', name: 'Sage', wax: '#6f8f7c', impression: '#34503f' },
  { id: 'moonstone', name: 'Moonstone', wax: '#a9b6c6', impression: '#56647a' },
];

export const SEAL_EMBLEMS: { id: SealEmblem; name: string }[] = [
  { id: 'moon', name: 'Crescent Moon' },
  { id: 'rose', name: 'Rose' },
  { id: 'crown', name: 'Crown' },
  { id: 'sword', name: 'Sword' },
  { id: 'star', name: 'Star' },
  { id: 'cat', name: 'Cat' },
  { id: 'initial', name: 'Initial' },
];

const FASTENERS: Fastener[] = ['tacks', 'bows', 'washi'];
const TRINKETS: TrinketKind[] = ['cat', 'vial', 'jar', 'none'];

/** The first A–Z letter (accents stripped), uppercased; 'V' when there is none. */
export function normalizeInitial(raw: unknown): string {
  if (typeof raw !== 'string') return 'V';
  const letter = raw.normalize('NFD').toUpperCase().match(/[A-Z]/);
  return letter ? letter[0] : 'V';
}

const oneOf = <T>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback);

/** Fix any unknown or malformed Sanctuary setting (e.g. from an old or hand-edited save). */
export function sanitizeSanctuary(settings: Settings): Settings {
  const d = DEFAULT_SETTINGS;
  const raw = (typeof settings.signet === 'object' && settings.signet !== null ? settings.signet : {}) as Partial<Signet>;
  const signet: Signet = {
    color: oneOf(raw.color, SEAL_COLORS.map((c) => c.id), d.signet.color),
    emblem: oneOf(raw.emblem, SEAL_EMBLEMS.map((e) => e.id), d.signet.emblem),
    initial: typeof raw.initial === 'string' && /^[A-Z]$/.test(raw.initial) ? raw.initial : normalizeInitial(raw.initial),
  };
  return {
    ...settings,
    realm: oneOf(settings.realm, REALM_IDS, d.realm),
    skyAtmosphere: typeof settings.skyAtmosphere === 'boolean' ? settings.skyAtmosphere : d.skyAtmosphere,
    signet,
    fastener: oneOf(settings.fastener, FASTENERS, d.fastener),
    sprigs: typeof settings.sprigs === 'boolean' ? settings.sprigs : d.sprigs,
    trinket: oneOf(settings.trinket, TRINKETS, d.trinket),
  };
}

/** Dawn runs from an hour before the day starts to 90 minutes after; dusk is the last two hours. */
export function skyPhase(nowMinutes: number, dayStart: number, dayEnd: number): SkyPhase {
  const dawnStart = dayStart - 60;
  const dawnEnd = Math.min(dayStart + 90, dayEnd);
  const duskStart = Math.max(dawnEnd, dayEnd - 120);
  if (nowMinutes >= dawnStart && nowMinutes < dawnEnd) return 'dawn';
  if (nowMinutes >= dawnEnd && nowMinutes < duskStart) return 'day';
  if (nowMinutes >= duskStart && nowMinutes < dayEnd) return 'dusk';
  return 'night';
}

/** Small wins since Monday: quests, Gentle Starts (the stored `spells` count) and cards, plus one for each day with any focus. */
export function winsThisWeek(state: Pick<VesperaState, 'activity'>, today: DateKey): number {
  let wins = 0;
  for (let date = mondayOf(today); date <= today; date = addDays(date, 1)) {
    const day = state.activity[date];
    if (day) wins += day.quests + day.spells + day.cards + (day.focusMinutes > 0 ? 1 : 0);
  }
  return wins;
}

export function catMood(state: VesperaState, today: DateKey, nowMinutes: number): CatMood {
  if (state.focusSession) return 'focus';
  if (skyPhase(nowMinutes, state.settings.dayStart, state.settings.dayEnd) === 'night') return 'nap';
  return currentOccurrence(occurrencesForDate(state, today), nowMinutes) ? 'awake' : 'nap';
}

/** FNV-1a: a small, stable hash so each note keeps its look between visits. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const TAPES = ['stripes', 'dots', 'plain'] as const;

export function noteVariant(noteId: string): { tilt: number; tape: (typeof TAPES)[number]; sprig: boolean } {
  const h = hash(noteId);
  return { tilt: (h % 81) / 10 - 4, tape: TAPES[(h >>> 8) % 3], sprig: (h >>> 16) % 3 === 0 };
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two '#rrggbb' colors. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
