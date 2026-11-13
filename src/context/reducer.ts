// Every change to Vespera's state, as pure transitions.
import { describeIntent, type CaptureReceipt, type ParsedLine, type SlideRestore } from './capture';
import { addDays, toDateKey } from './dates';
import { addActivity, focusPhase, focusSessionMinutes, mondayOf, nextReview } from './delight';
import { occurrencesForDate, pickBlockFields, rippleTimes } from './recurrence';
import { rollover } from './rollover';
import { isTutorialId } from './seed';
import { pickUnstickAction, visibleCategories } from './selectors';
import type {
  Accent,
  AmbientSound,
  BlockFields,
  Category,
  CaptureLogEntry,
  DateKey,
  FocusRhythm,
  Notice,
  NoteTag,
  Occurrence,
  OccurrenceSource,
  RepeatRule,
  SeriesException,
  Settings,
  Task,
  VesperaState,
} from './types';

/** For repeating blocks: change just this date, or this date and everything after it. */
export type EditScope = 'this' | 'future';

export type VesperaAction =
  // Blocks
  | { type: 'addBlock'; id: string; date: DateKey; fields: BlockFields; repeat: RepeatRule | null; endDate?: DateKey }
  /**
   * fields is the complete new set of block fields. date moves the occurrence (or the new series start).
   * repeat: undefined keeps the current rule, null makes it a one-off, a rule makes it repeat.
   * endDate (repeating only): undefined keeps the current end, null clears it, a date sets it (inclusive).
   * newId is used if a block or series has to be created.
   */
  | { type: 'editOccurrence'; source: OccurrenceSource; fields: BlockFields; scope: EditScope; date?: DateKey; repeat?: RepeatRule | null; endDate?: DateKey | null; newId: string }
  | { type: 'deleteOccurrence'; source: OccurrenceSource; scope: EditScope }
  | { type: 'setSkipped'; seriesId: string; date: DateKey; skipped: boolean }
  | { type: 'pushOccurrence'; date: DateKey; key: string; deltaMinutes: number }
  | { type: 'beginOccurrence'; source: OccurrenceSource }
  // Categories
  | { type: 'addCategory'; id: string; name: string; emoji: string; accent: Accent }
  | { type: 'updateCategory'; id: string; patch: Partial<Omit<Category, 'id'>> }
  | { type: 'moveCategory'; id: string; direction: -1 | 1 }
  // Quests
  | { type: 'addTask'; id: string; title: string; categoryId: string; dueDate?: DateKey }
  | { type: 'updateTask'; id: string; patch: { title?: string; categoryId?: string; dueDate?: DateKey | null } }
  | { type: 'toggleTask'; id: string; today: DateKey }
  | { type: 'deleteTask'; id: string }
  | { type: 'restoreTask'; id: string }
  // Tags & notes
  | { type: 'addTag'; id: string; name: string; emoji: string; vocab: boolean }
  | { type: 'updateTag'; id: string; patch: Partial<Pick<NoteTag, 'name' | 'emoji'>> }
  | { type: 'deleteTag'; id: string }
  | { type: 'addNote'; id: string; tagId: string; text: string; definition?: string }
  | { type: 'deleteNote'; id: string }
  // Settings & Gentle Start
  | { type: 'updateSettings'; patch: Partial<Settings> }
  /** roll is a random number in [0, 1) and now is Date.now(), passed in to keep the reducer pure. */
  | { type: 'triggerFiveMinuteReset'; roll: number; now: number }
  | { type: 'completeFiveMinuteReset'; today: DateKey }
  | { type: 'dismissFiveMinuteReset' }
  | { type: 'toggleAssistantPanel' }
  // Focus sessions, vocab study, weekly summary (Build B). `now` is Date.now(), passed in to keep the reducer pure.
  | { type: 'startFocus'; occurrence: Pick<Occurrence, 'key' | 'date' | 'title' | 'categoryId' | 'start' | 'end'>; rhythm: FocusRhythm; sound: AmbientSound; now: number }
  | { type: 'pauseFocus'; now: number }
  | { type: 'resumeFocus'; now: number }
  /** The minutes go to the day the session started; `today` is only the fallback (and the latest allowed day). */
  | { type: 'finishFocus'; now: number; today: DateKey }
  | { type: 'reviewCard'; id: string; knew: boolean; today: DateKey }
  | { type: 'dismissWeeklySummary'; today: DateKey }
  /** Remove every starter-tutorial item (ids starting with `tut-`), keeping everything else. */
  | { type: 'clearTutorial' }
  // Data
  | { type: 'rollover'; today: DateKey }
  | { type: 'replaceState'; state: VesperaState }
  | { type: 'setNotice'; notice: Notice | null }
  // Quick capture (Build D). `ids` has one id per line plus a final one for the receipt.
  | { type: 'capture'; lines: ParsedLine[]; ids: string[]; at: number }
  | { type: 'undoCapture'; receipt: CaptureReceipt };

