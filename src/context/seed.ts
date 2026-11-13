// Generic defaults and the "Welcome to Vespera" starter template that new boards begin with.
// Nothing personal lives here: this file ships in the public app bundle.
import { addDays, weekdayOf } from './dates';
import { SCHEMA_VERSION } from './schema';
import type { Category, DateKey, NoteTag, Settings, VesperaState } from './types';

const at = (hours: number, minutes = 0) => hours * 60 + minutes;

/** Every starter-tutorial item's id starts with this, so "Clear starter tutorial" can find them. */
export const TUTORIAL_PREFIX = 'tut-';
export const isTutorialId = (id: string) => id.startsWith(TUTORIAL_PREFIX);

/** Whether any starter-tutorial item is still on the board. */
export function hasTutorial(state: Pick<VesperaState, 'categories' | 'tasks' | 'blocks' | 'series' | 'notes'>): boolean {
  return [state.categories, state.tasks, state.blocks, state.series, state.notes].some((items) => items.some((i) => isTutorialId(i.id)));
}

/** The four general categories every board starts with (kept when the tutorial is cleared). */
export const GENERAL_CATEGORIES: Category[] = [
  { id: 'cat-reset', name: 'Quick Reset & Self-Care', emoji: '✨', accent: 'sage', blurb: 'Quick 5-minute tasks to get moving', archived: false },
  { id: 'cat-work', name: 'Work', emoji: '💼', accent: 'gold', blurb: 'Your job, projects and goals', archived: false },
  { id: 'cat-study', name: 'Study', emoji: '📚', accent: 'rose', blurb: 'Learning, reading and practice', archived: false },
  { id: 'cat-admin', name: 'Life Admin', emoji: '🏡', accent: 'burgundy', blurb: 'Errands, bills, replies and little chores', archived: false },
];

export const DEFAULT_TAGS: NoteTag[] = [
  { id: 'tag-braindump', name: 'Brain Dump', emoji: '💭', vocab: false },
  { id: 'tag-grocery', name: 'Groceries', emoji: '🧺', vocab: false },
  { id: 'tag-reminder', name: 'Reminders', emoji: '🔔', vocab: false },
  { id: 'tag-vocab', name: 'Vocab', emoji: '📜', vocab: true },
];

export const DEFAULT_UNSTICK_ACTIONS: string[] = [
  'Sit up and drink a full glass of water',
  'Open the window and take five slow breaths',
  'Put on real clothes (shoes optional)',
  'Clear just the top of your desk',
  'Open the doc you’re avoiding and read only the first paragraph',
  'Flip through three vocab cards, nothing more',
];

export const DEFAULT_SETTINGS: Settings = {
  dayStart: at(7),
  dayEnd: at(23),
  lateOfferMinutes: 10,
  focusMinutes: 5,
  unstickActions: DEFAULT_UNSTICK_ACTIONS,
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

/** An empty board: general categories, default tags and settings, nothing else. */
export function createBaseState(today: DateKey): VesperaState {
  return {
    version: 2,
    blocks: [],
    series: [],
    exceptions: {},
    categories: GENERAL_CATEGORIES.map((c) => ({ ...c })),
    tasks: [],
    chronicle: [],
    noteTags: DEFAULT_TAGS.map((t) => ({ ...t })),
    notes: [],
    settings: { ...DEFAULT_SETTINGS, unstickActions: [...DEFAULT_UNSTICK_ACTIONS] },
    focusVeil: null,
    assistant: { panelOpen: false },
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

/**
 * "Welcome to Vespera": a board that teaches itself. Each tutorial item says what to try,
 * and every one of them (ids starting with `tut-`) disappears with "Clear starter tutorial".
 * `nowMinutes` places the Sample Focus Block in the next free hour (or tomorrow morning if it's late).
 */
export function createStarterState(today: DateKey, nowMinutes: number): VesperaState {
  const base = createBaseState(today);
  const nextHour = Math.ceil((nowMinutes + 1) / 60) * 60;
  const deepWork = nextHour + 60 <= at(21) ? { date: today, start: nextHour, end: nextHour + 60 } : { date: addDays(today, 1), start: at(10), end: at(11) };

  return {
    ...base,
    categories: [
      { id: 'tut-cat-start', name: 'Start Here', emoji: '🕯️', accent: 'gold', blurb: 'Try each one, then clear the tutorial whenever you like', archived: false },
      ...base.categories,
    ],
    tasks: [
      { id: 'tut-task-seal', categoryId: 'tut-cat-start', done: false, title: 'Check off a task to light today’s candle' },
      { id: 'tut-task-gentle', categoryId: 'tut-cat-start', done: false, title: 'Feeling stuck? Tap “Gentle Start” for a quick 5-minute focus timer' },
      { id: 'tut-task-categories', categoryId: 'tut-cat-start', done: false, title: 'Tap the ⋯ menu on any category to rename it or change its color' },
      { id: 'tut-task-due', categoryId: 'tut-cat-start', done: false, title: 'Give this quest a due date: ⋯ → Edit' },
      { id: 'tut-task-drag', categoryId: 'tut-cat-start', done: false, title: 'Drag this quest into another category' },
      { id: 'tut-task-chronicle', categoryId: 'tut-cat-start', done: false, title: 'Check History tomorrow to see your completed tasks' },
      { id: 'tut-task-water', categoryId: 'cat-reset', done: false, title: 'Drink a glass of water' },
      { id: 'tut-task-one-thing', categoryId: 'cat-work', done: false, title: 'Write down the one thing that matters most today' },
      { id: 'tut-task-daily5', categoryId: 'cat-study', done: false, title: 'Review today’s Daily 5 on the Pinboard' },
      { id: 'tut-task-reply', categoryId: 'cat-admin', done: false, title: 'Reply to one message you’ve been putting off' },
    ],
    blocks: [
      { id: 'tut-blk-focus', ...deepWork, title: 'Sample Focus Block: tap the pencil to change the time or repeat it, or start the Focus Timer', kind: 'focus', categoryId: 'cat-work' },
    ],
    series: [
      {
        id: 'tut-ser-routine',
        title: 'Daily routine: try “Skip today”',
        kind: 'flexible',
        start: at(18),
        end: at(18, 15),
        categoryId: 'tut-cat-start',
        repeat: { freq: 'weekly', interval: 1, weekdays: [weekdayOf(today)] },
        startDate: today,
      },
    ],
    notes: [
      { id: 'tut-note-welcome', tagId: 'tag-braindump', text: 'Welcome to Vespera! Your notes show up here. Filter them with the tag chips, and unpin one with ✕.' },
      { id: 'tut-note-tags', tagId: 'tag-reminder', text: 'Tap “Edit tags” to rename tags or start your own vocab deck.' },
      { id: 'tut-vocab-daily5', tagId: 'tag-vocab', text: 'Daily 5', definition: 'Tap 📖 Study to flip each card, then pick Knew it or Not yet. Words you know come back later.' },
      { id: 'tut-vocab-ephemeral', tagId: 'tag-vocab', text: 'Ephemeral', definition: 'Lasting for a very short time.' },
      { id: 'tut-vocab-sanguine', tagId: 'tag-vocab', text: 'Sanguine', definition: 'Optimistic, especially in a difficult situation.' },
      { id: 'tut-vocab-halcyon', tagId: 'tag-vocab', text: 'Halcyon', definition: 'Idyllically calm and peaceful.' },
    ],
  };
}
