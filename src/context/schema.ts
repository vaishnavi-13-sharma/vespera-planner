// Schema versioning and the stored (sparse) board format (Wave 3).
// Every migration is strictly additive with safe defaults, so an older board always loads in newer code.
// Newer boards are never written by older code: sync pauses (client) and the database refuses downgrades (server).
import type { VesperaState } from './types';

/** The board shape this code writes. Bump it with a new migration in `MIGRATIONS` (see storage.ts). */
export const SCHEMA_VERSION = 3;
/** Boards saved before `schemaVersion` existed. */
export const LEGACY_SCHEMA_VERSION = 2;

/** The schema version a stored board claims: a whole number ≥ 2, or 2 for older and unmarked boards. */
export function schemaVersionOf(raw: unknown): number {
  const v = (raw as { schemaVersion?: unknown } | null)?.schemaVersion;
  return typeof v === 'number' && Number.isInteger(v) && v >= LEGACY_SCHEMA_VERSION ? v : LEGACY_SCHEMA_VERSION;
}

/** True when a stored board was written by newer code than this, so this device must not write over it. */
export function isFromTheFuture(raw: unknown): boolean {
  return schemaVersionOf(raw) > SCHEMA_VERSION;
}

/* ---------- the stored (sparse) format ---------- */

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
/** Stored values are plain JSON, so equal JSON text means equal values (a key-order mismatch only keeps a field). */
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * What a left-out setting means in this format. Frozen on purpose: it is part of the stored
 * format, so changing a default in seed.ts later must not change what an older save meant.
 */
const STORED_SETTINGS: Readonly<Obj> = {
  dayStart: 420,
  dayEnd: 1380,
  lateOfferMinutes: 10,
  focusMinutes: 5,
  unstickActions: [
    'Sit up and drink a full glass of water',
    'Open the window and take five slow breaths',
    'Put on real clothes (shoes optional)',
    'Clear just the top of your desk',
    'Open the doc you’re avoiding and read only the first paragraph',
    'Flip through three vocab cards, nothing more',
  ],
  sparkles: true,
  sounds: true,
  volume: 0.5,
  seasonal: true,
  weeklySummary: true,
  focusRhythm: 'pomodoro25',
  focusSound: 'rain',
  realm: 'velvet',
  skyAtmosphere: true,
  signet: { color: 'burgundy', emblem: 'moon', initial: 'V' },
  fastener: 'tacks',
  sprigs: false,
  trinket: 'cat',
};

/** Board fields left out when they hold these values. */
const STORED_DEFAULTS: Readonly<Obj> = {
  focusVeil: null,
  notice: null,
  captureLog: [],
  activity: {},
  focusSession: null,
  lastSummaryWeek: null,
  chronicleArchive: [],
  activityArchive: [],
  assistant: { panelOpen: false },
};

/**
 * Required item fields left out when they hold these values. Optional fields (dueDate, review,
 * timeLabel, begun, overrides…) are never left out: their absence already means "not set".
 * The lists themselves and `exceptions` are always stored, even empty, so a reader without
 * `fromStored` (code from before Wave 3) still recognises and reads the board.
 */
const ITEM_DEFAULTS: Readonly<Record<string, Readonly<Obj>>> = {
  blocks: { start: null, end: null },
  series: { start: null, end: null },
  categories: { archived: false },
  tasks: { done: false },
  chronicle: { done: false },
  noteTags: { vocab: false },
};
const DAY_DEFAULTS: Readonly<Obj> = { quests: 0, spells: 0, focusMinutes: 0, cards: 0 };

/** `o` without the keys whose value equals `defaults`. */
function omitDefaults(o: Obj, defaults: Readonly<Obj>): Obj {
  return Object.fromEntries(Object.entries(o).filter(([k, v]) => !(Object.hasOwn(defaults, k) && same(v, defaults[k]))));
}

/** `o` with every key it lacks filled from (a fresh copy of) `defaults`. */
function withDefaults(o: Obj, defaults: Readonly<Obj>): Obj {
  const out = { ...o };
  for (const [k, v] of Object.entries(defaults)) if (!Object.hasOwn(out, k)) out[k] = structuredClone(v);
  return out;
}

const mapValues = (o: Obj, f: (v: unknown) => unknown): Obj => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));

/**
 * The board as stored in localStorage, backups and `user_states.state`: defaults and empty fields
 * left out, nothing renamed or encoded. `fromStored(toStored(s))` always equals `s`.
 */
export function toStored(state: VesperaState): unknown {
  const { version, schemaVersion, ...rest } = state as unknown as Obj;
  const out: Obj = { version, schemaVersion, ...omitDefaults(rest, STORED_DEFAULTS) };
  for (const [list, defaults] of Object.entries(ITEM_DEFAULTS)) {
    out[list] = (out[list] as Obj[]).map((item) => omitDefaults(item, defaults));
  }
  if (isObj(out.activity)) out.activity = mapValues(out.activity, (day) => omitDefaults(day as Obj, DAY_DEFAULTS));
  const settings = omitDefaults(state.settings as unknown as Obj, STORED_SETTINGS);
  if (Object.keys(settings).length) out.settings = settings;
  else delete out.settings;
  return out;
}

/**
 * Fills in what `toStored` left out. Accepts full boards too (older saves and backups), and leaves
 * anything odd as it is for the sanitizer to judge: it never throws and never invents a list.
 */
export function fromStored(stored: unknown): unknown {
  if (!isObj(stored)) return stored;
  const out = withDefaults(stored, STORED_DEFAULTS);
  if (!Object.hasOwn(stored, 'settings')) out.settings = structuredClone(STORED_SETTINGS);
  else if (isObj(stored.settings)) out.settings = withDefaults(stored.settings, STORED_SETTINGS);
  for (const [list, defaults] of Object.entries(ITEM_DEFAULTS)) {
    const items = out[list];
    if (Array.isArray(items)) out[list] = items.map((item) => (isObj(item) ? withDefaults(item, defaults) : item));
  }
  if (isObj(out.activity)) out.activity = mapValues(out.activity, (day) => (isObj(day) ? withDefaults(day, DAY_DEFAULTS) : day));
  return out;
}
