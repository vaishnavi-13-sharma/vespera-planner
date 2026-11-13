import { migrateV1 } from './migrate';
import { occurrencesForDate } from './recurrence';
import { createStarterState } from './seed';
import { toStored } from './schema';
import { exportState, loadState, migrationBackupKey, parseImport, parseState, persistable, saveState, STORAGE_KEY, STORAGE_KEY_V1, unreadableBackupKey, userStorageKey } from './storage';
import { everyFieldBoard } from './testBoards';
import { createSeedState } from '../test/ownerWeek';

/** A v1 save, as written by Vespera v1 (trimmed). */
function v1Fixture() {
  return {
    version: 1,
    blocks: [
      { id: 'blk-wed-cook', day: 'wed', title: 'Unpack Groceries, Cook & Eat', kind: 'flexible', start: 1080, end: 1125 },
      { id: 'blk-thu-desk', day: 'thu', title: 'Job 2: Bookshop Shift (Use for Essay Polish & Exam)', kind: 'anchor', start: 540, end: 780 },
      { id: 'blk-tue-meeting', day: 'wed', title: 'Fixed Research Team Meeting & Presentation', kind: 'anchor', start: 660, end: 690 },
      { id: 'blk-sat-gre', day: 'sat', title: 'Exam Module 2', kind: 'focus', start: null, end: null, timeLabel: 'Flexible' },
      { id: 'blk-user-1', day: 'mon', title: 'Laundry', kind: 'flexible', start: 600, end: 630 },
    ],
    tasks: [
      { id: 'task-sweep', title: 'Sweep', category: 'reset', done: true },
      { id: 'task-x', title: 'Mine', category: 'job2', done: false },
    ],
    notes: [
      { id: 'n1', kind: 'grocery', text: 'Oat milk' },
      { id: 'n2', kind: 'vocab', text: 'Laconic', definition: 'Terse.' },
    ],
    focusVeil: null,
    assistant: { panelOpen: true },
  };
}

describe('migrateV1', () => {
  const v2 = migrateV1(v1Fixture(), '2026-11-12');

  it('maps v1 day keys onto the real week of Nov 11–17', () => {
    expect(v2.blocks.find((b) => b.id === 'blk-wed-cook')).toMatchObject({ date: '2026-11-11', start: 1080 });
    expect(v2.blocks.find((b) => b.id === 'blk-user-1')).toMatchObject({ date: '2026-11-16', title: 'Laundry' });
    expect(v2.blocks.find((b) => b.id === 'blk-sat-gre')).toMatchObject({ date: '2026-11-14', timeLabel: 'Flexible' });
  });

  it('turns the known recurring blocks into weekly series when still on their day', () => {
    expect(v2.series.find((s) => s.id === 'ser-thu-desk')).toMatchObject({ startDate: '2026-11-12', repeat: { freq: 'weekly', interval: 1, weekdays: [4] } });
    expect(occurrencesForDate(v2, '2026-11-19').map((o) => o.title)).toContain('Job 2: Bookshop Shift (Use for Essay Polish & Exam)');
  });

  it('keeps a recurring block the user moved to another day as a one-off', () => {
    expect(v2.blocks.find((b) => b.id === 'blk-tue-meeting')).toMatchObject({ date: '2026-11-11' });
    expect(v2.series.some((s) => s.id === 'ser-tue-meeting')).toBe(false);
  });

  it('converts categories, tags, quests and notes to ids', () => {
    expect(v2.categories.map((c) => c.id)).toEqual(['cat-reset', 'cat-job1', 'cat-grad', 'cat-job2']);
    expect(v2.tasks).toEqual([
      { id: 'task-sweep', title: 'Sweep', categoryId: 'cat-reset', done: true, completedOn: '2026-11-12' },
      { id: 'task-x', title: 'Mine', categoryId: 'cat-job2', done: false },
    ]);
    expect(v2.notes).toEqual([
      { id: 'n1', tagId: 'tag-grocery', text: 'Oat milk' },
      { id: 'n2', tagId: 'tag-vocab', text: 'Laconic', definition: 'Terse.' },
    ]);
    expect(v2.assistant).toEqual({ panelOpen: true });
    expect(v2.lastRolloverDate).toBe('2026-11-12');
  });

  it('throws on something that is not a v1 save', () => {
    expect(() => migrateV1({ version: 1 }, '2026-11-12')).toThrow();
  });
});

