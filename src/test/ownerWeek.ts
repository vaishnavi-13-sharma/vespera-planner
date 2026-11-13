// TEST FIXTURE ONLY: a fictional sample week (Nov 11–17, 2026) with a realistic shape, used by the test suite.
// It must never be imported by app code, so it stays out of the public bundle.
import { SCHEMA_VERSION } from '../context/schema';
import { DEFAULT_SETTINGS } from '../context/seed';
import type { Category, NoteTag, VesperaState } from '../context/types';

const at = (hours: number, minutes = 0) => hours * 60 + minutes;

const OWNER_CATEGORIES: Category[] = [
  { id: 'cat-reset', name: 'Quick Reset & Self-Care', emoji: '✨', accent: 'sage', blurb: 'Five-minute kindnesses that get the day moving', archived: false },
  { id: 'cat-job1', name: 'Job 1 · Deep Research', emoji: '🔬', accent: 'gold', blurb: 'High-focus deliverables, data & code, Tuesday presentation', archived: false },
  { id: 'cat-grad', name: 'Night Class & Exam Prep', emoji: '🎓', accent: 'rose', blurb: 'Personal Essay, Exam Verbal, mocks & error log', archived: false },
  { id: 'cat-job2', name: 'Job 2 · Bookshop Shift Queue', emoji: '🪑', accent: 'burgundy', blurb: 'Batched for desk duty: Thu 9am–1pm, Fri 1pm–5pm', archived: false },
];

const OWNER_TAGS: NoteTag[] = [
  { id: 'tag-braindump', name: 'Brain Dump', emoji: '💭', vocab: false },
  { id: 'tag-grocery', name: 'Groceries', emoji: '🧺', vocab: false },
  { id: 'tag-reminder', name: 'Reminders', emoji: '🔔', vocab: false },
  { id: 'tag-vocab', name: 'Word Bank', emoji: '📜', vocab: true },
];

const OWNER_UNSTICK_ACTIONS: string[] = [
  'Sit up and drink a full glass of water',
  'Open the window and take five slow breaths',
  'Put on real clothes (shoes optional)',
  'Clear just the top of your desk',
  'Open your Essay doc and read only the first paragraph',
  'Flip through three Exam vocab cards, nothing more',
];

