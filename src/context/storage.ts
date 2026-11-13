// localStorage persistence, the v1 → v2 upgrade path, schema migrations, and backup export/import.
// Boards are stored in the sparse format (see schema.ts) and read as: fromStored → migrate → sanitize.
import { migrateV1 } from './migrate';
import { fromStored, isFromTheFuture, SCHEMA_VERSION, schemaVersionOf, toStored } from './schema';
import { migrateStored } from './schemaMigrations';
import { sanitizeBoard, type SanitizedBoard } from './sanitize';
import { createStarterState } from './seed';
import type { DateKey, Notice, VesperaState } from './types';

/** The signed-out (guest) board. Each signed-in account caches under `${STORAGE_KEY}:${userId}`. */
export const STORAGE_KEY = 'vespera_state_v2';
/** v1 data is read once for the upgrade and never written or deleted, so it stays as a backup. */
export const STORAGE_KEY_V1 = 'vespera_state_v1';

export const userStorageKey = (userId: string) => `${STORAGE_KEY}:${userId}`;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function browserStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined; // storage blocked (e.g. privacy mode); run in memory
  }
}

/** Every item checked deeply (see sanitize.ts), so nothing odd reaches the UI. */
function sanitize(parsed: unknown): SanitizedBoard | null {
  try {
    return sanitizeBoard(parsed);
  } catch {
    return null;
  }
}

/** A stored board (sparse or full, any older schema) made whole, upgraded, then every item checked. */
function readBoard(parsed: unknown): SanitizedBoard | null {
  try {
    return sanitize(migrateStored(fromStored(parsed)));
  } catch {
    return null; // a missing migration step: never pass a half-upgraded board off as current
  }
}

/**
 * Validate a parsed board (e.g. from the cloud), sparse or full, repairing or leaving out anything
 * unusable. A board from a newer Vespera (`isFromTheFuture`) is read without migrating, using only
 * the fields this code understands: show it, but never write it back anywhere.
 */
export function parseState(parsed: unknown): VesperaState | null {
  return readBoard(parsed)?.state ?? null;
}

/** FNV-1a of the text, so the same text always lands under the same key. */
function contentHash(raw: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) h = Math.imul(h ^ raw.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}

/**
 * Where an unreadable save is set aside before anything else is written: next to its own key,
 * named by its content so reading the same save twice keeps one copy.
 */
export function unreadableBackupKey(key: string, raw: string): string {
  return `${key}_unreadable_${contentHash(raw)}`;
}

/**
 * Where a save is snapshotted before it is upgraded from schema `version`: `vespera_backup_v{N}`,
 * or `vespera_backup_v{N}:<userId>` for an account's board (so sign-out removes it with the rest).
 */
export function migrationBackupKey(key: string, version: number): string {
  const base = `vespera_backup_v${version}`;
  if (key === STORAGE_KEY) return base;
  if (key.startsWith(`${STORAGE_KEY}:`)) return `${base}${key.slice(STORAGE_KEY.length)}`;
  return `${key}_backup_v${version}`;
}

/** Saves whose copies couldn't be made yet (storage full): key → the original text and where it goes. */
const pending = new Map<string, { raw: string; copies: string[] }>();

/**
 * Copy `raw` to each of `copies` (skipping any that already hold it); true when every copy is
 * safely stored. Until then the original under `key` is the only copy and is never written over.
 */
function keepCopies(storage: StorageLike | undefined, key: string, raw: string, copies: string[]): boolean {
  if (!copies.length) return true;
  try {
    for (const copy of copies) if (storage?.getItem(copy) !== raw) storage?.setItem(copy, raw);
    pending.delete(key);
    return true;
  } catch {
    pending.set(key, { raw, copies });
    return false;
  }
}

/** The snapshot key for `raw`: the plain name, or (if an earlier, different snapshot is there) one beside it. */
function snapshotKey(storage: StorageLike | undefined, key: string, version: number, raw: string): string {
  const base = migrationBackupKey(key, version);
  let existing: string | null | undefined;
  try {
    existing = storage?.getItem(base);
  } catch {
    existing = null;
  }
  return existing == null || existing === raw ? base : `${base}_${contentHash(raw)}`;
}

