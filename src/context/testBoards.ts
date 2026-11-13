// TEST HELPER ONLY (never imported by app code): boards that exercise the stored format.
import { createBaseState, DEFAULT_SETTINGS } from './seed';
import type { VesperaState } from './types';

/** Every optional field set, plus the edge values whose absence would mean something else. */
export function everyFieldBoard(): VesperaState {
  return {
    ...createBaseState('2026-11-12'),
    blocks: [
      { id: 'b1', date: '2026-11-12', title: 'Floating', kind: 'flexible', start: null, end: null, timeLabel: 'Early Morning', accent: 'rose', note: 'n', categoryId: 'cat-work', begun: true },
      { id: 'b2', date: '2026-11-13', title: 'Blank label', kind: 'anchor', start: 60, end: 120, timeLabel: '', note: '' },
    ],
    series: [
      { id: 's1', title: 'Weekly', kind: 'focus', start: 540, end: 600, repeat: { freq: 'weekly', interval: 2, weekdays: [1, 3] }, startDate: '2026-11-02', endDate: '2026-12-31', accent: 'gold' },
      { id: 's2', title: 'Daily', kind: 'flexible', start: null, end: null, repeat: { freq: 'daily' }, startDate: '2026-11-01' },
    ],
    exceptions: {
      s1: {
        '2026-11-04': { skipped: true },
        '2026-11-09': { skipped: false, begun: false, overrides: { start: null, end: null, timeLabel: '', note: '' } },
        '2026-11-11': { begun: true, overrides: { title: 'Moved', start: 600, end: 660 } },
      },
      s2: {},
    },
    categories: [
      { id: 'c1', name: 'Old', emoji: '🗝️', accent: 'taupe', blurb: '', archived: true },
      { id: 'c2', name: 'New', emoji: '✨', accent: 'sage', archived: false },
    ],
    tasks: [
      { id: 't1', title: 'Open', categoryId: 'c2', done: false, dueDate: '2026-11-20' },
      { id: 't2', title: 'Done today', categoryId: 'c2', done: true, completedOn: '2026-11-12' },
    ],
    chronicle: [{ id: 't0', title: 'Finished', categoryId: 'c1', done: true, dueDate: '2026-11-01', completedOn: '2026-11-02' }],
    noteTags: [
      { id: 'tag-a', name: 'A', emoji: '💭', vocab: false },
      { id: 'tag-v', name: 'V', emoji: '📜', vocab: true },
    ],
    notes: [
      { id: 'n1', tagId: 'tag-a', text: '' },
      { id: 'n2', tagId: 'tag-v', text: 'Word', definition: '', review: { step: 0, due: '2026-11-12' } },
    ],
    settings: {
      ...DEFAULT_SETTINGS,
      unstickActions: [],
      volume: 0,
      sparkles: false,
      lateOfferMinutes: 0,
      signet: { color: 'sage', emblem: 'initial', initial: 'Q' },
    },
    assistant: { panelOpen: true },
    activity: { '2026-11-10': { quests: 2, spells: 0, focusMinutes: 0, cards: 0 }, '2026-11-11': { quests: 0, spells: 0, focusMinutes: 0, cards: 0 } },
    focusSession: { title: 'F', categoryId: 'c2', date: '2026-11-12', occurrenceKey: 'b1', rhythm: 'whole', sound: 'off', startedAt: 1, totalMinutes: 30, pausedAt: null, pausedMs: 0 },
    lastSummaryWeek: '2026-11-09',
    chronicleArchive: [{ month: '2026-07', total: 3, byCategory: { c1: 2, c2: 1 }, titles: ['a', 'b', 'c'] }],
    activityArchive: [{ month: '2026-07', quests: 3, spells: 1, focusMinutes: 25, cards: 0 }],
  };
}
