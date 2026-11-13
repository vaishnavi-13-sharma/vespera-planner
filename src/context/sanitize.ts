// Deep checks for a board that comes from outside the running app: a save, a backup file or a
// cloud row. Every item is rebuilt field by field from what it should be. A bad optional field is
// dropped, a bad setting falls back to its default, and an item missing what it can't live without
// (an id, a title, a date) is dropped and counted, so one odd item never costs the whole board.
import { ARCHIVE_TITLES_MAX, byMonth, clipTitle, count, isMonthKey, mergeActivityMonths, mergeChronicleMonths } from './compact';
import { isDateKey, weekdayOf } from './dates';
import { REVIEW_STEPS } from './delight';
import { sanitizeSanctuary } from './sanctuary';
import { createBaseState, DEFAULT_SETTINGS, DEFAULT_UNSTICK_ACTIONS } from './seed';
import type {
  Accent,
  ActivityMonth,
  AmbientSound,
  BlockFields,
  BlockKind,
  Category,
  ChronicleEntry,
  ChronicleMonth,
  DateKey,
  DayActivity,
  FocusRhythm,
  FocusSession,
  Note,
  NoteTag,
  OneOffBlock,
  RepeatRule,
  Series,
  SeriesException,
  Settings,
  Task,
  VesperaState,
} from './types';

type Obj = Record<string, unknown>;

const ACCENTS: readonly Accent[] = ['gold', 'burgundy', 'rose', 'sage', 'taupe'];
const KINDS: readonly BlockKind[] = ['anchor', 'focus', 'flexible'];
const RHYTHMS: readonly FocusRhythm[] = ['whole', 'pomodoro25', 'pomodoro50'];
const SOUNDS: readonly AmbientSound[] = ['rain', 'fire', 'off'];
const LATE_OFFERS: readonly Settings['lateOfferMinutes'][] = [0, 5, 10, 15];
const FOCUS_MINUTES: readonly Settings['focusMinutes'][] = [2, 5, 10];
const INTERVALS = [1, 2, 3, 4] as const;
const DAY = 24 * 60;

/** Caps keep a giant string from freezing every render; no real title or note comes close. */
const ID_MAX = 200;
const TEXT_MAX = 1_000;
const LONG_MAX = 20_000;
const EMOJI_MAX = 16;

const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const oneOf = <T>(x: unknown, allowed: readonly T[]): x is T => allowed.includes(x as T);
const isInt = (x: unknown, min: number, max: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;

export { isDateKey };

const isId = (x: unknown): x is string => typeof x === 'string' && x.length > 0 && x.length <= ID_MAX;

/** The string clipped to `max` characters (never splitting an emoji), or undefined if it isn't one. */
function text(x: unknown, max = TEXT_MAX): string | undefined {
  if (typeof x !== 'string') return undefined;
  return x.length <= max ? x : Array.from(x).slice(0, max).join('');
}

const emoji = (x: unknown, fallback: string) => (typeof x === 'string' && x.length > 0 && x.length <= EMOJI_MAX ? x : fallback);

/** Copies `key` onto `out` only when it passes. */
function optional<T>(out: Obj, key: string, value: T | undefined) {
  if (value !== undefined) out[key] = value;
}

/** Drops items that don't survive `fix` and later items reusing an id; counts what was dropped. */
function list<T extends { id: string }>(raw: unknown[], fix: (o: Obj) => T | null, drops: { count: number }): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of raw) {
    const fixed = isObj(item) && isId(item.id) ? fix(item) : null;
    if (!fixed || seen.has(fixed.id)) {
      drops.count++;
      continue;
    }
    seen.add(fixed.id);
    out.push(fixed);
  }
  return out;
}

/* ---------- blocks ---------- */

/** start/end as a pair: both minutes in range with end after start, or both null (a floating block). */
function times(o: Obj): Pick<BlockFields, 'start' | 'end'> {
  // Ends up to a day past midnight are kept as they are: older pushes could store them.
  if (isInt(o.start, 0, DAY) && isInt(o.end, 0, 2 * DAY) && o.end > o.start) return { start: o.start, end: o.end };
  return { start: null, end: null };
}

