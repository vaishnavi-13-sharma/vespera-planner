// Derived values the panels read. All pure.
import { occurrencesForDate } from './recurrence';
import { isTutorialId } from './seed';
import type { Category, DateKey, FocusVeilSession, Occurrence, Task, VesperaState } from './types';

/** An open quest whose due date has passed ("carried over", never "overdue"). */
export function isCarriedOver(task: Task, today: DateKey): boolean {
  return !task.done && !!task.dueDate && task.dueDate < today;
}

/** Today's golden ribbon: quests finished today vs. finished today + still open. */
export function todayProgress(tasks: Task[], today: DateKey): { done: number; total: number; ratio: number } {
  const done = tasks.filter((t) => t.done && t.completedOn === today).length;
  const open = tasks.filter((t) => !t.done).length;
  const total = done + open;
  return { done, total, ratio: total === 0 ? 0 : done / total };
}

/** The timed occurrence happening at `minutes`, if any (latest start wins on overlap). */
export function currentOccurrence(day: Occurrence[], minutes: number): Occurrence | null {
  const live = day.filter((o) => o.start !== null && o.end !== null && o.start <= minutes && minutes < o.end);
  return live.at(-1) ?? null;
}

/** Category ids linked to a block in progress right now. */
export function activeCategoryIds(state: VesperaState, today: DateKey, minutes: number): string[] {
  const ids = occurrencesForDate(state, today)
    .filter((o) => o.categoryId && o.start !== null && o.end !== null && o.start <= minutes && minutes < o.end)
    .map((o) => o.categoryId!);
  return [...new Set(ids)];
}

/** The first movable, un-begun block today that started more than settings.lateOfferMinutes ago and hasn't ended. */
export function lateOffer(state: VesperaState, today: DateKey, minutes: number): Occurrence | null {
  const delay = state.settings.lateOfferMinutes;
  if (delay === 0) return null;
  return (
    occurrencesForDate(state, today).find(
      (o) => o.kind !== 'anchor' && !o.begun && o.start !== null && o.end !== null && o.start + delay <= minutes && minutes < o.end,
    ) ?? null
  );
}

export function openCountByCategory(tasks: Task[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of tasks) if (!t.done) counts[t.categoryId] = (counts[t.categoryId] ?? 0) + 1;
  return counts;
}

export function visibleCategories(categories: Category[]): Category[] {
  return categories.filter((c) => !c.archived);
}

const FALLBACK_ACTION = 'Take three slow breaths';

/** Gentle Start pool: open quests in the first visible category (never tutorial quests), then the user's own actions. */
export function pickUnstickAction(state: VesperaState, random: () => number = Math.random): Omit<FocusVeilSession, 'endsAt'> {
  const first = visibleCategories(state.categories)[0];
  const pool: Omit<FocusVeilSession, 'endsAt'>[] = [
    ...state.tasks.filter((t) => first && t.categoryId === first.id && !t.done && !isTutorialId(t.id)).map((t) => ({ action: t.title, taskId: t.id })),
    ...state.settings.unstickActions.map((action) => ({ action, taskId: null })),
  ];
  if (pool.length === 0) return { action: FALLBACK_ACTION, taskId: null };
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