describe('loadState / saveState', () => {
  it('starts from the Welcome to Vespera starter guide when nothing is stored', () => {
    expect(loadState(localStorage, '2026-11-12', { nowMinutes: 600 })).toEqual(createStarterState('2026-11-12', 600));
  });

  it('starts a signed-in account’s cache from the starter guide, never from v1 data', () => {
    localStorage.setItem(STORAGE_KEY_V1, JSON.stringify({ version: 1, blocks: [], tasks: [], notes: [] }));
    expect(loadState(localStorage, '2026-11-12', { key: userStorageKey('u1') }).categories[0].id).toBe('tut-cat-start');
  });

  it('reads and writes per-account caches separately', () => {
    saveState({ ...createSeedState(), tasks: [] }, localStorage, userStorageKey('u1'));
    expect(loadState(localStorage, '2026-11-12', { key: userStorageKey('u1') }).tasks).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('round-trips a v2 save without the focus veil or notice', () => {
    const state = { ...createSeedState(), focusVeil: { action: 'x', taskId: null, endsAt: 1 }, notice: 'import-failed' as const };
    saveState(state, localStorage);
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(raw.focusVeil ?? null).toBeNull();
    expect(raw.notice ?? null).toBeNull();
    expect(loadState(localStorage, '2026-11-12')).toEqual(createSeedState());
  });

  it('saves the sparse stored form', () => {
    const state = everyFieldBoard();
    saveState(state, localStorage);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(toStored(persistable(state))));
    expect(loadState(localStorage, '2026-11-12')).toStrictEqual(persistable(state));
  });

  it('still loads a full (pre-sparse) save', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable(everyFieldBoard())));
    expect(loadState(localStorage, '2026-11-12')).toStrictEqual(persistable(everyFieldBoard()));
  });

  it('upgrades a v1 save and leaves the v1 copy untouched', () => {
    const v1 = JSON.stringify(v1Fixture());
    localStorage.setItem(STORAGE_KEY_V1, v1);
    const state = loadState(localStorage, '2026-11-12');
    expect(state.version).toBe(2);
    expect(state.tasks.find((t) => t.id === 'task-x')).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY_V1)).toBe(v1);
  });

  it('falls back to the starter guide with a gentle notice when the v1 upgrade fails', () => {
    localStorage.setItem(STORAGE_KEY_V1, JSON.stringify({ version: 1 }));
    const state = loadState(localStorage, '2026-11-12');
    expect(state.notice).toBe('migration-failed');
    expect(state.categories[0].id).toBe('tut-cat-start');
  });

  it('fills in settings added later', () => {
    const { settings: _s, ...noSettings } = createSeedState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...noSettings, settings: { focusMinutes: 10 } }));
    expect(loadState(localStorage, '2026-11-12').settings).toMatchObject({ focusMinutes: 10, dayStart: 420, lateOfferMinutes: 10 });
  });
});

describe('export / import', () => {
  it('round-trips through JSON', () => {
    const state = createSeedState();
    expect(parseImport(exportState(state))).toEqual(state);
  });

  it('exports the sparse stored form, still readable and indented', () => {
    const state = everyFieldBoard();
    expect(exportState(state)).toBe(JSON.stringify(toStored(persistable(state)), null, 2));
    expect(parseImport(exportState(state))).toStrictEqual(persistable(state));
  });

  it('imports a backup exported before the sparse format', () => {
    const { schemaVersion: _v, chronicleArchive: _c, activityArchive: _a, ...legacy } = persistable(createSeedState());
    expect(parseImport(JSON.stringify(legacy, null, 2))).toStrictEqual(createSeedState());
  });

  it('parseState accepts sparse and full boards alike', () => {
    const state = persistable(everyFieldBoard());
    expect(parseState(toStored(state))).toStrictEqual(state);
    expect(parseState(JSON.parse(JSON.stringify(state)))).toStrictEqual(state);
  });

  it('rejects anything that is not a v2 backup', () => {
    expect(parseImport('not json')).toBeNull();
    expect(parseImport(JSON.stringify({ version: 1 }))).toBeNull();
    expect(parseImport(JSON.stringify({ ...createSeedState(), tasks: 'nope' }))).toBeNull();
    expect(parseImport(JSON.stringify({ ...createSeedState(), exceptions: null }))).toBeNull();
    expect(parseImport(JSON.stringify([1, 2]))).toBeNull();
  });

  it('leaves out a single item it cannot read and keeps the rest of the board', () => {
    const seed = createSeedState();
    const parsed = parseImport(JSON.stringify({ ...seed, tasks: [{ id: 5 }, ...seed.tasks] }));
    expect(parsed?.tasks).toEqual(seed.tasks);
  });
});