/* ---------- helpers ---------- */

function withException(state: VesperaState, seriesId: string, date: DateKey, update: (e: SeriesException) => SeriesException): VesperaState {
  const forSeries = state.exceptions[seriesId] ?? {};
  return { ...state, exceptions: { ...state.exceptions, [seriesId]: { ...forSeries, [date]: update(forSeries[date] ?? {}) } } };
}

/** Split a series' exceptions into those before `date` and those on/after it. */
function splitExceptions(state: VesperaState, seriesId: string, date: DateKey) {
  const before: Record<DateKey, SeriesException> = {};
  const after: Record<DateKey, SeriesException> = {};
  for (const [d, e] of Object.entries(state.exceptions[seriesId] ?? {})) (d < date ? before : after)[d] = e;
  return { before, after };
}

/** End a series the day before `date` (removing it if nothing would remain) and drop its later exceptions. */
function endSeriesBefore(state: VesperaState, seriesId: string, date: DateKey): VesperaState {
  const series = state.series.find((s) => s.id === seriesId);
  if (!series) return state;
  const { [seriesId]: _dropped, ...otherExceptions } = state.exceptions;
  if (date <= series.startDate) {
    return { ...state, series: state.series.filter((s) => s.id !== seriesId), exceptions: otherExceptions };
  }
  const { before } = splitExceptions(state, seriesId, date);
  return {
    ...state,
    series: state.series.map((s) => (s.id === seriesId ? { ...s, endDate: addDays(date, -1) } : s)),
    exceptions: Object.keys(before).length ? { ...otherExceptions, [seriesId]: before } : otherExceptions,
  };
}

const updateTask = (state: VesperaState, id: string, fn: (t: Task) => Task): VesperaState => ({
  ...state,
  tasks: state.tasks.map((t) => (t.id === id ? fn(t) : t)),
});

function setDone(task: Task, done: boolean, today: DateKey): Task {
  const { completedOn: _old, ...rest } = task;
  return done ? { ...rest, done: true, completedOn: today } : { ...rest, done: false };
}

/**
 * The day a focus session's minutes belong to: the local date its candle was lit, even when
 * the app is reopened days later. Never a day after `today` (a clock that jumped back).
 */
function focusDay(startedAt: number, today: DateKey): DateKey {
  if (!Number.isFinite(startedAt)) return today;
  const lit = toDateKey(new Date(startedAt));
  return lit < today ? lit : today;
}

/* ---------- block edits ---------- */

/** Resolve an end-date edit: undefined keeps `current`, null clears, a date sets. */
const endDateField = (edit: DateKey | null | undefined, current?: DateKey) => {
  const end = edit === undefined ? current : (edit ?? undefined);
  return end ? { endDate: end } : {};
};

