// The React side of Vespera's state: provider (reducer + persistence + a minute clock +
// the new-morning rollover) and the useVespera() hook. Panels read and change state ONLY
// through useVespera(). The pure modules are re-exported so imports stay in one place.
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { minutesOf, toDateKey } from './dates';
import type { CaptureIntent, CaptureReceipt, ParsedLine } from './capture';
import { applyCapture, vesperaReducer, type EditScope } from './reducer';
import { rollover } from './rollover';
import { isFromTheFuture } from './schema';
import { createStarterState } from './seed';
import { browserStorage, loadState, parseImport, parseState, saveState, STORAGE_KEY } from './storage';
import type {
  Accent,
  AmbientSound,
  BlockFields,
  Category,
  DateKey,
  FocusRhythm,
  NoteTag,
  Occurrence,
  OccurrenceSource,
  RepeatRule,
  Settings,
  VesperaState,
} from './types';

export * from './capture';
export * from './dates';
export * from './delight';
export * from './oracle';
export * from './planDay';
export * from './recurrence';
export * from './reducer';
export * from './rollover';
export * from './sanctuary';
export * from './schema';
export * from './seed';
export * from './selectors';
export * from './storage';
export * from './types';

/** Id prefixes for things made by quick capture, matching the rest of the app. */
const ID_PREFIX: Record<CaptureIntent['kind'] | 'series', string> = { block: 'blk', series: 'ser', quest: 'task', note: 'note', vocab: 'note', slide: 'cap', unknown: 'cap' };

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Every change the UI (and the optional AI Quick Scribe) can make. */
export interface VesperaActions {
  // Blocks
  addBlock(date: DateKey, fields: BlockFields, repeat?: RepeatRule | null, endDate?: DateKey): void;
  /**
   * fields is the complete new field set. options.date moves it (or the new series start).
   * options.repeat / options.endDate: undefined keeps, null clears, a value sets.
   */
  editOccurrence(
    source: OccurrenceSource,
    fields: BlockFields,
    scope: EditScope,
    options?: { date?: DateKey; repeat?: RepeatRule | null; endDate?: DateKey | null },
  ): void;
  deleteOccurrence(source: OccurrenceSource, scope: EditScope): void;
  skipOccurrence(seriesId: string, date: DateKey): void;
  unskipOccurrence(seriesId: string, date: DateKey): void;
  pushOccurrence(date: DateKey, key: string, deltaMinutes: number): void;
  beginOccurrence(source: OccurrenceSource): void;
  // Categories
  addCategory(name: string, emoji: string, accent: Accent): string;
  updateCategory(id: string, patch: Partial<Omit<Category, 'id'>>): void;
  moveCategory(id: string, direction: -1 | 1): void;
  // Quests
  addTask(title: string, categoryId: string, dueDate?: DateKey): void;
  updateTask(id: string, patch: { title?: string; categoryId?: string; dueDate?: DateKey | null }): void;
  toggleTask(id: string): void;
  deleteTask(id: string): void;
  restoreTask(id: string): void;
  // Tags & notes
  addTag(name: string, emoji: string, vocab: boolean): string;
  updateTag(id: string, patch: Partial<Pick<NoteTag, 'name' | 'emoji'>>): void;
  deleteTag(id: string): void;
  addNote(tagId: string, text: string, definition?: string): void;
  deleteNote(id: string): void;
  // Settings & Gentle Start
  updateSettings(patch: Partial<Settings>): void;
  triggerFiveMinuteReset(): void;
  completeFiveMinuteReset(): void;
  dismissFiveMinuteReset(): void;
  toggleAssistantPanel(): void;
  // Focus sessions, vocab study, weekly summary
  startFocus(occurrence: Pick<Occurrence, 'key' | 'date' | 'title' | 'categoryId' | 'start' | 'end'>, rhythm: FocusRhythm, sound: AmbientSound): void;
  pauseFocus(): void;
  resumeFocus(): void;
  /** Ends the session (finished or early), logging the focus minutes spent. */
  finishFocus(): void;
  reviewCard(noteId: string, knew: boolean): void;
  dismissWeeklySummary(): void;
  // Data
  /** Remove every starter-tutorial item and keep everything else. */
  clearTutorial(): void;
  /** Replace the whole board with one from elsewhere (cloud sync). The caller has validated it. */
  applyRemoteState(state: VesperaState): void;
  /** Replaces everything with a validated backup; returns false (and sets a notice) if the text isn't one. */
  importBackup(text: string): boolean;
  /** Start over from the "Welcome to Vespera" starter guide. */
  resetToStarter(): void;
  dismissNotice(): void;
  // Quick capture (Build D)
  /** Save every readable line in one step; returns a receipt for Undo (count 0 when nothing was readable). */
  capture(lines: ParsedLine[]): CaptureReceipt;
  undoCapture(receipt: CaptureReceipt): void;
}

