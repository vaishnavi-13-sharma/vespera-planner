// "Plan my day" (Build D): fit open quests into today's free gaps. Rule-based and free.
import { addDays } from './dates';
import { occurrencesForDate } from './recurrence';
import type { DateKey, Task, VesperaState } from './types';

export interface PlanSuggestion {
  taskId: string;
  title: string;
  categoryId: string;
  start: number;
  end: number;
}

/** Lower is sooner: overdue, due today, due within 3 days, carried over, then the rest. */
function urgency(task: Task, today: DateKey): number {
  if (!task.dueDate) return 4;
  if (task.dueDate < today) return 0;
  if (task.dueDate === today) return 1;
  if (task.dueDate <= addDays(today, 3)) return 2;
  return 4;
}

export function planDay(
  state: VesperaState,
  today: DateKey,
  nowMinutes: number,
  { slotMinutes = 30, minGap = 20 }: { slotMinutes?: number; minGap?: number } = {},
): PlanSuggestion[] {
  const { dayStart, dayEnd } = state.settings;
  const from = Math.max(Math.ceil(nowMinutes / 5) * 5, dayStart);
  if (from >= dayEnd) return [];

  const day = occurrencesForDate(state, today);
  const busy = day
    .filter((o): o is typeof o & { start: number; end: number } => o.start !== null && o.end !== null)
    .map((o) => [o.start, o.end] as const)
    .sort((a, b) => a[0] - b[0]);

  // Free gaps between `from` and the end of the day.
  const gaps: [number, number][] = [];
  let cursor = from;
  for (const [start, end] of busy) {
    if (start > cursor) gaps.push([cursor, Math.min(start, dayEnd)]);
    cursor = Math.max(cursor, end);
    if (cursor >= dayEnd) break;
  }
  if (cursor < dayEnd) gaps.push([cursor, dayEnd]);
  const open = gaps.filter(([s, e]) => e - s >= minGap);

  const onTimeline = new Set(day.map((o) => o.title.trim().toLowerCase()));
  const quests = state.tasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => !task.done && !onTimeline.has(task.title.trim().toLowerCase()))
    .sort((a, b) => urgency(a.task, today) - urgency(b.task, today) || a.index - b.index);

  const plan: PlanSuggestion[] = [];
  for (const { task } of quests) {
    const gap = open.find(([s, e]) => e - s >= minGap);
    if (!gap) break;
    const length = Math.min(slotMinutes, gap[1] - gap[0]);
    plan.push({ taskId: task.id, title: task.title, categoryId: task.categoryId, start: gap[0], end: gap[0] + length });
    gap[0] += length;
  }
  return plan;
}