function editOccurrence(state: VesperaState, a: Extract<VesperaAction, { type: 'editOccurrence' }>): VesperaState {
  const fields = pickBlockFields(a.fields);

  if (a.source.type === 'oneoff') {
    const { id } = a.source;
    const block = state.blocks.find((b) => b.id === id);
    if (!block) return state;
    const date = a.date ?? block.date;
    if (a.repeat) {
      return {
        ...state,
        blocks: state.blocks.filter((b) => b.id !== id),
        series: [...state.series, { ...fields, id: a.newId, repeat: a.repeat, startDate: date, ...endDateField(a.endDate) }],
      };
    }
    const next = { ...fields, id, date, ...(block.begun ? { begun: true } : {}) };
    return { ...state, blocks: state.blocks.map((b) => (b.id === id ? next : b)) };
  }

  const { id: seriesId, date: occDate } = a.source;
  const series = state.series.find((s) => s.id === seriesId);
  if (!series) return state;
  const targetDate = a.date ?? occDate;

  if (a.scope === 'this') {
    if (targetDate === occDate) return withException(state, seriesId, occDate, (e) => ({ ...e, overrides: fields }));
    const skipped = withException(state, seriesId, occDate, (e) => ({ ...e, skipped: true }));
    return { ...skipped, blocks: [...skipped.blocks, { ...fields, id: a.newId, date: targetDate }] };
  }

  const repeat = a.repeat === undefined ? series.repeat : a.repeat;
  if (repeat === null) {
    const ended = endSeriesBefore(state, seriesId, occDate);
    return { ...ended, blocks: [...ended.blocks, { ...fields, id: a.newId, date: targetDate }] };
  }
  if (occDate <= series.startDate) {
    const updated = { ...fields, id: seriesId, repeat, startDate: targetDate, ...endDateField(a.endDate, series.endDate) };
    return { ...state, series: state.series.map((s) => (s.id === seriesId ? updated : s)) };
  }
  const { after } = splitExceptions(state, seriesId, occDate);
  const ended = endSeriesBefore(state, seriesId, occDate);
  const fresh = { ...fields, id: a.newId, repeat, startDate: targetDate, ...endDateField(a.endDate, series.endDate) };
  return {
    ...ended,
    series: [...ended.series, fresh],
    exceptions: Object.keys(after).length ? { ...ended.exceptions, [a.newId]: after } : ended.exceptions,
  };
}

function pushOccurrence(state: VesperaState, date: DateKey, key: string, delta: number): VesperaState {
  const day = occurrencesForDate(state, date);
  const moved = rippleTimes(day, key, delta);
  let next = state;
  for (const occ of day) {
    const times = moved[occ.key];
    if (!times) continue;
    if (occ.source.type === 'oneoff') {
      const id = occ.source.id;
      next = { ...next, blocks: next.blocks.map((b) => (b.id === id ? { ...b, ...times } : b)) };
    } else {
      next = withException(next, occ.source.id, date, (e) => ({ ...e, overrides: { ...e.overrides, ...times } }));
    }
  }
  return next;
}

/* ---------- reducer ---------- */

