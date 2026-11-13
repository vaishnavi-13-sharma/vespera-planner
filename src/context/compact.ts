// Keeps a board small for years: Chronicle entries and activity days older than 90 days fold
// into one summary per month. A summary keeps counts per category plus the quest titles, nothing
// else, so archived quests can no longer be restored (owner decision, 2026-11-12).
import { addDays, isDateKey } from './dates';
import type { ActivityMonth, ChronicleEntry, ChronicleMonth, DateKey, VesperaState } from './types';

/** Entries and days more than this many days before today are archived. */
export const ARCHIVE_AFTER_DAYS = 90;
export const ARCHIVE_TITLE_MAX = 120;
/** Titles kept per month; quests past this are counted only in `total`. */
export const ARCHIVE_TITLES_MAX = 500;

/** A "YYYY-MM" month key. */
export const isMonthKey = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(x);

/** A count as a non-negative whole number (anything odd counts as 0). */
export const count = (x: unknown) => (Number.isFinite(x) && (x as number) > 0 ? Math.floor(x as number) : 0);

/** The title clipped to `ARCHIVE_TITLE_MAX` characters, never splitting an emoji. */
export const clipTitle = (title: string) => (title.length <= ARCHIVE_TITLE_MAX ? title : Array.from(title).slice(0, ARCHIVE_TITLE_MAX).join(''));

/** Two summaries of the same month as one (`a` is the older part). */
export function mergeChronicleMonths(a: ChronicleMonth, b: ChronicleMonth): ChronicleMonth {
  // A Map, then fromEntries, so a "__proto__" category id stays a harmless plain key.
  const byCategory = new Map(Object.entries(a.byCategory));
  for (const [id, n] of Object.entries(b.byCategory)) byCategory.set(id, (byCategory.get(id) ?? 0) + n);
  return { month: a.month, total: a.total + b.total, byCategory: Object.fromEntries(byCategory), titles: [...a.titles, ...b.titles].slice(0, ARCHIVE_TITLES_MAX) };
}

export function mergeActivityMonths(a: ActivityMonth, b: ActivityMonth): ActivityMonth {
  return { month: a.month, quests: a.quests + b.quests, spells: a.spells + b.spells, focusMinutes: a.focusMinutes + b.focusMinutes, cards: a.cards + b.cards };
}

type Compactable = Pick<VesperaState, 'chronicle' | 'activity' | 'chronicleArchive' | 'activityArchive'>;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/**
 * Chronicle entries finished more than 90 days before `today`, and activity days that old, folded
 * into their months (merging into months already archived). Idempotent, and the very same board
 * comes back when there is nothing to fold. It also runs on a stored board mid-migration, before
 * the sanitizer, so anything it can't read is left where it is for the sanitizer to judge.
 */
export function compactBoard<T extends Compactable>(state: T, today: DateKey): T {
  const cutoff = addDays(today, -ARCHIVE_AFTER_DAYS); // dates before this are archived
  const isOld = (date: unknown): date is DateKey => isDateKey(date) && date < cutoff;
  const archivable = (e: unknown): e is ChronicleEntry => isObj(e) && isOld(e.completedOn) && typeof e.title === 'string' && typeof e.categoryId === 'string';
  const oldEntries = state.chronicle.filter(archivable);
  const oldDays = Object.entries(state.activity).filter(([date, d]) => isOld(date) && isObj(d));
  if (!oldEntries.length && !oldDays.length) return state;

  // The Chronicle is newest first; summaries list titles oldest first.
  const finished = [...oldEntries].reverse().sort((a, b) => (a.completedOn < b.completedOn ? -1 : a.completedOn > b.completedOn ? 1 : 0));
  const chronicleMonths = finished.map(
    (e): ChronicleMonth => ({ month: e.completedOn.slice(0, 7), total: 1, byCategory: Object.fromEntries([[e.categoryId, 1]]), titles: [clipTitle(e.title)] }),
  );
  const activityMonths = oldDays.map(
    ([date, d]): ActivityMonth => ({ month: date.slice(0, 7), quests: count(d.quests), spells: count(d.spells), focusMinutes: count(d.focusMinutes), cards: count(d.cards) }),
  );
  const archived = new Set<unknown>(oldEntries);
  return {
    ...state,
    chronicle: state.chronicle.filter((e) => !archived.has(e)),
    activity: Object.fromEntries(Object.entries(state.activity).filter(([date, d]) => !(isOld(date) && isObj(d)))),
    chronicleArchive: byMonth([...state.chronicleArchive, ...chronicleMonths], mergeChronicleMonths),
    activityArchive: byMonth([...state.activityArchive, ...activityMonths], mergeActivityMonths),
  };
}

/** One entry per month, oldest first, merging months that appear more than once (in list order). */
export function byMonth<T extends { month: string }>(months: T[], merge: (a: T, b: T) => T): T[] {
  const merged = new Map<string, T>();
  for (const m of months) {
    const seen = merged.get(m.month);
    merged.set(m.month, seen ? merge(seen, m) : m);
  }
  return [...merged.values()].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
}