function blockFields(o: Obj): BlockFields | null {
  const title = text(o.title);
  if (title === undefined) return null;
  const out: Obj = { title, kind: oneOf(o.kind, KINDS) ? o.kind : 'flexible', ...times(o) };
  optional(out, 'timeLabel', text(o.timeLabel));
  optional(out, 'accent', oneOf(o.accent, ACCENTS) ? o.accent : undefined);
  optional(out, 'note', text(o.note, LONG_MAX));
  optional(out, 'categoryId', isId(o.categoryId) ? o.categoryId : undefined);
  return out as unknown as BlockFields;
}

/** A per-date override sets only some fields; keep each one that is usable on its own. */
function overrideFields(o: Obj): Partial<BlockFields> {
  const out: Obj = {};
  optional(out, 'title', text(o.title));
  optional(out, 'kind', oneOf(o.kind, KINDS) ? o.kind : undefined);
  if (o.start === null || isInt(o.start, 0, DAY)) out.start = o.start;
  if (o.end === null || isInt(o.end, 0, 2 * DAY)) out.end = o.end;
  optional(out, 'timeLabel', text(o.timeLabel));
  optional(out, 'accent', oneOf(o.accent, ACCENTS) ? o.accent : undefined);
  optional(out, 'note', text(o.note, LONG_MAX));
  optional(out, 'categoryId', isId(o.categoryId) ? o.categoryId : undefined);
  return out as Partial<BlockFields>;
}

function oneOffBlock(o: Obj): OneOffBlock | null {
  const fields = blockFields(o);
  if (!fields || !isDateKey(o.date)) return null;
  return { ...fields, id: o.id as string, date: o.date, ...(o.begun === true ? { begun: true } : {}) };
}

function repeatRule(x: unknown, startDate: DateKey): RepeatRule | null {
  if (!isObj(x)) return null;
  if (x.freq === 'daily' || x.freq === 'weekdays' || x.freq === 'monthly') return { freq: x.freq };
  if (x.freq !== 'weekly') return null;
  const weekdays = Array.isArray(x.weekdays) ? [...new Set(x.weekdays.filter((d): d is number => isInt(d, 0, 6)))] : [];
  return {
    freq: 'weekly',
    interval: oneOf(x.interval, INTERVALS) ? x.interval : 1,
    weekdays: weekdays.length ? weekdays : [weekdayOf(startDate)],
  };
}

function series(o: Obj): Series | null {
  const fields = blockFields(o);
  if (!fields || !isDateKey(o.startDate)) return null;
  const repeat = repeatRule(o.repeat, o.startDate);
  if (!repeat) return null;
  return { ...fields, id: o.id as string, repeat, startDate: o.startDate, ...(isDateKey(o.endDate) ? { endDate: o.endDate } : {}) };
}

function exceptions(raw: Obj, drops: { count: number }): VesperaState['exceptions'] {
  // fromEntries defines own keys, so a "__proto__" id stays a harmless plain key.
  return Object.fromEntries(
    Object.entries(raw).flatMap(([seriesId, byDate]) => {
      if (!isObj(byDate)) {
        drops.count++;
        return [];
      }
      const dates = Object.entries(byDate).flatMap(([date, e]): [DateKey, SeriesException][] => {
        if (!isDateKey(date) || !isObj(e)) {
          drops.count++;
          return [];
        }
        const out: SeriesException = {};
        if (typeof e.skipped === 'boolean') out.skipped = e.skipped;
        if (typeof e.begun === 'boolean') out.begun = e.begun;
        if (isObj(e.overrides)) out.overrides = overrideFields(e.overrides);
        return [[date, out]];
      });
      return [[seriesId, Object.fromEntries(dates)]];
    }),
  );
}

/* ---------- quests, notes, tags ---------- */

function category(o: Obj): Category | null {
  const name = text(o.name);
  if (name === undefined) return null;
  const out: Category = {
    id: o.id as string,
    name,
    emoji: emoji(o.emoji, '✨'),
    accent: oneOf(o.accent, ACCENTS) ? o.accent : 'gold',
    archived: o.archived === true,
  };
  optional(out as unknown as Obj, 'blurb', text(o.blurb));
  return out;
}

function task(o: Obj): Task | null {
  const title = text(o.title);
  if (title === undefined || !isId(o.categoryId)) return null;
  const out: Task = { id: o.id as string, title, categoryId: o.categoryId, done: o.done === true };
  if (isDateKey(o.dueDate)) out.dueDate = o.dueDate;
  if (isDateKey(o.completedOn)) out.completedOn = o.completedOn;
  return out;
}