export interface VesperaContextValue extends VesperaActions {
  state: VesperaState;
  /** Refreshed every minute and when the window regains focus. */
  now: Date;
  today: DateKey;
  nowMinutes: number;
}

const VesperaContext = createContext<VesperaContextValue | null>(null);

const CLOCK_MS = 60_000;

export function VesperaProvider({
  children,
  initialState,
  storageKey = STORAGE_KEY,
}: {
  children: ReactNode;
  initialState?: VesperaState;
  /** Where this board is cached; sync uses one key per signed-in account. Remount (key={storageKey}) to switch. */
  storageKey?: string;
}) {
  const [now, setNow] = useState(() => new Date());
  const today = toDateKey(now);
  const todayRef = useRef(today);
  todayRef.current = today;

  const [state, dispatch] = useReducer(vesperaReducer, initialState, (init) => {
    const now = new Date();
    const day = toDateKey(now);
    return rollover(init ?? loadState(browserStorage(), day, { key: storageKey, nowMinutes: minutesOf(now) }), day);
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const tick = () => setNow(new Date());
    // Timers sleep while a phone app is in the background: catch the clock up the moment it's back in view.
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    const id = setInterval(tick, CLOCK_MS);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (state.lastRolloverDate !== today) dispatch({ type: 'rollover', today });
  }, [today, state.lastRolloverDate]);

  /** The board just adopted from another tab: already saved there, so it isn't written back. */
  const adoptedRef = useRef<VesperaState | null>(null);

  useEffect(() => {
    if (state === adoptedRef.current) return;
    saveState(state, browserStorage(), storageKey);
  }, [state, storageKey]);

  // Another tab (or the installed app) saved this board: show its version here instead of
  // writing over it with a stale copy on the next edit. This tab's veil, notice and capture log stay.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey || !e.newValue) return;
      let parsed: VesperaState | null = null;
      let newer = false;
      try {
        const json: unknown = JSON.parse(e.newValue);
        newer = isFromTheFuture(json);
        parsed = parseState(json);
      } catch {
        return; // half-written or unreadable: keep this tab's board
      }
      // A newer Vespera saved it: this tab turns read-only (saveState never writes over it).
      if (!parsed) parsed = newer ? stateRef.current : null;
      if (!parsed) return;
      const { focusVeil, captureLog } = stateRef.current;
      const notice = newer ? 'newer-version' : stateRef.current.notice;
      const adopted = { ...rollover(parsed, todayRef.current), focusVeil, notice, captureLog };
      adoptedRef.current = adopted;
      dispatch({ type: 'replaceState', state: adopted });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [storageKey]);

  const actions = useMemo<VesperaActions>(
    () => ({
      addBlock: (date, fields, repeat = null, endDate) => dispatch({ type: 'addBlock', id: makeId(repeat ? 'ser' : 'blk'), date, fields, repeat, endDate }),
      editOccurrence: (source, fields, scope, options = {}) =>
        dispatch({ type: 'editOccurrence', source, fields, scope, ...options, newId: makeId(options.repeat ? 'ser' : 'blk') }),
      deleteOccurrence: (source, scope) => dispatch({ type: 'deleteOccurrence', source, scope }),
      skipOccurrence: (seriesId, date) => dispatch({ type: 'setSkipped', seriesId, date, skipped: true }),
      unskipOccurrence: (seriesId, date) => dispatch({ type: 'setSkipped', seriesId, date, skipped: false }),
      pushOccurrence: (date, key, deltaMinutes) => dispatch({ type: 'pushOccurrence', date, key, deltaMinutes }),
      beginOccurrence: (source) => dispatch({ type: 'beginOccurrence', source }),

      addCategory: (name, emoji, accent) => {
        const id = makeId('cat');
        dispatch({ type: 'addCategory', id, name, emoji, accent });
        return id;
      },
      updateCategory: (id, patch) => dispatch({ type: 'updateCategory', id, patch }),
      moveCategory: (id, direction) => dispatch({ type: 'moveCategory', id, direction }),

      addTask: (title, categoryId, dueDate) => dispatch({ type: 'addTask', id: makeId('task'), title, categoryId, dueDate }),
      updateTask: (id, patch) => dispatch({ type: 'updateTask', id, patch }),
      toggleTask: (id) => dispatch({ type: 'toggleTask', id, today: todayRef.current }),
      deleteTask: (id) => dispatch({ type: 'deleteTask', id }),
      restoreTask: (id) => dispatch({ type: 'restoreTask', id }),

      addTag: (name, emoji, vocab) => {
        const id = makeId('tag');
        dispatch({ type: 'addTag', id, name, emoji, vocab });
        return id;
      },
      updateTag: (id, patch) => dispatch({ type: 'updateTag', id, patch }),
      deleteTag: (id) => dispatch({ type: 'deleteTag', id }),
      addNote: (tagId, text, definition) => dispatch({ type: 'addNote', id: makeId('note'), tagId, text, definition }),
      deleteNote: (id) => dispatch({ type: 'deleteNote', id }),

      updateSettings: (patch) => dispatch({ type: 'updateSettings', patch }),
      triggerFiveMinuteReset: () => dispatch({ type: 'triggerFiveMinuteReset', roll: Math.random(), now: Date.now() }),
      completeFiveMinuteReset: () => dispatch({ type: 'completeFiveMinuteReset', today: todayRef.current }),
      dismissFiveMinuteReset: () => dispatch({ type: 'dismissFiveMinuteReset' }),
      toggleAssistantPanel: () => dispatch({ type: 'toggleAssistantPanel' }),

      startFocus: (occurrence, rhythm, sound) => dispatch({ type: 'startFocus', occurrence, rhythm, sound, now: Date.now() }),
      pauseFocus: () => dispatch({ type: 'pauseFocus', now: Date.now() }),
      resumeFocus: () => dispatch({ type: 'resumeFocus', now: Date.now() }),
      finishFocus: () => dispatch({ type: 'finishFocus', now: Date.now(), today: todayRef.current }),
      reviewCard: (noteId, knew) => dispatch({ type: 'reviewCard', id: noteId, knew, today: todayRef.current }),
      dismissWeeklySummary: () => dispatch({ type: 'dismissWeeklySummary', today: todayRef.current }),
      clearTutorial: () => dispatch({ type: 'clearTutorial' }),
      applyRemoteState: (remote) => dispatch({ type: 'replaceState', state: rollover(remote, todayRef.current) }),

      importBackup: (text) => {
        const imported = parseImport(text);
        if (!imported) {
          dispatch({ type: 'setNotice', notice: 'import-failed' });
          return false;
        }
        dispatch({ type: 'replaceState', state: rollover(imported, todayRef.current) });
        return true;
      },
      resetToStarter: () => dispatch({ type: 'replaceState', state: createStarterState(todayRef.current, minutesOf(new Date())) }),
      dismissNotice: () => dispatch({ type: 'setNotice', notice: null }),
      capture: (lines) => {
        const ids = [...lines.map(({ intent }) => makeId(ID_PREFIX[intent.kind === 'block' && intent.repeat ? 'series' : intent.kind])), makeId('cap')];
        const at = Date.now();
        const { receipt } = applyCapture(stateRef.current, lines, ids, at);
        if (receipt.count > 0) dispatch({ type: 'capture', lines, ids, at });
        return receipt;
      },
      undoCapture: (receipt) => dispatch({ type: 'undoCapture', receipt }),
    }),
    [],
  );

  const value = useMemo(
    () => ({ state, now, today, nowMinutes: minutesOf(now), ...actions }),
    [state, now, today, actions],
  );
  return <VesperaContext.Provider value={value}>{children}</VesperaContext.Provider>;
}

export function useVespera(): VesperaContextValue {
  const ctx = useContext(VesperaContext);
  if (!ctx) throw new Error('useVespera must be used inside <VesperaProvider>');
  return ctx;
}
