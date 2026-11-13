// Pure decisions behind cloud sync.
import { isFromTheFuture, SCHEMA_VERSION, toStored } from '../context/schema';
import { isTutorialId } from '../context/seed';
import { persistable } from '../context/storage';
import type { VesperaState } from '../context/types';
import type { RemoteRow } from './types';

/** The board exactly as it is sent to the cloud (and cached on the device): the lean stored form. */
export function storedBoard(state: VesperaState): unknown {
  return toStored(persistable(state));
}

/** What sync compares, on both sides: the stored form, as canonical JSON. */
export function syncFingerprint(state: VesperaState): string {
  return canonicalJson(storedBoard(state));
}

/**
 * True when a cloud row was written by newer Vespera than this device runs (its board's `schemaVersion`
 * or the row's `schema_version` column is ahead). This device must neither apply it nor write over it.
 */
export function rowIsFromTheFuture(row: RemoteRow): boolean {
  return isFromTheFuture(row.state) || (typeof row.schemaVersion === 'number' && row.schemaVersion > SCHEMA_VERSION);
}

/** True if a board holds anything the person made or did (an untouched starter guide doesn't count). */
export function hasUserContent(state: VesperaState): boolean {
  const own = <T extends { id: string }>(items: T[]) => items.some((i) => !isTutorialId(i.id));
  return (
    own(state.tasks) ||
    own(state.blocks) ||
    own(state.series) ||
    own(state.notes) ||
    state.chronicle.length > 0 ||
    Object.keys(state.activity).length > 0 ||
    state.chronicleArchive.length > 0 ||
    state.activityArchive.length > 0
  );
}

export type FirstSyncDecision = 'use-remote' | 'upload-account-cache' | 'ask' | 'starter';

/**
 * What to do the first time an account syncs on this device:
 * the cloud board wins if there is one; a cached copy of this account is re-uploaded;
 * a signed-out board with real content is only brought in after asking; otherwise start fresh.
 */
export function decideFirstSync({
  remote,
  guestHasContent,
  accountCacheExists,
}: {
  remote: RemoteRow | null;
  guestHasContent: boolean;
  accountCacheExists: boolean;
}): FirstSyncDecision {
  if (remote) return 'use-remote';
  if (accountCacheExists) return 'upload-account-cache';
  return guestHasContent ? 'ask' : 'starter';
}

/** Two devices edited at once: whichever changed last wins (the loser is kept as a local backup). */
export function resolveConflict(localEditedAt: number, remoteUpdatedAt: string): 'local' | 'remote' {
  return localEditedAt >= toMillis(remoteUpdatedAt) ? 'local' : 'remote';
}

/** JSON with object keys sorted, so equal boards always serialize identically. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v,
  );
}

/** The server refuses a board of this many bytes or more (`octet_length(state::text)` in supabase/migrations/0001). */
export const MAX_BOARD_BYTES = 2_000_000;

/** The bytes Postgres counts for a board: its JSON as `jsonb::text`, which puts a space after every `,` and `:`. */
export function boardBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length + separators(value);
}

function separators(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((n: number, item) => n + separators(item), Math.max(0, value.length - 1));
  if (value && typeof value === 'object') {
    const kept = Object.values(value).filter((v) => v !== undefined && typeof v !== 'function');
    return kept.reduce((n: number, item) => n + separators(item), kept.length ? kept.length * 2 - 1 : 0);
  }
  return 0;
}

/**
 * Why the cloud said no, when it wasn't just a dropped connection.
 * 'no-room': edits made while sync was paused couldn't be set aside, so syncing waits rather than replace them.
 */
export type SyncProblem = 'too-large' | 'refused' | 'unreadable' | 'no-room';

/** A sync step Vespera refuses itself, before or after talking to the server. */
export class SyncRefusal extends Error {
  readonly problem: SyncProblem;
  constructor(problem: SyncProblem) {
    super(problem);
    this.problem = problem;
  }
}

/** SQLSTATE the database raises when a write would lower a board's schema version (supabase/migrations/0003). */
export const SCHEMA_DOWNGRADE_CODE = 'VSP01';

/**
 * Was a failed sync a network hiccup (stay "offline" and retry), a refusal the person should hear about,
 * or the database saying newer Vespera already wrote this board (pause and ask to reload)?
 * PostgREST and Postgres errors carry a `code` (`23514` = the size check); network failures don't.
 */
export function classifySyncFailure(
  err: unknown,
  online: boolean,
): { status: 'offline' } | { status: 'update-required' } | { status: 'error'; problem: SyncProblem } {
  if (err instanceof SyncRefusal) return { status: 'error', problem: err.problem };
  const code = (err as { code?: unknown } | null)?.code;
  if (code === SCHEMA_DOWNGRADE_CODE) return { status: 'update-required' }; // only the server says this, so it was reached
  if (!online) return { status: 'offline' };
  if (typeof code === 'string' && code !== '') return { status: 'error', problem: code === '23514' ? 'too-large' : 'refused' };
  return { status: 'offline' };
}

/** Parse Postgres timestamps in either "2026-11-12T10:00:00.123456+00:00" or "2026-11-12 10:00:00.123456+00" style. */
export function toMillis(timestamp: string): number {
  const normalized = timestamp
    .replace(' ', 'T')
    .replace(/(\.\d{3})\d+/, '$1')
    .replace(/([+-]\d{2})$/, '$1:00');
  return Date.parse(normalized);
}