export function vesperaReducer(state: VesperaState, action: VesperaAction): VesperaState {
  switch (action.type) {
    case 'addBlock': {
      const fields = pickBlockFields(action.fields);
      return action.repeat
        ? { ...state, series: [...state.series, { ...fields, id: action.id, repeat: action.repeat, startDate: action.date, ...endDateField(action.endDate) }] }
        : { ...state, blocks: [...state.blocks, { ...fields, id: action.id, date: action.date }] };
    }
    case 'editOccurrence':
      return editOccurrence(state, action);
    case 'deleteOccurrence': {
      const { source } = action;
      if (source.type === 'oneoff') return { ...state, blocks: state.blocks.filter((b) => b.id !== source.id) };
      return action.scope === 'this'
        ? withException(state, source.id, source.date, (e) => ({ ...e, skipped: true }))
        : endSeriesBefore(state, source.id, source.date);
    }
    case 'setSkipped':
      return withException(state, action.seriesId, action.date, ({ skipped: _s, ...rest }) => (action.skipped ? { ...rest, skipped: true } : rest));
    case 'pushOccurrence':
      return pushOccurrence(state, action.date, action.key, action.deltaMinutes);
    case 'beginOccurrence': {
      const { source } = action;
      if (source.type === 'oneoff') return { ...state, blocks: state.blocks.map((b) => (b.id === source.id ? { ...b, begun: true } : b)) };
      return withException(state, source.id, source.date, (e) => ({ ...e, begun: true }));
    }

    case 'addCategory':
      return { ...state, categories: [...state.categories, { id: action.id, name: action.name, emoji: action.emoji, accent: action.accent, archived: false }] };
    case 'updateCategory':
      return { ...state, categories: state.categories.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)) };
    case 'moveCategory': {
      const i = state.categories.findIndex((c) => c.id === action.id);
      const j = i + action.direction;
      if (i < 0 || j < 0 || j >= state.categories.length) return state;
      const categories = [...state.categories];
      [categories[i], categories[j]] = [categories[j], categories[i]];
      return { ...state, categories };
    }

    case 'addTask': {
      const task: Task = { id: action.id, title: action.title, categoryId: action.categoryId, done: false };
      if (action.dueDate) task.dueDate = action.dueDate;
      return { ...state, tasks: [...state.tasks, task] };
    }
    case 'updateTask':
      return updateTask(state, action.id, (t) => {
        const { dueDate, ...rest } = action.patch;
        const { dueDate: _old, ...base } = { ...t, ...rest };
        const nextDue = dueDate === undefined ? t.dueDate : dueDate ?? undefined;
        return nextDue ? { ...base, dueDate: nextDue } : base;
      });
    case 'toggleTask': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return state;
      const next = updateTask(state, action.id, (t) => setDone(t, !t.done, action.today));
      if (!task.done) return { ...next, activity: addActivity(next.activity, action.today, { quests: 1 }) };
      return task.completedOn ? { ...next, activity: addActivity(next.activity, task.completedOn, { quests: -1 }) } : next;
    }
    case 'deleteTask':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
    case 'restoreTask': {
      const entry = state.chronicle.find((c) => c.id === action.id);
      if (!entry) return state;
      const visible = visibleCategories(state.categories);
      const categoryId = visible.some((c) => c.id === entry.categoryId) ? entry.categoryId : (visible[0]?.id ?? entry.categoryId);
      const { completedOn: _c, ...rest } = entry;
      return { ...state, chronicle: state.chronicle.filter((c) => c.id !== action.id), tasks: [...state.tasks, { ...rest, categoryId, done: false }] };
    }

    case 'addTag':
      return { ...state, noteTags: [...state.noteTags, { id: action.id, name: action.name, emoji: action.emoji, vocab: action.vocab }] };
    case 'updateTag':
      return { ...state, noteTags: state.noteTags.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)) };
    case 'deleteTag': {
      const tag = state.noteTags.find((t) => t.id === action.id);
      const heir = tag && state.noteTags.find((t) => t.id !== tag.id && t.vocab === tag.vocab);
      if (!tag || !heir) return state;
      return {
        ...state,
        noteTags: state.noteTags.filter((t) => t.id !== tag.id),
        notes: state.notes.map((n) => (n.tagId === tag.id ? { ...n, tagId: heir.id } : n)),
      };
    }
    case 'addNote': {
      const note = { id: action.id, tagId: action.tagId, text: action.text, ...(action.definition ? { definition: action.definition } : {}) };
      return { ...state, notes: [note, ...state.notes] };
    }
    case 'deleteNote':
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };

    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'triggerFiveMinuteReset':
      return {
        ...state,
        focusVeil: { ...pickUnstickAction(state, () => action.roll), endsAt: action.now + state.settings.focusMinutes * 60_000 },
      };
    case 'completeFiveMinuteReset': {
      const taskId = state.focusVeil?.taskId;
      const task = taskId ? state.tasks.find((t) => t.id === taskId && !t.done) : undefined;
      const closed = { ...state, focusVeil: null, activity: addActivity(state.activity, action.today, { spells: 1, quests: task ? 1 : 0 }) };
      return task ? updateTask(closed, task.id, (t) => setDone(t, true, action.today)) : closed;
    }
    case 'dismissFiveMinuteReset':
      return { ...state, focusVeil: null };
    case 'toggleAssistantPanel':
      return { ...state, assistant: { ...state.assistant, panelOpen: !state.assistant.panelOpen } };

    case 'startFocus': {
      const o = action.occurrence;
      return {
        ...state,
        settings: { ...state.settings, focusRhythm: action.rhythm, focusSound: action.sound },
        focusSession: {
          title: o.title,
          ...(o.categoryId ? { categoryId: o.categoryId } : {}),
          date: o.date,
          occurrenceKey: o.key,
          rhythm: action.rhythm,
          sound: action.sound,
          startedAt: action.now,
          totalMinutes: focusSessionMinutes(o),
          pausedAt: null,
          pausedMs: 0,
        },
      };
    }
    case 'pauseFocus':
      return state.focusSession && state.focusSession.pausedAt === null
        ? { ...state, focusSession: { ...state.focusSession, pausedAt: action.now } }
        : state;
    case 'resumeFocus': {
      const fs = state.focusSession;
      if (!fs || fs.pausedAt === null) return state;
      return { ...state, focusSession: { ...fs, pausedAt: null, pausedMs: fs.pausedMs + (action.now - fs.pausedAt) } };
    }
    case 'finishFocus': {
      if (!state.focusSession) return state;
      const minutes = Math.floor(focusPhase(state.focusSession, action.now).focusMs / 60_000);
      return {
        ...state,
        focusSession: null,
        activity: minutes > 0 ? addActivity(state.activity, focusDay(state.focusSession.startedAt, action.today), { focusMinutes: minutes }) : state.activity,
      };
    }
    case 'reviewCard':
      return {
        ...state,
        notes: state.notes.map((n) => (n.id === action.id ? { ...n, review: nextReview(n.review, action.knew, action.today) } : n)),
        activity: addActivity(state.activity, action.today, { cards: 1 }),
      };
    case 'dismissWeeklySummary':
      return { ...state, lastSummaryWeek: mondayOf(action.today) };
    case 'clearTutorial': {
      const keep = <T extends { id: string }>(items: T[]) => items.filter((i) => !isTutorialId(i.id));
      const categories = keep(state.categories);
      const fallback = categories.find((c) => !c.archived)?.id;
      const exceptions = Object.fromEntries(Object.entries(state.exceptions).filter(([id]) => !isTutorialId(id)));
      return {
        ...state,
        categories,
        tasks: keep(state.tasks).map((t) => (isTutorialId(t.categoryId) && fallback ? { ...t, categoryId: fallback } : t)),
        chronicle: keep(state.chronicle),
        blocks: keep(state.blocks).map((b) => (b.categoryId && isTutorialId(b.categoryId) ? { ...b, categoryId: fallback } : b)),
        series: keep(state.series),
        exceptions,
        notes: keep(state.notes),
      };
    }

    case 'rollover':
      return rollover(state, action.today);
    // A board from a newer Vespera keeps this session read-only (saveState never writes over it),
    // so its notice stays up whatever replaces the board or the notice.
    case 'replaceState':
      return state.notice === 'newer-version' ? { ...action.state, notice: 'newer-version' } : action.state;
    case 'setNotice':
      return state.notice === 'newer-version' ? state : { ...state, notice: action.notice };
    case 'capture':
      return applyCapture(state, action.lines, action.ids, action.at).state;
    case 'undoCapture':
      return revertCapture(state, action.receipt);
  }
}

