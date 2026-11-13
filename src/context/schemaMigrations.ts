// Upgrades a stored board, one schema version at a time. Every step is strictly additive with safe
// defaults: it may add fields and fold old history into archives (owner decision), never remove or
// rename what a person made. Runs after `fromStored` and before `sanitizeBoard` (see storage.ts).
import { compactBoard } from './compact';
import { isDateKey } from './dates';
import { isFromTheFuture, SCHEMA_VERSION, schemaVersionOf } from './schema';
import type { VesperaState } from './types';

type Obj = Record<string, unknown>;
export type Migration = (raw: Obj) => Obj;

const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);

/** `MIGRATIONS[n]` upgrades a board from version n to n + 1. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  /** 2 → 3: the schema version and the Chronicle and activity archives, then the first compaction. */
  2: (raw) => {
    const board: Obj = {
      ...raw,
      schemaVersion: 3,
      chronicleArchive: Array.isArray(raw.chronicleArchive) ? raw.chronicleArchive : [],
      activityArchive: Array.isArray(raw.activityArchive) ? raw.activityArchive : [],
    };
    // A stored board has no clock, so it compacts against its own last rollover; the next
    // rollover catches up to the real today.
    if (!isDateKey(raw.lastRolloverDate) || !Array.isArray(raw.chronicle) || !(raw.activity === undefined || isObj(raw.activity))) return board;
    const compactable = { ...board, activity: raw.activity ?? {} } as unknown as VesperaState;
    const compacted = compactBoard(compactable, raw.lastRolloverDate);
    return compacted === compactable ? board : (compacted as unknown as Obj);
  },
};

/**
 * The stored board upgraded to `to` (the current version), running each step in order.
 * Current boards, boards from the future and non-boards come back untouched. Throws when a
 * step is missing, so a board is never half-upgraded and passed off as current.
 */
export function migrateStored(raw: unknown, { to = SCHEMA_VERSION, migrations = MIGRATIONS }: { to?: number; migrations?: Readonly<Record<number, Migration>> } = {}): unknown {
  if (!isObj(raw) || isFromTheFuture(raw)) return raw;
  let board = raw;
  for (let v = schemaVersionOf(raw); v < to; v++) {
    const step = migrations[v];
    if (!step) throw new Error(`No migration from schema version ${v}`);
    board = { ...step(board), schemaVersion: v + 1 };
  }
  return board;
}
