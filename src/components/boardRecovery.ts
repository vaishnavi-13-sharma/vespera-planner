// What the recovery screen does to the boards cached on this device. It runs outside every provider
// (the crash may have come from them), so it works on localStorage directly.
import { browserStorage, createStarterState, minutesOf, parseImport, persistable, STORAGE_KEY, toDateKey, type VesperaState } from '../context/VesperaContext';

/** Where a board is set aside before it is replaced: `${prefix}${time}` (guest) or `${prefix}${time}:${userId}`. */
export const BROKEN_BOARD_PREFIX = `${STORAGE_KEY}_broken_`;

export type RecoveryResult = 'recovered' | 'not-a-backup' | 'no-room' | 'no-storage';

/** The guest board and every account's cached board (not conflict copies or earlier broken copies). */
function boardKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key === STORAGE_KEY || key?.startsWith(`${STORAGE_KEY}:`)) keys.push(key);
  }
  return keys;
}

/**
 * Copy every cached board aside, then put `board` in each one's place (or in the guest slot if
 * nothing was cached). If any copy can't be kept, nothing is replaced.
 */
function replaceBoards(board: VesperaState, now: Date): RecoveryResult {
  const storage = browserStorage() as Storage | undefined;
  let keys: string[];
  try {
    if (!storage) return 'no-storage';
    keys = boardKeys(storage);
  } catch {
    return 'no-storage'; // storage blocked (e.g. privacy mode)
  }
  const copies: string[] = [];
  try {
    for (const key of keys) {
      const copy = `${BROKEN_BOARD_PREFIX}${now.getTime()}${key.slice(STORAGE_KEY.length)}`;
      storage.setItem(copy, storage.getItem(key) ?? '');
      copies.push(copy);
    }
  } catch {
    for (const copy of copies) storage.removeItem(copy);
    return 'no-room';
  }
  try {
    const text = JSON.stringify(persistable(board));
    for (const key of keys.length ? keys : [STORAGE_KEY]) storage.setItem(key, text);
  } catch {
    return 'no-room'; // the copies are already safe
  }
  return 'recovered';
}

/** Replace the cached boards with the "Welcome to Vespera" starter guide, keeping copies. */
export function startFresh(now: Date): RecoveryResult {
  const result = replaceBoards(createStarterState(toDateKey(now), minutesOf(now)), now);
  // Nothing could be stored, so there was nothing to keep: the remounted app starts fresh in memory.
  return result === 'no-storage' ? 'recovered' : result;
}

/** Replace the cached boards with a backup file's board, keeping copies. */
export function restoreBackup(text: string, now: Date): RecoveryResult {
  const board = parseImport(text);
  return board ? replaceBoards(board, now) : 'not-a-backup';
}
