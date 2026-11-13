import { isFromTheFuture, LEGACY_SCHEMA_VERSION, SCHEMA_VERSION, schemaVersionOf, fromStored, toStored } from './schema';
import { sanitizeBoard } from './sanitize';
import { createBaseState, createStarterState, DEFAULT_SETTINGS } from './seed';
import { everyFieldBoard } from './testBoards';
import type { VesperaState } from './types';
import { createSeedState } from '../test/ownerWeek';

describe('schema versions', () => {
  it('new boards carry the current schema version', () => {
    expect(createBaseState('2026-11-12').schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('reads a stored version, treating missing or odd values as the legacy version', () => {
    expect(schemaVersionOf({ schemaVersion: 3 })).toBe(3);
    expect(schemaVersionOf({ schemaVersion: 7 })).toBe(7);
    for (const odd of [{}, { schemaVersion: '9' }, { schemaVersion: 2.5 }, { schemaVersion: 1 }, null, 'x']) {
      expect(schemaVersionOf(odd)).toBe(LEGACY_SCHEMA_VERSION);
    }
  });

  it('spots boards written by newer code', () => {
    expect(isFromTheFuture({ schemaVersion: SCHEMA_VERSION + 1 })).toBe(true);
    expect(isFromTheFuture({ schemaVersion: SCHEMA_VERSION })).toBe(false);
    expect(isFromTheFuture({})).toBe(false);
  });
});

/** Through the stored form and back, the way a save or a sync does it. */
const roundTrip = (s: VesperaState) => fromStored(JSON.parse(JSON.stringify(toStored(s))));

describe('sparse stored format', () => {
  it.each([
    ['the owner fixture', createSeedState()],
    ['the starter board', createStarterState('2026-11-12', 600)],
    ['an empty board', createBaseState('2026-11-12')],
    ['a board with every optional field set', everyFieldBoard()],
  ])('round-trips %s exactly', (_name, board) => {
    expect(roundTrip(board)).toStrictEqual(board);
  });

  it('round-trips transient fields too (callers strip them with persistable)', () => {
    const board: VesperaState = {
      ...createBaseState('2026-11-12'),
      focusVeil: { action: 'x', taskId: null, endsAt: 1 },
      notice: 'save-repaired',
      captureLog: [{ id: 'c', text: 't', summary: 's', at: 1 }],
    };
    expect(roundTrip(board)).toStrictEqual(board);
  });

  it('leaves out defaults and empty fields but keeps version, schemaVersion, ids and the date', () => {
    const stored = toStored(createStarterState('2026-11-12', 600)) as Record<string, unknown>;
    expect(stored.version).toBe(2);
    expect(stored.schemaVersion).toBe(SCHEMA_VERSION);
    expect(stored.lastRolloverDate).toBe('2026-11-12');
    for (const key of ['settings', 'focusVeil', 'notice', 'activity', 'focusSession', 'lastSummaryWeek', 'captureLog', 'chronicleArchive', 'activityArchive', 'assistant']) {
      expect(stored).not.toHaveProperty(key);
    }
    const tasks = stored.tasks as Record<string, unknown>[];
    expect(tasks[0]).toEqual({ id: 'tut-task-seal', categoryId: 'tut-cat-start', title: expect.any(String) });
    expect((stored.categories as Record<string, unknown>[])[0]).not.toHaveProperty('archived');
    expect((stored.noteTags as Record<string, unknown>[])[0]).not.toHaveProperty('vocab');
  });

  it('keeps every setting that differs from its default, and only those', () => {
    const stored = toStored(everyFieldBoard()) as { settings: Record<string, unknown> };
    expect(stored.settings).toEqual({ unstickActions: [], volume: 0, sparkles: false, lateOfferMinutes: 0, signet: { color: 'sage', emblem: 'initial', initial: 'Q' } });
  });

  it('never drops an optional field, whatever its value (absence means "not set")', () => {
    const stored = toStored(everyFieldBoard()) as Record<string, Record<string, unknown>[]>;
    expect(stored.blocks[1]).toMatchObject({ timeLabel: '', note: '' });
    expect(stored.categories[0]).toMatchObject({ blurb: '' });
    expect((stored.exceptions as unknown as VesperaState['exceptions']).s1['2026-11-09']).toEqual({ skipped: false, begun: false, overrides: { start: null, end: null, timeLabel: '', note: '' } });
  });

  it('keeps the lists and exceptions an older reader needs, even when empty, so older code can still read it', () => {
    const empty = { ...createBaseState('2026-11-12'), categories: [], noteTags: [] };
    const stored = toStored(empty) as Record<string, unknown>;
    for (const key of ['blocks', 'series', 'exceptions', 'categories', 'tasks', 'chronicle', 'noteTags', 'notes']) expect(stored).toHaveProperty(key);
    // A reader without fromStored (the pre-Wave-3 sanitizer) still gets the whole board back.
    const owner = createSeedState();
    expect(sanitizeBoard(JSON.parse(JSON.stringify(toStored(owner))))?.state).toStrictEqual(owner);
  });

  it('drops zero counts from activity days', () => {
    const stored = toStored(everyFieldBoard()) as { activity: Record<string, unknown> };
    expect(stored.activity).toEqual({ '2026-11-10': { quests: 2 }, '2026-11-11': {} });
  });

  it('does not change the board it is given', () => {
    const board = everyFieldBoard();
    const copy = structuredClone(board);
    toStored(board);
    expect(board).toStrictEqual(copy);
  });

  it('fromStored leaves odd values for the sanitizer and never throws', () => {
    for (const odd of [null, 7, 'x', [], { version: 2, tasks: 'nope', settings: 5, activity: [1] }, { version: 2, tasks: [null, 3, { id: 'a' }] }]) {
      expect(() => fromStored(odd)).not.toThrow();
    }
    expect(fromStored({ version: 2, tasks: 'nope' })).toMatchObject({ tasks: 'nope' });
    expect((fromStored({ version: 2, tasks: [null, { id: 'a' }] }) as { tasks: unknown[] }).tasks).toEqual([null, { id: 'a', done: false }]);
  });

  it('restores the defaults of this format even if a default changes later', () => {
    const restored = fromStored({ version: 2, schemaVersion: 3, lastRolloverDate: '2026-11-12', blocks: [], series: [], exceptions: {}, categories: [], tasks: [], chronicle: [], noteTags: [], notes: [] }) as VesperaState;
    expect(restored.settings).toStrictEqual(DEFAULT_SETTINGS);
    expect(restored.settings).not.toBe(DEFAULT_SETTINGS);
    expect(restored.settings.unstickActions).not.toBe(DEFAULT_SETTINGS.unstickActions);
  });
});

const ownerJson = JSON.stringify(createSeedState()).length;
const ownerSparse = JSON.stringify(toStored(createSeedState())).length;
const saving = Math.round((1 - ownerSparse / ownerJson) * 100);

it(`stores the owner fixture smaller: ${ownerJson} → ${ownerSparse} characters (${saving}% saved)`, () => {
  expect(ownerSparse).toBeLessThan(ownerJson);
});