function chronicleEntry(o: Obj): ChronicleEntry | null {
  const t = task(o);
  return t && t.completedOn ? { ...t, completedOn: t.completedOn } : null;
}

function noteTag(o: Obj): NoteTag | null {
  const name = text(o.name);
  if (name === undefined) return null;
  return { id: o.id as string, name, emoji: emoji(o.emoji, '📌'), vocab: o.vocab === true };
}

function note(o: Obj): Note | null {
  const body = text(o.text, LONG_MAX);
  if (body === undefined || !isId(o.tagId)) return null;
  const out: Note = { id: o.id as string, tagId: o.tagId, text: body };
  optional(out as unknown as Obj, 'definition', text(o.definition, LONG_MAX));
  const r = o.review;
  if (isObj(r) && isInt(r.step, 0, REVIEW_STEPS.length - 1) && isDateKey(r.due)) out.review = { step: r.step, due: r.due };
  return out;
}

/* ---------- settings, activity, focus ---------- */

/** Every setting checked for type and range; anything unusable falls back to its default. */
export function sanitizeSettings(raw: unknown): Settings {
  const s = isObj(raw) ? raw : {};
  const d = DEFAULT_SETTINGS;
  const bool = (x: unknown, fallback: boolean) => (typeof x === 'boolean' ? x : fallback);
  // The day must start before it ends, or Plan my day finds no time and the sky stays dark.
  const day = isInt(s.dayStart, 0, DAY - 1) && isInt(s.dayEnd, 1, DAY) && s.dayEnd > s.dayStart ? { dayStart: s.dayStart, dayEnd: s.dayEnd } : { dayStart: d.dayStart, dayEnd: d.dayEnd };
  const unstickActions = Array.isArray(s.unstickActions)
    ? s.unstickActions.flatMap((a) => (typeof a === 'string' && a.trim() ? [text(a)!] : []))
    : [...DEFAULT_UNSTICK_ACTIONS];
  return sanitizeSanctuary({
    // Sanctuary fields are checked by sanitizeSanctuary; unknown keys are left behind.
    realm: s.realm,
    skyAtmosphere: s.skyAtmosphere,
    signet: s.signet,
    fastener: s.fastener,
    sprigs: s.sprigs,
    trinket: s.trinket,
    ...day,
    lateOfferMinutes: oneOf(s.lateOfferMinutes, LATE_OFFERS) ? s.lateOfferMinutes : d.lateOfferMinutes,
    focusMinutes: oneOf(s.focusMinutes, FOCUS_MINUTES) ? s.focusMinutes : d.focusMinutes,
    unstickActions,
    sparkles: bool(s.sparkles, d.sparkles),
    sounds: bool(s.sounds, d.sounds),
    volume: typeof s.volume === 'number' && s.volume >= 0 && s.volume <= 1 ? s.volume : d.volume,
    seasonal: bool(s.seasonal, d.seasonal),
    weeklySummary: bool(s.weeklySummary, d.weeklySummary),
    focusRhythm: oneOf(s.focusRhythm, RHYTHMS) ? s.focusRhythm : d.focusRhythm,
    focusSound: oneOf(s.focusSound, SOUNDS) ? s.focusSound : d.focusSound,
  } as Settings);
}

function activity(raw: unknown): VesperaState['activity'] {
  if (!isObj(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).flatMap(([date, day]): [DateKey, DayActivity][] =>
      isDateKey(date) && isObj(day) ? [[date, { quests: count(day.quests), spells: count(day.spells), focusMinutes: count(day.focusMinutes), cards: count(day.cards) }]] : [],
    ),
  );
}