/* ---------- quick capture ---------- */

const LOG_LIMIT = 8;

/** Save every readable line in one step. Deterministic for the given ids, so the caller knows the receipt up front. */
export function applyCapture(state: VesperaState, lines: ParsedLine[], ids: string[], at: number): { state: VesperaState; receipt: CaptureReceipt } {
  const receipt: CaptureReceipt = { id: ids[lines.length] ?? `cap-${at}`, count: 0, blockIds: [], seriesIds: [], taskIds: [], noteIds: [], slides: [] };
  let next = state;
  const log: CaptureLogEntry[] = [];
  lines.forEach(({ line, intent }, i) => {
    const id = ids[i];
    switch (intent.kind) {
      case 'block': {
        const fields: BlockFields = { title: intent.title, kind: 'flexible', start: intent.start, end: intent.end, ...(intent.categoryId ? { categoryId: intent.categoryId } : {}) };
        next = vesperaReducer(next, { type: 'addBlock', id, date: intent.date, fields, repeat: intent.repeat ?? null });
        (intent.repeat ? receipt.seriesIds : receipt.blockIds).push(id);
        break;
      }
      case 'quest':
        next = vesperaReducer(next, { type: 'addTask', id, title: intent.title, categoryId: intent.categoryId, ...(intent.dueDate ? { dueDate: intent.dueDate } : {}) });
        receipt.taskIds.push(id);
        break;
      case 'note':
        next = vesperaReducer(next, { type: 'addNote', id, tagId: intent.tagId, text: intent.text });
        receipt.noteIds.push(id);
        break;
      case 'vocab':
        next = vesperaReducer(next, { type: 'addNote', id, tagId: intent.tagId, text: intent.word, ...(intent.definition ? { definition: intent.definition } : {}) });
        receipt.noteIds.push(id);
        break;
      case 'slide': {
        const moved = rippleTimes(occurrencesForDate(next, intent.date), intent.occurrenceKey, intent.minutes);
        if (Object.keys(moved).length === 0) return;
        const restore: SlideRestore = { date: intent.date, occurrenceKey: intent.occurrenceKey, minutes: intent.minutes, blocks: [], series: [] };
        for (const occ of occurrencesForDate(next, intent.date)) {
          if (!moved[occ.key]) continue;
          if (occ.source.type === 'oneoff') restore.blocks.push({ id: occ.source.id, start: occ.start, end: occ.end });
          else if (!restore.series.some((s) => s.seriesId === occ.source.id)) restore.series.push({ seriesId: occ.source.id, exceptions: slidDayTimes(next, occ.source.id, intent.date) });
        }
        next = pushOccurrence(next, intent.date, intent.occurrenceKey, intent.minutes);
        receipt.slides.push(restore);
        break;
      }
      case 'unknown':
        return;
    }
    receipt.count++;
    log.push({ id: `${receipt.id}:${i}`, text: line, summary: describeIntent(intent, state), at });
  });
  if (receipt.count === 0) return { state, receipt };
  return { state: { ...next, captureLog: [...log.reverse(), ...next.captureLog].slice(0, LOG_LIMIT) }, receipt };
}

