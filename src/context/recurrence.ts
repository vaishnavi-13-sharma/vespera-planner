// Expands one-off blocks, repeating series and per-date exceptions into what's on a given date.
import { addDays, dayOfMonth, daysBetween, WEEKDAY_SHORT, weekdayOf } from './dates';
import type { BlockFields, DateKey, Occurrence, RepeatRule, Series, VesperaState } from './types';

const FIELD_KEYS: (keyof BlockFields)[] = ['title', 'kind', 'start', 'end', 'timeLabel', 'accent', 'note', 'categoryId'];

/** Copy only the BlockFields of a block/series, dropping undefined optionals. */
export function pickBlockFields(source: BlockFields): BlockFields {
  const out: Record<string, unknown> = {};
  for (const k of FIELD_KEYS) if (source[k] !== undefined) out[k] = source[k];
  return out as unknown as BlockFields;
}

/** Sunday that starts the week containing `key`. */
const weekStart = (key: DateKey) => addDays(key, -weekdayOf(key));

export function occursOn(series: Series, date: DateKey): boolean {
  if (date < series.startDate) return false;
  if (series.endDate && date > series.endDate) return false;
  const rule = series.repeat;
  switch (rule.freq) {
    case 'daily':
      return true;
    case 'weekdays': {
      const wd = weekdayOf(date);
      return wd >= 1 && wd <= 5;
    }
    case 'weekly': {
      if (!rule.weekdays.includes(weekdayOf(date))) return false;
      const weeks = daysBetween(weekStart(series.startDate), weekStart(date)) / 7;
      return weeks % rule.interval === 0;
    }
    case 'monthly':
      return dayOfMonth(date) === dayOfMonth(series.startDate);
  }
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

/** "Daily", "Weekdays", "Weekly · Thu, Fri", "Every 2 weeks · Thu", "Monthly · 12th" */
export function describeRepeat(rule: RepeatRule, startDate: DateKey): string {
  switch (rule.freq) {
    case 'daily':
      return 'Daily';
    case 'weekdays':
      return 'Weekdays';
    case 'weekly': {
      const days = [...rule.weekdays].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d]).join(', ');
      return `${rule.interval === 1 ? 'Weekly' : `Every ${rule.interval} weeks`} · ${days}`;
    }
    case 'monthly':
      return `Monthly · ${ordinal(dayOfMonth(startDate))}`;
  }
}

const byTime = (a: Occurrence, b: Occurrence) => (a.start ?? -1) - (b.start ?? -1);

/** Everything on `date`: untimed first, then by start time. */
export function occurrencesForDate(state: Pick<VesperaState, 'blocks' | 'series' | 'exceptions'>, date: DateKey): Occurrence[] {
  const oneOffs: Occurrence[] = state.blocks
    .filter((b) => b.date === date)
    .map((b) => ({
      ...pickBlockFields(b),
      key: b.id,
      date,
      begun: !!b.begun,
      source: { type: 'oneoff', id: b.id },
      repeat: null,
    }));

  const fromSeries: Occurrence[] = [];
  for (const s of state.series) {
    if (!occursOn(s, date)) continue;
    const exc = state.exceptions[s.id]?.[date];
    if (exc?.skipped) continue;
    fromSeries.push({
      ...pickBlockFields({ ...s, ...exc?.overrides }),
      key: `${s.id}@${date}`,
      date,
      begun: !!exc?.begun,
      source: { type: 'series', id: s.id, date },
      repeat: s.repeat,
    });
  }

  return [...oneOffs, ...fromSeries].sort(byTime);
}

const DAY_MINUTES = 24 * 60;

type Timed = Occurrence & { start: number; end: number };
const isTimed = (o: Occurrence): o is Timed => o.start !== null && o.end !== null;

/**
 * New times after shifting one occurrence by deltaMinutes. When pushing later, movable
 * occurrences that would now overlap slide forward too, so a slow start ripples through
 * the day instead of stacking blocks. Anchors and untimed blocks never move.
 * Returns only the occurrences whose times change, keyed by occurrence key, or nothing at all when
 * any of them would leave the day (blocks can't run past midnight, so the whole move is refused).
 */
export function rippleTimes(day: Occurrence[], key: string, deltaMinutes: number): Record<string, { start: number; end: number }> {
  const target = day.find((o) => o.key === key);
  if (!target || target.kind === 'anchor' || !isTimed(target) || deltaMinutes === 0) return {};

  const moved: Record<string, { start: number; end: number }> = {
    [key]: { start: target.start + deltaMinutes, end: target.end + deltaMinutes },
  };
  if (deltaMinutes > 0) {
    let frontier = target.end + deltaMinutes;
    const followers = day
      .filter((o): o is Timed => o.key !== key && o.kind !== 'anchor' && isTimed(o) && o.start >= target.start)
      .sort((a, b) => a.start - b.start);
    for (const o of followers) {
      if (o.start >= frontier) break;
      const push = frontier - o.start;
      moved[o.key] = { start: o.start + push, end: o.end + push };
      frontier = o.end + push;
    }
  }
  const fits = Object.values(moved).every((t) => t.start >= 0 && t.end <= DAY_MINUTES);
  return fits ? moved : {};
}

/** Whether shifting this occurrence (and whatever ripples after it) keeps every block inside the day. */
export function canShift(day: Occurrence[], key: string, deltaMinutes: number): boolean {
  return Object.keys(rippleTimes(day, key, deltaMinutes)).length > 0;
}