/** True when stored text claims a newer schema than this code writes. */
function storedIsFromTheFuture(raw: string): boolean {
  // Quick scan first: JSON escapes quotes inside strings, so this pattern only ever matches a key.
  const claims = [...raw.matchAll(/"schemaVersion":\s*(\d+)/g)].some((m) => Number(m[1]) > SCHEMA_VERSION);
  if (!claims) return false;
  try {
    return isFromTheFuture(JSON.parse(raw));
  } catch {
    return false;
  }
}

/**
 * The board stored under `key`. Falls back to upgrading a v1 save (guest board only),
 * then to the "Welcome to Vespera" starter guide. A save that can't be read in full is
 * copied aside first (see `unreadableBackupKey`), an older save is snapshotted before it is
 * upgraded (see `migrationBackupKey`), and neither is overwritten until its copy is safe.
 * A board from a newer Vespera is opened read-only: `saveState` never writes over it.
 */
export function loadState(
  storage: StorageLike | undefined,
  today: DateKey,
  { key = STORAGE_KEY, nowMinutes = 12 * 60 }: { key?: string; nowMinutes?: number } = {},
): VesperaState {
  let raw: string | null | undefined;
  try {
    raw = storage?.getItem(key);
  } catch {
    raw = null;
  }
  let unreadable: Notice | null = null;
  if (raw) {
    let parsed: unknown;
    let board: SanitizedBoard | null = null;
    try {
      parsed = JSON.parse(raw);
      board = readBoard(parsed);
    } catch {
      // not JSON (e.g. cut off mid-write)
    }
    if (isFromTheFuture(parsed)) {
      // Nothing is copied or migrated: the stored text stays exactly as the newer Vespera wrote it.
      return { ...(board?.state ?? createStarterState(today, nowMinutes)), notice: 'newer-version' };
    }
    const copies: string[] = [];
    const from = schemaVersionOf(parsed);
    if (board && from < SCHEMA_VERSION) copies.push(snapshotKey(storage, key, from, raw));
    if (!board || board.dropped > 0) copies.push(unreadableBackupKey(key, raw));
    keepCopies(storage, key, raw, copies);
    if (board) return board.dropped === 0 ? board.state : { ...board.state, notice: 'save-repaired' };
    unreadable = 'save-unreadable';
  }

  if (key !== STORAGE_KEY) return { ...createStarterState(today, nowMinutes), notice: unreadable };

  let rawV1: string | null | undefined;
  try {
    rawV1 = storage?.getItem(STORAGE_KEY_V1);
  } catch {
    rawV1 = null;
  }
  if (rawV1) {
    try {
      return { ...migrateV1(JSON.parse(rawV1), today), notice: unreadable };
    } catch {
      return { ...createStarterState(today, nowMinutes), notice: unreadable ?? 'migration-failed' };
    }
  }
  return { ...createStarterState(today, nowMinutes), notice: unreadable };
}

/** The board as it is persisted (locally and in the cloud): no transient veil or notice. */
export function persistable(state: VesperaState): VesperaState {
  return { ...state, focusVeil: null, notice: null, captureLog: [] };
}

export function saveState(state: VesperaState, storage: StorageLike | undefined, key = STORAGE_KEY): void {
  try {
    const current = storage?.getItem(key);
    // A newer Vespera wrote this board: this device only reads it.
    if (current && storedIsFromTheFuture(current)) return;
    // A save whose copies couldn't be made is the only copy: try again, and keep it if that fails.
    const kept = pending.get(key);
    if (kept && current === kept.raw && !keepCopies(storage, key, kept.raw, kept.copies)) return;
    storage?.setItem(key, JSON.stringify(toStored(persistable(state))));
  } catch {
    // Quota exceeded or storage blocked: keep working in memory.
  }
}

export function exportState(state: VesperaState): string {
  return JSON.stringify(toStored(persistable(state)), null, 2);
}

/**
 * A validated (and, where needed, repaired) state from a backup file's text, or null if it isn't a
 * Vespera v2 backup, or was made by a newer Vespera (importing it here would save a stripped copy).
 */
export function parseImport(text: string): VesperaState | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return isFromTheFuture(parsed) ? null : parseState(parsed);
  } catch {
    return null;
  }
}
