// Pure logic for Build B: focus-session phases, vocab spaced repetition, the daily
// activity log behind the candle streak, the weekly summary, and seasons.
import { addDays, weekdayOf } from './dates';
import type { BlockFields, DateKey, DayActivity, FocusSession, Note, Season, VesperaState } from './types';

/* ---------- focus sessions ---------- */

const MIN = 60_000;
const RHYTHMS = { whole: null, pomodoro25: { focus: 25, rest: 5 }, pomodoro50: { focus: 50, rest: 10 } } as const;

/** A block's length in minutes, or 60 when it has no set time. */
export function focusSessionMinutes(block: Pick<BlockFields, 'start' | 'end'>): number {
  return block.start !== null && block.end !== null && block.end > block.start ? block.end - block.start : 60;
}

export interface FocusPhase {
  phase: 'focus' | 'rest' | 'done';
  /** ms left in the current phase. */
  remainingMs: number;
  /** ms left in the whole session. */
  totalRemainingMs: number;
  /** Focus-phase ms elapsed so far (rest doesn't count). */
  focusMs: number;
  /** 1-based focus cycle. */
  cycle: number;
  paused: boolean;
}

/** Where a session stands at `now` (epoch ms), accounting for pauses. */
export function focusPhase(session: FocusSession, now: number): FocusPhase {
  const total = session.totalMinutes * MIN;
  const clock = session.pausedAt ?? now;
  const elapsed = Math.min(total, Math.max(0, clock - session.startedAt - session.pausedMs));
  const paused = session.pausedAt !== null;
  const rhythm = RHYTHMS[session.rhythm];

  if (!rhythm) {
    const done = elapsed >= total;
    return { phase: done ? 'done' : 'focus', remainingMs: total - elapsed, totalRemainingMs: total - elapsed, focusMs: elapsed, cycle: 1, paused };
  }

  const focus = rhythm.focus * MIN;
  const cycleLen = (rhythm.focus + rhythm.rest) * MIN;
  const fullCycles = Math.floor(elapsed / cycleLen);
  const into = elapsed - fullCycles * cycleLen;
  const focusMs = fullCycles * focus + Math.min(into, focus);
  if (elapsed >= total) return { phase: 'done', remainingMs: 0, totalRemainingMs: 0, focusMs, cycle: fullCycles + 1, paused };

  const cycleStart = fullCycles * cycleLen;
  const inFocus = into < focus;
  const phaseEnd = Math.min(total, cycleStart + (inFocus ? focus : cycleLen));
  return {
    phase: inFocus ? 'focus' : 'rest',
    remainingMs: phaseEnd - elapsed,
    totalRemainingMs: total - elapsed,
    focusMs,
    cycle: fullCycles + 1,
    paused,
  };
}

/* ---------- vocab spaced repetition ---------- */

/** Days until the next review at each step. */
export const REVIEW_STEPS = [1, 3, 7, 14, 30] as const;

/** Knew it: a new card goes to step 1, a reviewed card one step further. Not yet: back tomorrow. */
export function nextReview(review: Note['review'], knew: boolean, today: DateKey): { step: number; due: DateKey } {
  const step = !knew ? 0 : review ? Math.min(review.step + 1, REVIEW_STEPS.length - 1) : 1;
  return { step, due: addDays(today, REVIEW_STEPS[step]) };
}

/** Today's study pool: due cards (oldest due first), then never-reviewed cards in board order. */
export function dailyFive(state: VesperaState, today: DateKey, limit = 5, exclude: string[] = []): Note[] {
  const vocabTags = new Set(state.noteTags.filter((t) => t.vocab).map((t) => t.id));
  const cards = state.notes.filter((n) => vocabTags.has(n.tagId) && !exclude.includes(n.id));
  const due = cards.filter((n) => n.review && n.review.due <= today).sort((a, b) => (a.review!.due < b.review!.due ? -1 : a.review!.due > b.review!.due ? 1 : 0));
  const fresh = cards.filter((n) => !n.review);
  return [...due, ...fresh].slice(0, limit);
}

/* ---------- activity & candles ---------- */

const EMPTY_DAY: DayActivity = { quests: 0, spells: 0, focusMinutes: 0, cards: 0 };

export function addActivity(activity: Record<DateKey, DayActivity>, date: DateKey, delta: Partial<DayActivity>): Record<DateKey, DayActivity> {
  const day = { ...EMPTY_DAY, ...activity[date] };
  for (const k of Object.keys(delta) as (keyof DayActivity)[]) day[k] = Math.max(0, day[k] + (delta[k] ?? 0));
  return { ...activity, [date]: day };
}

/** Any small win lights the day. */
export function isLit(day: DayActivity | undefined): boolean {
  return !!day && (day.quests > 0 || day.spells > 0 || day.focusMinutes > 0 || day.cards > 0);
}

export function mondayOf(date: DateKey): DateKey {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

export interface Candle {
  date: DateKey;
  lit: boolean;
  isToday: boolean;
  isFuture: boolean;
}

/** Mon–Sun of the week containing today. */
export function weekCandles(state: Pick<VesperaState, 'activity'>, today: DateKey): Candle[] {
  const monday = mondayOf(today);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    return { date, lit: isLit(state.activity[date]), isToday: date === today, isFuture: date > today };
  });
}

export interface WeekRecap {
  weekStart: DateKey;
  candles: number;
  quests: number;
  spells: number;
  focusMinutes: number;
  cards: number;
}

/** Last week's recap, shown once on the first visit of a new week (if enabled and last week had activity). */
export function weeklySummary(state: VesperaState, today: DateKey): WeekRecap | null {
  if (!state.settings.weeklySummary) return null;
  const thisMonday = mondayOf(today);
  if (state.lastSummaryWeek === thisMonday) return null;
  const weekStart = addDays(thisMonday, -7);
  const recap: WeekRecap = { weekStart, candles: 0, quests: 0, spells: 0, focusMinutes: 0, cards: 0 };
  for (let i = 0; i < 7; i++) {
    const day = state.activity[addDays(weekStart, i)];
    if (!day) continue;
    if (isLit(day)) recap.candles++;
    recap.quests += day.quests;
    recap.spells += day.spells;
    recap.focusMinutes += day.focusMinutes;
    recap.cards += day.cards;
  }
  return recap.candles > 0 ? recap : null;
}

/* ---------- seasons ---------- */

/** Which seasonal dressing applies on a date, if any. */
export function seasonFor(date: DateKey): Season | null {
  const md = date.slice(5); // "MM-DD"
  if (md >= '10-01' && md <= '11-05') return 'autumn';
  if (md >= '11-06' || md <= '01-31') return 'winter';
  if (md >= '02-01' && md <= '02-20') return 'valentine';
  if (md >= '03-15' && md <= '05-31') return 'spring';
  return null;
}