describe('an unreadable save (CG-01)', () => {
  const cutOff = () => {
    const json = JSON.stringify(createSeedState());
    return json.slice(0, -20);
  };

  it('is copied aside under its own key, once, however often it is read', () => {
    const raw = cutOff();
    localStorage.setItem(STORAGE_KEY, raw);
    expect(loadState(localStorage, '2026-11-12').notice).toBe('save-unreadable');
    loadState(localStorage, '2026-11-12');
    expect(localStorage.getItem(unreadableBackupKey(STORAGE_KEY, raw))).toBe(raw);
    expect(localStorage.length).toBe(2);
  });

  it('is copied aside for a signed-in account too, under that account’s key', () => {
    const key = userStorageKey('u1');
    const raw = cutOff();
    localStorage.setItem(key, raw);
    const state = loadState(localStorage, '2026-11-12', { key });
    expect(state.notice).toBe('save-unreadable');
    expect(unreadableBackupKey(key, raw).startsWith(key)).toBe(true);
    expect(localStorage.getItem(unreadableBackupKey(key, raw))).toBe(raw);
  });

  it('loads a board with one unreadable item, says so, and keeps the original text', () => {
    const seed = createSeedState();
    const raw = JSON.stringify({ ...seed, notes: [{ id: 7, text: 'oops' }, ...seed.notes] });
    localStorage.setItem(STORAGE_KEY, raw);
    const state = loadState(localStorage, '2026-11-12');
    expect(state.notice).toBe('save-repaired');
    expect(state.notes).toEqual(seed.notes);
    expect(localStorage.getItem(unreadableBackupKey(STORAGE_KEY, raw))).toBe(raw);
  });

  it('is never overwritten while storage is too full to copy it aside', () => {
    const raw = cutOff();
    const store = new Map<string, string>([[STORAGE_KEY, raw]]);
    let full = true;
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (full) throw new Error('QuotaExceededError');
        store.set(k, v);
      },
    };
    const state = loadState(storage, '2026-11-12');
    saveState(state, storage);
    expect(store.get(STORAGE_KEY)).toBe(raw);

    full = false; // space freed: the copy is made first, then the new board is saved
    saveState(state, storage);
    expect(store.get(unreadableBackupKey(STORAGE_KEY, raw))).toBe(raw);
    expect(JSON.parse(store.get(STORAGE_KEY)!).version).toBe(2);
  });
});

describe('Build B additions', () => {
  it('fills in delight fields for saves made before Build B', () => {
    const { activity: _a, focusSession: _f, lastSummaryWeek: _l, ...older } = createSeedState();
    const settings: Record<string, unknown> = { ...older.settings };
    for (const k of ['sparkles', 'sounds', 'volume', 'seasonal', 'weeklySummary', 'focusRhythm', 'focusSound']) delete settings[k];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...older, settings }));
    const state = loadState(localStorage, '2026-11-12');
    expect(state.activity).toEqual({});
    expect(state.focusSession).toBeNull();
    expect(state.lastSummaryWeek).toBeNull();
    expect(state.settings).toMatchObject({ sparkles: true, sounds: true, volume: 0.5, seasonal: true, weeklySummary: true, focusRhythm: 'pomodoro25', focusSound: 'rain' });
  });

  it('keeps a running focus session across reloads', () => {
    const session = { title: 'x', date: '2026-11-12', occurrenceKey: 'k', rhythm: 'whole' as const, sound: 'off' as const, startedAt: 5, totalMinutes: 60, pausedAt: null, pausedMs: 0 };
    saveState({ ...createSeedState(), focusSession: session }, localStorage);
    expect(loadState(localStorage, '2026-11-12').focusSession).toEqual(session);
  });
});

/** The owner's board as saved before Wave 3 (no schemaVersion, no archives), with one long-finished quest. */
function legacySave(): string {
  const { schemaVersion: _v, chronicleArchive: _c, activityArchive: _a, ...legacy } = persistable(createSeedState());
  return JSON.stringify({ ...legacy, chronicle: [{ id: 'old', title: 'Long ago', categoryId: 'cat-reset', done: true, completedOn: '2026-01-05' }] });
}

/** localStorage-like storage that can be made full, recording every write. */
function fakeStorage(initial: Record<string, string>) {
  const store = new Map(Object.entries(initial));
  const writes: string[] = [];
  const storage = {
    full: false,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (storage.full) throw new Error('QuotaExceededError');
      writes.push(k);
      store.set(k, v);
    },
  };
  return { store, writes, storage };
}