/** A running session complete enough to time, or null (a broken one would open a chamber that never ends). */
function focusSession(raw: unknown): FocusSession | null {
  if (!isObj(raw)) return null;
  const f = raw;
  const title = text(f.title);
  const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
  if (
    title === undefined ||
    !isDateKey(f.date) ||
    typeof f.occurrenceKey !== 'string' ||
    !oneOf(f.rhythm, RHYTHMS) ||
    !oneOf(f.sound, SOUNDS) ||
    !finite(f.startedAt) ||
    !isInt(f.totalMinutes, 1, DAY) ||
    !(f.pausedAt === null || finite(f.pausedAt)) ||
    !(finite(f.pausedMs) && f.pausedMs >= 0)
  ) {
    return null;
  }
  return {
    title,
    ...(isId(f.categoryId) ? { categoryId: f.categoryId } : {}),
    date: f.date,
    occurrenceKey: f.occurrenceKey,
    rhythm: f.rhythm,
    sound: f.sound,
    startedAt: f.startedAt,
    totalMinutes: f.totalMinutes,
    pausedAt: f.pausedAt,
    pausedMs: f.pausedMs,
  };
}

/* ---------- archives (Wave 3 compaction) ---------- */

function chronicleMonth(o: unknown): ChronicleMonth | null {
  if (!isObj(o) || !isMonthKey(o.month)) return null;
  const titles = Array.isArray(o.titles) ? o.titles.filter((t): t is string => typeof t === 'string').slice(0, ARCHIVE_TITLES_MAX).map(clipTitle) : [];
  // fromEntries defines own keys, so a "__proto__" category id stays a harmless plain key.
  const byCategory = isObj(o.byCategory) ? Object.fromEntries(Object.entries(o.byCategory).flatMap(([id, n]) => (isId(id) ? [[id, count(n)]] : []))) : {};
  // Titles past the cap are counted only in `total`, so it is never smaller than the titles kept.
  return { month: o.month, total: Math.max(count(o.total), titles.length), byCategory, titles };
}

function activityMonth(o: unknown): ActivityMonth | null {
  if (!isObj(o) || !isMonthKey(o.month)) return null;
  return { month: o.month, quests: count(o.quests), spells: count(o.spells), focusMinutes: count(o.focusMinutes), cards: count(o.cards) };
}

/** Good months, oldest first, with a repeated month merged; bad months (or a non-list) dropped and counted. */
function months<T extends { month: string }>(raw: unknown, fix: (o: unknown) => T | null, merge: (a: T, b: T) => T, drops: { count: number }): T[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    drops.count++;
    return [];
  }
  const fixed = raw.flatMap((m) => {
    const month = fix(m);
    if (!month) drops.count++;
    return month ? [month] : [];
  });
  return byMonth(fixed, merge);
}

/* ---------- the whole board ---------- */

export interface SanitizedBoard {
  state: VesperaState;
  /** How many items (or exception entries) were unusable and left out. */
  dropped: number;
}

/**
 * A board rebuilt from untrusted JSON, or null when it isn't a Vespera v2 board at all
 * (wrong version, or a list that isn't a list).
 */
export function sanitizeBoard(parsed: unknown): SanitizedBoard | null {
  if (!isObj(parsed) || parsed.version !== 2) return null;
  const s = parsed;
  const lists = [s.blocks, s.series, s.categories, s.tasks, s.chronicle, s.noteTags, s.notes];
  if (!lists.every(Array.isArray) || !isObj(s.exceptions)) return null;

  const drops = { count: 0 };
  const lastRolloverDate = isDateKey(s.lastRolloverDate) ? s.lastRolloverDate : '1970-01-01';
  const seed = createBaseState(lastRolloverDate);
  const state: VesperaState = {
    ...seed,
    blocks: list(s.blocks as unknown[], oneOffBlock, drops),
    series: list(s.series as unknown[], series, drops),
    exceptions: exceptions(s.exceptions, drops),
    categories: list(s.categories as unknown[], category, drops),
    tasks: list(s.tasks as unknown[], task, drops),
    chronicle: list(s.chronicle as unknown[], chronicleEntry, drops),
    noteTags: list(s.noteTags as unknown[], noteTag, drops),
    notes: list(s.notes as unknown[], note, drops),
    settings: sanitizeSettings(s.settings),
    assistant: { panelOpen: isObj(s.assistant) && s.assistant.panelOpen === true },
    activity: activity(s.activity),
    focusSession: focusSession(s.focusSession),
    lastSummaryWeek: isDateKey(s.lastSummaryWeek) ? s.lastSummaryWeek : null,
    chronicleArchive: months(s.chronicleArchive, chronicleMonth, mergeChronicleMonths, drops),
    activityArchive: months(s.activityArchive, activityMonth, mergeActivityMonths, drops),
  };
  return { state, dropped: drops.count };
}