export function createSeedState(): VesperaState {
  return {
    version: 2,
    blocks: [
      { id: 'blk-wed-cook', date: '2026-11-11', title: 'Unpack Groceries, Cook & Eat', kind: 'flexible', start: at(17, 30), end: at(18, 15), categoryId: 'cat-reset' },
      { id: 'blk-wed-workout', date: '2026-11-11', title: 'Workout & Shower Reset', kind: 'flexible', start: at(18, 15), end: at(19), categoryId: 'cat-reset' },
      { id: 'blk-wed-focus', date: '2026-11-11', title: 'Job 1 Research Push & Essay Draft', kind: 'focus', start: at(19), end: at(20, 30), categoryId: 'cat-job1' },
      { id: 'blk-thu-essay', date: '2026-11-12', title: 'Send Finished Essay to Tutor for Review', kind: 'focus', start: at(20), end: at(21), categoryId: 'cat-grad' },
      { id: 'blk-fri-meeting', date: '2026-11-13', title: 'Possible Tutor Meeting', kind: 'anchor', start: at(11), end: at(12) },
      { id: 'blk-fri-deliverable', date: '2026-11-13', title: 'Finalize Job 1 Weekly Deliverable', kind: 'focus', start: at(17), end: at(18), categoryId: 'cat-job1' },
      { id: 'blk-sat-gre', date: '2026-11-14', title: 'Exam Module 2 + Tuesday Research Presentation Prep', kind: 'focus', start: null, end: null, timeLabel: 'Flexible', categoryId: 'cat-grad' },
      { id: 'blk-sun-event', date: '2026-11-15', title: 'Town Event (Include travel time)', kind: 'anchor', start: at(15), end: at(17) },
      { id: 'blk-sun-gre', date: '2026-11-15', title: 'Exam Module 3 + Error Log & Vocab Review', kind: 'focus', start: null, end: null, timeLabel: 'Flexible', categoryId: 'cat-grad' },
      { id: 'blk-tue-café', date: '2026-11-17', title: 'Café Holiday Cup Day Run (Get out of the house early!)', kind: 'flexible', start: null, end: null, timeLabel: 'Early Morning' },
      { id: 'blk-tue-gym', date: '2026-11-17', title: 'Town Gym Workout & Library Study Session', kind: 'flexible', start: at(12), end: at(14), categoryId: 'cat-reset' },
    ],
    series: [
      { id: 'ser-thu-desk', title: 'Job 2: Bookshop Shift (Use for Essay Polish & Exam)', kind: 'anchor', start: at(9), end: at(13), categoryId: 'cat-job2', repeat: { freq: 'weekly', interval: 1, weekdays: [4] }, startDate: '2026-11-12' },
      { id: 'ser-thu-class', title: 'Class Attendance & Project Team Check-in', kind: 'anchor', start: at(17), end: at(17, 20), repeat: { freq: 'weekly', interval: 1, weekdays: [4] }, startDate: '2026-11-12' },
      { id: 'ser-fri-desk', title: 'Job 2: Bookshop Shift (Exam Module 1 & Vocab)', kind: 'anchor', start: at(13), end: at(17), categoryId: 'cat-job2', repeat: { freq: 'weekly', interval: 1, weekdays: [5] }, startDate: '2026-11-13' },
      { id: 'ser-tue-meeting', title: 'Fixed Research Team Meeting & Presentation', kind: 'anchor', start: at(11), end: at(11, 30), categoryId: 'cat-job1', repeat: { freq: 'weekly', interval: 1, weekdays: [2] }, startDate: '2026-11-17' },
    ],
    exceptions: {},
    categories: OWNER_CATEGORIES.map((c) => ({ ...c })),
    tasks: [
      { id: 'task-sweep', categoryId: 'cat-reset', done: false, title: '5-minute floor sweep around bed and desk (Clear the hair/visual clutter)' },
      { id: 'task-bridge-fuel', categoryId: 'cat-reset', done: false, title: 'Eat quick bridge fuel before groceries arrive' },
      { id: 'task-language-app', categoryId: 'cat-reset', done: false, title: '4–5 language-app lessons for the Halloween event skin' },
      { id: 'task-research', categoryId: 'cat-job1', done: false, title: "Complete tutor's new research task for Tuesday presentation", dueDate: '2026-11-17' },
      { id: 'task-sop-draft', categoryId: 'cat-grad', done: false, title: 'Finish full draft of the Night Class personal essay by Thursday night', dueDate: '2026-11-12' },
      { id: 'task-sop-email', categoryId: 'cat-grad', done: false, title: 'Email Essay draft to tutor before Friday', dueDate: '2026-11-12' },
      { id: 'task-gre-modules', categoryId: 'cat-grad', done: false, title: 'Complete 3 Exam Modules by Sunday to prep for daily mock exams', dueDate: '2026-11-15' },
      { id: 'task-shop-essay', categoryId: 'cat-job2', done: false, title: 'Polish Essay during Thursday 9:00 AM – 1:00 PM bookshop shift', dueDate: '2026-11-12' },
      { id: 'task-desk-gre', categoryId: 'cat-job2', done: false, title: 'Drill Exam English/Verbal questions during Friday 1:00 PM – 5:00 PM shift', dueDate: '2026-11-13' },
    ],
    chronicle: [],
    noteTags: OWNER_TAGS.map((t) => ({ ...t })),
    notes: [
      { id: 'note-sop-reminder', tagId: 'tag-reminder', text: 'Email Essay draft to tutor before Friday' },
      { id: 'note-sunday-travel', tagId: 'tag-reminder', text: 'Sunday 3–5 PM town event: leave early for travel time' },
      { id: 'note-presentation', tagId: 'tag-braindump', text: 'Tuesday presentation: outline the new research task findings on Saturday' },
      { id: 'vocab-laconic', tagId: 'tag-vocab', text: 'Laconic', definition: 'Using very few words; concise to the point of seeming curt.' },
      { id: 'vocab-obdurate', tagId: 'tag-vocab', text: 'Obdurate', definition: 'Stubbornly refusing to change one’s opinion or course of action.' },
      { id: 'vocab-equivocate', tagId: 'tag-vocab', text: 'Equivocate', definition: 'To use ambiguous language to conceal the truth or avoid committing oneself.' },
      { id: 'vocab-prodigal', tagId: 'tag-vocab', text: 'Prodigal', definition: 'Spending money or resources freely and recklessly; wastefully extravagant.' },
    ],
    settings: { ...DEFAULT_SETTINGS, unstickActions: [...OWNER_UNSTICK_ACTIONS] },
    focusVeil: null,
    assistant: { panelOpen: false },
    lastRolloverDate: '2026-11-11',
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
