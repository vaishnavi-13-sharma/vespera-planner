import themeCss from '../index.css?raw';
import {
  catMood,
  contrastRatio,
  normalizeInitial,
  noteVariant,
  REALM_IDS,
  REALM_PALETTES,
  REALMS,
  sanitizeSanctuary,
  SEAL_COLORS,
  SEAL_EMBLEMS,
  skyPhase,
  winsThisWeek,
} from './sanctuary';
import { createBaseState, DEFAULT_SETTINGS } from './seed';
import { parseState } from './storage';
import type { OneOffBlock, Settings, VesperaState } from './types';

const TODAY = '2026-11-12';
const at = (h: number, m = 0) => h * 60 + m;

describe('normalizeInitial', () => {
  it('keeps the first A–Z letter, uppercased', () => {
    expect(normalizeInitial('n')).toBe('N');
    expect(normalizeInitial(' émile ')).toBe('E');
    expect(normalizeInitial('7 Quills')).toBe('Q');
  });

  it('falls back to V', () => {
    expect(normalizeInitial('')).toBe('V');
    expect(normalizeInitial('✨')).toBe('V');
    expect(normalizeInitial(7)).toBe('V');
    expect(normalizeInitial(undefined)).toBe('V');
  });
});

describe('sanitizeSanctuary', () => {
  const settings = (patch: Record<string, unknown>) => ({ ...DEFAULT_SETTINGS, ...patch }) as Settings;

  it('keeps valid choices', () => {
    const valid = settings({ realm: 'moonlit', skyAtmosphere: false, signet: { color: 'sage', emblem: 'initial', initial: 'Q' }, fastener: 'washi', sprigs: true, trinket: 'jar' });
    expect(sanitizeSanctuary(valid)).toEqual(valid);
  });

  it('replaces unknown or malformed values with the defaults', () => {
    const fixed = sanitizeSanctuary(settings({ realm: 'neon', skyAtmosphere: 'yes', fastener: 'glue', sprigs: 1, trinket: 'dragon', signet: { color: 'teal', emblem: 'skull', initial: '??' } }));
    expect(fixed.realm).toBe('velvet');
    expect(fixed.skyAtmosphere).toBe(true);
    expect(fixed.fastener).toBe('tacks');
    expect(fixed.sprigs).toBe(false);
    expect(fixed.trinket).toBe('cat');
    expect(fixed.signet).toEqual({ color: 'burgundy', emblem: 'moon', initial: 'V' });
  });

  it('merges a partial signet with the defaults', () => {
    expect(sanitizeSanctuary(settings({ signet: { color: 'gold' } })).signet).toEqual({ color: 'gold', emblem: 'moon', initial: 'V' });
    expect(sanitizeSanctuary(settings({ signet: 'gold' })).signet).toEqual(DEFAULT_SETTINGS.signet);
  });

  it('is applied when a saved board is loaded', () => {
    const old = createBaseState(TODAY) as unknown as { settings: Record<string, unknown> };
    for (const k of ['realm', 'skyAtmosphere', 'signet', 'fastener', 'sprigs', 'trinket']) delete old.settings[k];
    old.settings.realm = 'disco';
    const loaded = parseState(JSON.parse(JSON.stringify(old)))!;
    expect(loaded.settings).toMatchObject({ realm: 'velvet', skyAtmosphere: true, fastener: 'tacks', sprigs: false, trinket: 'cat', signet: DEFAULT_SETTINGS.signet });
  });
});

describe('catalogues', () => {
  it('names four realms, five seal colors and seven emblems', () => {
    expect(REALM_IDS).toEqual(['velvet', 'sunlit', 'moonlit', 'vintage']);
    expect(REALMS.map((r) => r.name)).toEqual(['Velvet Twilight', 'Sunlit Conservatory', 'Starlit Ballroom', 'Vintage Vanity']);
    expect(REALMS.filter((r) => r.light).map((r) => r.id)).toEqual(['sunlit']);
    expect(SEAL_COLORS.map((c) => c.name)).toEqual(['Burgundy', 'Gold', 'Rose', 'Sage', 'Moonstone']);
    expect(SEAL_EMBLEMS.map((e) => e.name)).toEqual(['Crescent Moon', 'Rose', 'Crown', 'Sword', 'Star', 'Cat', 'Initial']);
  });
});