describe('upgrading a saved board (Wave 3 migrations)', () => {
  it('snapshots the exact original text to vespera_backup_v2 before upgrading, then saves the upgrade', () => {
    const raw = legacySave();
    localStorage.setItem(STORAGE_KEY, raw);
    const state = loadState(localStorage, '2026-11-12');
    expect(migrationBackupKey(STORAGE_KEY, 2)).toBe('vespera_backup_v2');
    expect(localStorage.getItem('vespera_backup_v2')).toBe(raw);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw); // untouched until the next save
    expect(state.schemaVersion).toBe(3);
    expect(state.notice).toBeNull();
    expect(state.chronicle).toEqual([]);
    expect(state.chronicleArchive).toEqual([{ month: '2026-01', total: 1, byCategory: { 'cat-reset': 1 }, titles: ['Long ago'] }]);
    expect(state.tasks).toEqual(createSeedState().tasks);

    saveState(state, localStorage);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).schemaVersion).toBe(3);
    expect(loadState(localStorage, '2026-11-12')).toEqual(state);
    expect(localStorage.getItem('vespera_backup_v2')).toBe(raw);
  });

  it('writes the snapshot once, however often the old save is read', () => {
    const raw = legacySave();
    const { writes, storage } = fakeStorage({ [STORAGE_KEY]: raw });
    loadState(storage, '2026-11-12');
    loadState(storage, '2026-11-12');
    expect(writes).toEqual(['vespera_backup_v2']);
  });

  it('snapshots a signed-in account’s board under that account, so sign-out removes it', () => {
    const raw = legacySave();
    localStorage.setItem(userStorageKey('u1'), raw);
    loadState(localStorage, '2026-11-12', { key: userStorageKey('u1') });
    expect(migrationBackupKey(userStorageKey('u1'), 2)).toBe('vespera_backup_v2:u1');
    expect(localStorage.getItem('vespera_backup_v2:u1')).toBe(raw);
    expect(localStorage.getItem('vespera_backup_v2')).toBeNull();
  });

  it('never overwrites an earlier snapshot: a different old save is kept beside it', () => {
    localStorage.setItem('vespera_backup_v2', 'the first original');
    const raw = legacySave();
    localStorage.setItem(STORAGE_KEY, raw);
    loadState(localStorage, '2026-11-12');
    expect(localStorage.getItem('vespera_backup_v2')).toBe('the first original');
    const beside = Object.keys(localStorage).filter((k) => k.startsWith('vespera_backup_v2_'));
    expect(beside.map((k) => localStorage.getItem(k))).toEqual([raw]);
  });

  it('keeps the original untouched and runs in memory while the snapshot can’t be written (storage full)', () => {
    const raw = legacySave();
    const { store, storage } = fakeStorage({ [STORAGE_KEY]: raw });
    storage.full = true;
    const state = loadState(storage, '2026-11-12');
    expect(state.schemaVersion).toBe(3);
    saveState({ ...state, tasks: [] }, storage);
    expect(store.get(STORAGE_KEY)).toBe(raw);

    storage.full = false; // space freed: the snapshot is made first, then the upgraded board is saved
    saveState(state, storage);
    expect(store.get('vespera_backup_v2')).toBe(raw);
    expect(JSON.parse(store.get(STORAGE_KEY)!).schemaVersion).toBe(3);
  });

  it('does not snapshot a board that is already current', () => {
    saveState(createSeedState(), localStorage);
    loadState(localStorage, '2026-11-12');
    expect(Object.keys(localStorage)).toEqual([STORAGE_KEY]);
  });
});

describe('a board saved by a newer Vespera', () => {
  const futureSave = () => JSON.stringify({ ...toStored(persistable(createSeedState())) as object, schemaVersion: 99, somethingNew: { kept: true } });

  it('loads read-only with a notice, never migrated, sanitized away or copied', () => {
    const raw = futureSave();
    localStorage.setItem(STORAGE_KEY, raw);
    const state = loadState(localStorage, '2026-11-12');
    expect(state.notice).toBe('newer-version');
    expect(state.tasks).toEqual(createSeedState().tasks);
    expect(Object.keys(localStorage)).toEqual([STORAGE_KEY]);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it('is never written over, byte for byte', () => {
    const raw = futureSave();
    localStorage.setItem(STORAGE_KEY, raw);
    const state = loadState(localStorage, '2026-11-12');
    saveState({ ...state, tasks: [], notice: null }, localStorage);
    saveState(createStarterState('2026-11-12', 600), localStorage);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it('is never written over even when it arrives after this board loaded (another tab)', () => {
    saveState(createSeedState(), localStorage);
    const raw = futureSave();
    localStorage.setItem(STORAGE_KEY, raw);
    saveState(createSeedState(), localStorage);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it('is kept untouched even when this code cannot read it at all', () => {
    const raw = JSON.stringify({ version: 2, schemaVersion: 99, tasks: 'a new shape' });
    localStorage.setItem(STORAGE_KEY, raw);
    const state = loadState(localStorage, '2026-11-12');
    expect(state.notice).toBe('newer-version');
    saveState(state, localStorage);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it('is not imported from a backup file (that would save a stripped copy)', () => {
    expect(parseImport(futureSave())).toBeNull();
  });
});