/**
 * What a slide needs to undo on a repeating block: only the slid date's previous time overrides
 * (null when that date had none). Never a snapshot of the whole series, so undo can't erase
 * skips or edits made on other dates (or synced in) after the capture.
 */
function slidDayTimes(state: VesperaState, seriesId: string, date: DateKey): SlideRestore['series'][number]['exceptions'] {
  const overrides = state.exceptions[seriesId]?.[date]?.overrides ?? {};
  const times: Partial<BlockFields> = {};
  if ('start' in overrides) times.start = overrides.start;
  if ('end' in overrides) times.end = overrides.end;
  return Object.keys(times).length ? { [date]: { overrides: times } } : null;
}

/** Put a slid series occurrence's start/end back as they were, leaving every other field and date alone. */
function restoreSlidTimes(state: VesperaState, seriesId: string, date: DateKey, before: SlideRestore['series'][number]['exceptions']): VesperaState {
  const forSeries = state.exceptions[seriesId];
  const current = forSeries?.[date];
  if (!current) return state; // the occurrence's exception is gone (e.g. replaced by a sync): nothing to undo
  const { start: _s, end: _e, ...kept } = current.overrides ?? {};
  const overrides = { ...kept, ...before?.[date]?.overrides };
  const { overrides: _o, ...rest } = current;
  const exception: SeriesException = Object.keys(overrides).length ? { ...rest, overrides } : rest;
  const { [date]: _d, ...otherDates } = forSeries;
  const dates = Object.keys(exception).length ? { ...otherDates, [date]: exception } : otherDates;
  const { [seriesId]: _x, ...otherSeries } = state.exceptions;
  return { ...state, exceptions: Object.keys(dates).length ? { ...otherSeries, [seriesId]: dates } : otherSeries };
}

/** Undo one capture: remove what it created and put slid blocks back exactly. */
export function revertCapture(state: VesperaState, receipt: CaptureReceipt): VesperaState {
  const drop = (ids: string[]) => new Set(ids);
  const blocks = drop(receipt.blockIds);
  const series = drop(receipt.seriesIds);
  const tasks = drop(receipt.taskIds);
  const notes = drop(receipt.noteIds);
  let next: VesperaState = {
    ...state,
    blocks: state.blocks.filter((b) => !blocks.has(b.id)),
    series: state.series.filter((s) => !series.has(s.id)),
    exceptions: Object.fromEntries(Object.entries(state.exceptions).filter(([id]) => !series.has(id))),
    tasks: state.tasks.filter((t) => !tasks.has(t.id)),
    notes: state.notes.filter((n) => !notes.has(n.id)),
    captureLog: state.captureLog.filter((e) => !e.id.startsWith(`${receipt.id}:`)),
  };
  for (const slide of [...receipt.slides].reverse()) {
    const times = new Map(slide.blocks.map((b) => [b.id, b]));
    next = { ...next, blocks: next.blocks.map((b) => (times.has(b.id) ? { ...b, start: times.get(b.id)!.start, end: times.get(b.id)!.end } : b)) };
    for (const { seriesId, exceptions: before } of slide.series) next = restoreSlidTimes(next, seriesId, slide.date, before);
  }
  return next;
}