describe('realm palettes', () => {
  it('measures contrast', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it.each(REALM_IDS)('%s keeps text readable', (id) => {
    const p = REALM_PALETTES[id];
    expect(contrastRatio(p.vanilla, p.espresso)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.vanilla, p.mahogany)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.taupe, p.mahogany)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.ink, p.parchment)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.gold, p.mahogany)).toBeGreaterThanOrEqual(3);
  });

  it('Velvet Twilight is exactly today’s look', () => {
    for (const [token, value] of Object.entries(REALM_PALETTES.velvet)) {
      if (token === 'shadow') continue;
      const match = themeCss.match(new RegExp(`--color-${token}:\\s*(#[0-9a-fA-F]{6})`));
      expect(match?.[1].toLowerCase(), token).toBe(value.toLowerCase());
    }
  });
});

describe('skyPhase', () => {
  it('follows a 07:00–23:00 day', () => {
    const p = (h: number, m = 0) => skyPhase(at(h, m), at(7), at(23));
    expect([p(5, 59), p(6), p(8, 29), p(8, 30), p(20, 59), p(21), p(22, 59), p(23), p(2)]).toEqual([
      'night', 'dawn', 'dawn', 'day', 'day', 'dusk', 'dusk', 'night', 'night',
    ]);
  });

  it('never lets dusk start before dawn ends on a short day', () => {
    const p = (h: number, m = 0) => skyPhase(at(h, m), at(10), at(11));
    expect(p(10, 59)).toBe('dawn');
    expect(p(11)).toBe('night');
  });
});

describe('winsThisWeek', () => {
  it('counts quests, Gentle Starts and cards since Monday, plus one per day with focus', () => {
    const activity: VesperaState['activity'] = {
      '2026-11-08': { quests: 5, spells: 0, focusMinutes: 0, cards: 0 },
      '2026-11-09': { quests: 2, spells: 1, focusMinutes: 25, cards: 0 },
      '2026-11-12': { quests: 0, spells: 0, focusMinutes: 0, cards: 1 },
    };
    expect(winsThisWeek({ activity }, TODAY)).toBe(5);
    expect(winsThisWeek({ activity: {} }, TODAY)).toBe(0);
  });
});

describe('catMood', () => {
  const study: OneOffBlock = { id: 'b-study', date: TODAY, title: 'Study', kind: 'focus', start: at(10), end: at(11) };
  const board = (extra: Partial<VesperaState> = {}): VesperaState => ({ ...createBaseState(TODAY), blocks: [study], ...extra });
  const focusSession: VesperaState['focusSession'] = {
    title: 'Study', date: TODAY, occurrenceKey: 'b-study', rhythm: 'whole', sound: 'off', startedAt: 0, totalMinutes: 60, pausedAt: null, pausedMs: 0,
  };

  it('naps, wakes for a block, and wears spectacles to focus', () => {
    expect(catMood(board(), TODAY, at(14))).toBe('nap');
    expect(catMood(board(), TODAY, at(10, 30))).toBe('awake');
    expect(catMood(board({ focusSession }), TODAY, at(14))).toBe('focus');
  });

  it('always naps at night unless focusing', () => {
    const late: OneOffBlock = { ...study, start: at(23, 15), end: at(23, 45) };
    expect(catMood(board({ blocks: [late] }), TODAY, at(23, 30))).toBe('nap');
    expect(catMood(board({ blocks: [late], focusSession }), TODAY, at(23, 30))).toBe('focus');
  });
});

describe('noteVariant', () => {
  it('is stable per note and varied across notes', () => {
    expect(noteVariant('note-abc')).toEqual(noteVariant('note-abc'));
    const variants = Array.from({ length: 30 }, (_, i) => noteVariant(`note-${i}`));
    for (const v of variants) {
      expect(v.tilt).toBeGreaterThanOrEqual(-4);
      expect(v.tilt).toBeLessThanOrEqual(4);
    }
    expect(new Set(variants.map((v) => v.tape))).toEqual(new Set(['stripes', 'dots', 'plain']));
    const sprigs = variants.filter((v) => v.sprig).length;
    expect(sprigs).toBeGreaterThan(0);
    expect(sprigs).toBeLessThan(30);
  });
});
