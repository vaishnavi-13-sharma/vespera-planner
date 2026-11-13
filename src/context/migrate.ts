// One-time upgrade of a Vespera v1 save (fixed Wed–Tue week) to v2 (real dates, series, ids).
import { SCHEMA_VERSION } from './schema';
import { DEFAULT_SETTINGS, DEFAULT_TAGS, DEFAULT_UNSTICK_ACTIONS } from './seed';
import type { BlockFields, Category, DateKey, Note, OneOffBlock, Series, Task, VesperaState } from './types';

/** v1's four fixed categories, by their v1 keys (neutral names; rename them in the app). */
const V1_CATEGORIES: Category[] = [
  { id: 'cat-reset', name: 'Quick Reset & Self-Care', emoji: '✨', accent: 'sage', archived: false },
  { id: 'cat-job1', name: 'Job 1', emoji: '🔬', accent: 'gold', archived: false },
  { id: 'cat-grad', name: 'Night Class', emoji: '🎓', accent: 'rose', archived: false },
  { id: 'cat-job2', name: 'Job 2', emoji: '🪑', accent: 'burgundy', archived: false },
];

/** v1 showed the week of Wed Nov 11 – Tue Nov 17, 2026. */
const V1_DAY_TO_DATE: Record<string, DateKey> = {
  wed: '2026-11-11', thu: '2026-11-12', fri: '2026-11-13', sat: '2026-11-14', sun: '2026-11-15', mon: '2026-11-16', tue: '2026-11-17',
};

/** v1 blocks that become weekly series if they are still on their original day. */
const V1_RECURRING: Record<string, { seriesId: string; day: string; weekday: number }> = {
  'blk-thu-desk': { seriesId: 'ser-thu-desk', day: 'thu', weekday: 4 },
  'blk-thu-class': { seriesId: 'ser-thu-class', day: 'thu', weekday: 4 },
  'blk-fri-desk': { seriesId: 'ser-fri-desk', day: 'fri', weekday: 5 },
  'blk-tue-meeting': { seriesId: 'ser-tue-meeting', day: 'tue', weekday: 2 },
};

interface V1Block extends BlockFields { id: string; day: string }
interface V1Task { id: string; title: string; category: string; done: boolean }
interface V1Note { id: string; kind: string; text: string; definition?: string }

function fieldsOf(b: V1Block): BlockFields {
  const f: BlockFields = { title: b.title, kind: b.kind, start: b.start, end: b.end };
  if (b.timeLabel) f.timeLabel = b.timeLabel;
  return f;
}

/** Throws if `raw` is not a v1 save. `today` stamps quests that were already done. */
export function migrateV1(raw: unknown, today: DateKey): VesperaState {
  const v1 = raw as { blocks: V1Block[]; tasks: V1Task[]; notes: V1Note[]; assistant?: { panelOpen: boolean } };
  if (!Array.isArray(v1?.blocks) || !Array.isArray(v1.tasks) || !Array.isArray(v1.notes)) throw new Error('Not a Vespera v1 save');

  const blocks: OneOffBlock[] = [];
  const series: Series[] = [];
  for (const b of v1.blocks) {
    const date = V1_DAY_TO_DATE[b.day];
    if (!date) throw new Error(`Unknown v1 day: ${b.day}`);
    const rec = V1_RECURRING[b.id];
    if (rec && rec.day === b.day) {
      series.push({ ...fieldsOf(b), id: rec.seriesId, repeat: { freq: 'weekly', interval: 1, weekdays: [rec.weekday] }, startDate: date });
    } else {
      blocks.push({ ...fieldsOf(b), id: b.id, date });
    }
  }

  const tasks: Task[] = v1.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    categoryId: `cat-${t.category}`,
    done: t.done,
    ...(t.done ? { completedOn: today } : {}),
  }));

  const notes: Note[] = v1.notes.map((n) => ({
    id: n.id,
    tagId: `tag-${n.kind}`,
    text: n.text,
    ...(n.definition ? { definition: n.definition } : {}),
  }));

  return {
    version: 2,
    blocks,
    series,
    exceptions: {},
    categories: V1_CATEGORIES.map((c) => ({ ...c })),
    tasks,
    chronicle: [],
    noteTags: DEFAULT_TAGS.map((t) => ({ ...t })),
    notes,
    settings: { ...DEFAULT_SETTINGS, unstickActions: [...DEFAULT_UNSTICK_ACTIONS] },
    focusVeil: null,
    assistant: { panelOpen: !!v1.assistant?.panelOpen },
    lastRolloverDate: today,
    notice: null,
    activity: {},
    focusSession: null,
    lastSummaryWeek: null,
    captureLog: [],
    schemaVersion: SCHEMA_VERSION,
    chronicleArchive: [],
    activityArchive: [],
  };
}
