import { SCHEMA_VERSION, toStored } from '../context/schema';
import { createStarterState } from '../context/seed';
import { persistable } from '../context/storage';
import { createSeedState } from '../test/ownerWeek';
import {
  boardBytes,
  canonicalJson,
  classifySyncFailure,
  decideFirstSync,
  hasUserContent,
  MAX_BOARD_BYTES,
  resolveConflict,
  rowIsFromTheFuture,
  storedBoard,
  SyncRefusal,
  syncFingerprint,
  toMillis,
} from './logic';

describe('hasUserContent', () => {
  it('ignores an untouched starter guide', () => {
    expect(hasUserContent(createStarterState('2026-11-12', 600))).toBe(false);
  });

  it('counts anything the person made or did', () => {
    const starter = createStarterState('2026-11-12', 600);
    expect(hasUserContent({ ...starter, tasks: [...starter.tasks, { id: 'mine', title: 'x', categoryId: 'cat-work', done: false }] })).toBe(true);
    expect(hasUserContent({ ...starter, activity: { '2026-11-12': { quests: 1, spells: 0, focusMinutes: 0, cards: 0 } } })).toBe(true);
    expect(hasUserContent(createSeedState())).toBe(true);
  });

  it('counts archived history, so a board with only old months isn’t treated as empty', () => {
    const starter = createStarterState('2026-11-12', 600);
    expect(hasUserContent({ ...starter, chronicleArchive: [{ month: '2026-03', total: 2, byCategory: { 'cat-work': 2 }, titles: ['A', 'B'] }] })).toBe(true);
    expect(hasUserContent({ ...starter, activityArchive: [{ month: '2026-03', quests: 4, spells: 0, focusMinutes: 25, cards: 0 }] })).toBe(true);
  });
});

describe('decideFirstSync', () => {
  const remote = { state: {}, updatedAt: '2026-11-12T10:00:00Z' };

  it('uses the cloud board whenever there is one', () => {
    expect(decideFirstSync({ remote, guestHasContent: true, accountCacheExists: true })).toBe('use-remote');
  });

  it('re-uploads this device’s copy of the account if the cloud row is missing', () => {
    expect(decideFirstSync({ remote: null, guestHasContent: true, accountCacheExists: true })).toBe('upload-account-cache');
  });

  it('asks before bringing a signed-out board into a new account', () => {
    expect(decideFirstSync({ remote: null, guestHasContent: true, accountCacheExists: false })).toBe('ask');
  });

  it('starts a brand-new account from the starter guide', () => {
    expect(decideFirstSync({ remote: null, guestHasContent: false, accountCacheExists: false })).toBe('starter');
  });
});

describe('resolveConflict', () => {
  it('keeps whichever side changed last', () => {
    expect(resolveConflict(Date.parse('2026-11-12T10:05:00Z'), '2026-11-12T10:00:00Z')).toBe('local');
    expect(resolveConflict(Date.parse('2026-11-12T10:00:00Z'), '2026-11-12T10:05:00Z')).toBe('remote');
  });
});

describe('toMillis', () => {
  it('reads both PostgREST and Realtime timestamp styles', () => {
    const iso = Date.parse('2026-11-12T10:00:00.123Z');
    expect(toMillis('2026-11-12T10:00:00.123456+00:00')).toBe(iso);
    expect(toMillis('2026-11-12 10:00:00.123456+00')).toBe(iso);
  });
});

describe('boardBytes (VB-04)', () => {
  it('counts what Postgres counts for jsonb::text, spaces and multibyte letters included', () => {
    // select '{"a":1,"b":[1,2]}'::jsonb::text → {"a": 1, "b": [1, 2]}
    expect(boardBytes({ a: 1, b: [1, 2] })).toBe('{"a": 1, "b": [1, 2]}'.length);
    expect(boardBytes({ é: 'ü' })).toBe(new TextEncoder().encode('{"é": "ü"}').length);
    expect(boardBytes({ a: undefined, b: [] , c: {} })).toBe('{"b": [], "c": {}}'.length);
  });

  it('puts the limit where the migration does', () => {
    expect(MAX_BOARD_BYTES).toBe(2_000_000);
  });
});

describe('classifySyncFailure (VB-04)', () => {
  it.each([
    ['a size check violation', { code: '23514', message: 'violates check constraint "user_states_state_size"' }, true, { status: 'error', problem: 'too-large' }],
    ['another server refusal', { code: '42501', message: 'permission denied' }, true, { status: 'error', problem: 'refused' }],
    ['a refusal made before sending', new SyncRefusal('too-large'), false, { status: 'error', problem: 'too-large' }],
    ['a failed fetch', { code: '', message: 'TypeError: Failed to fetch' }, true, { status: 'offline' }],
    ['a thrown TypeError', new TypeError('Failed to fetch'), true, { status: 'offline' }],
    ['anything while the browser is offline', { code: '23514' }, false, { status: 'offline' }],
    ['the database refusing a schema downgrade (0003)', { code: 'VSP01', message: 'schema downgrade' }, true, { status: 'update-required' }],
    ['a schema downgrade even if the browser now reads offline', { code: 'VSP01', message: 'schema downgrade' }, false, { status: 'update-required' }],
  ])('%s', (_, err, online, expected) => {
    expect(classifySyncFailure(err, online)).toEqual(expected);
  });
});

describe('rowIsFromTheFuture (the version guard)', () => {
  const at = '2026-11-12T10:00:00Z';
  it('spots a board written by newer Vespera, by its own schemaVersion or the row’s schema_version', () => {
    expect(rowIsFromTheFuture({ state: { version: 2, schemaVersion: SCHEMA_VERSION + 1 }, updatedAt: at })).toBe(true);
    expect(rowIsFromTheFuture({ state: { version: 2 }, schemaVersion: SCHEMA_VERSION + 1, updatedAt: at })).toBe(true);
  });

  it('lets this version’s boards and older ones through', () => {
    expect(rowIsFromTheFuture({ state: { version: 2, schemaVersion: SCHEMA_VERSION }, schemaVersion: SCHEMA_VERSION, updatedAt: at })).toBe(false);
    expect(rowIsFromTheFuture({ state: { version: 2 }, schemaVersion: 2, updatedAt: at })).toBe(false);
    expect(rowIsFromTheFuture({ state: { version: 2 }, updatedAt: at })).toBe(false);
  });
});

describe('storedBoard and syncFingerprint', () => {
  it('send exactly the stored form of the persistable board', () => {
    const board = { ...createSeedState(), notice: 'save-repaired' as const };
    expect(storedBoard(board)).toEqual(toStored(persistable(board)));
    expect(syncFingerprint(board)).toBe(canonicalJson(toStored(persistable(board))));
  });

  it('ignore what never syncs (notices) and key order', () => {
    const board = createSeedState();
    const reordered = Object.fromEntries(Object.entries(board).reverse()) as typeof board;
    expect(syncFingerprint({ ...reordered, notice: 'save-repaired' })).toBe(syncFingerprint(board));
  });
});
