// Offline-first cloud sync. Every board lives in localStorage first (instant, works offline);
// when someone is signed in, SyncProvider keeps their cached board and their Supabase row in step.
//
//   signed out → no board at all: only the `signedOut` element (the sign-in gate). A board saved before
//                sign-in existed (the guest board, `vespera_state_v2`) stays on the device, unread.
//   signed in  → board cached at `vespera_state_v2:<userId>`, pushed ~1.5 s after each change,
//                pulled on load, on window focus, and live via Realtime.
//   sign out   → everything kept for that account (board, backups, the Quick Scribe key) leaves the device,
//                and so does every pre-sign-in copy once the guest board has moved into an account.
//
// Boards travel in their lean stored form (`storedBoard`), and both sides are compared in that form.
// Version guard: a row written by newer Vespera (or a VSP01 "schema downgrade" refusal from the database)
// pauses sync as 'update-required' until reload. Nothing is applied or pushed; edits stay on this device.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { removeOracleKey } from '../ai/oracleKey';
import { isFromTheFuture } from '../context/schema';
import { createStarterState } from '../context/seed';
import { browserStorage, loadState, parseState, saveState, STORAGE_KEY, STORAGE_KEY_V1, userStorageKey } from '../context/storage';
import { minutesOf, toDateKey } from '../context/dates';
import { useVespera, VesperaProvider } from '../context/VesperaContext';
import type { VesperaState } from '../context/types';
import { useToast } from '../components/ui/Toast';
import { friendlyAuthError } from './authErrors';
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
  type SyncProblem,
} from './logic';
import { getDefaultBackend } from './supabaseBackend';
import type { RemoteRow, SyncBackend, SyncUser } from './types';

/** 'update-required': newer Vespera wrote this account's board, so this device paused syncing until it reloads. */
export type SyncStatus = 'local-only' | 'signed-out' | 'syncing' | 'synced' | 'offline' | 'error' | 'update-required';

/** 'unsynced': some changes haven't reached the cloud, so nothing happened; ask, then call again with `force`. */
export type SignOutResult = 'signed-out' | 'unsynced';

/**
 * 'moved': the earlier board is the account's board, in the cloud too, and has left the guest key.
 * 'pending': it is the account's board on this device, and syncs when it can; the guest copy stays until then.
 * 'refused': nothing changed (no earlier board, no room for the backup, or sync is paused).
 */
export type BringGuestResult = 'moved' | 'pending' | 'refused';

export interface SyncContextValue {
  /** A cloud backend is configured. When false, Vespera is local-only and sign-in is hidden. */
  enabled: boolean;
  status: SyncStatus;
  /** With status 'error': what went wrong, in words for the person. */
  problem: string | null;
  user: SyncUser | null;
  lastSyncedAt: number | null;
  /** First sign-in on a device with its own board: ask "Bring this board into your account?" */
  pendingFirstSync: boolean;
  /** Each resolves to a friendly error message, or null on success. Never reveals whether an email has an account. */
  signInWithGoogle(): Promise<string | null>;
  signInWithPassword(email: string, password: string): Promise<string | null>;
  signUp(email: string, password: string): Promise<string | null>;
  /**
   * Sync what's left, then sign out and forget this account on this device (its board, backups and the Quick Scribe key).
   * Resolves 'unsynced' without signing out if changes couldn't reach the cloud, unless `force` is set.
   */
  signOut(options?: { force?: boolean }): Promise<SignOutResult>;
  /** Answer the first-sync question: bring this device's board in, or start the account fresh. */
  resolveFirstSync(choice: 'upload' | 'fresh'): Promise<void>;
  /**
   * Signed in, and this device still holds a board saved before sign-in (with something of the person's in it)
   * that no account has taken in: it can be brought in later, e.g. after "Start fresh".
   */
  guestBoardWaiting: boolean;
  /** Make that earlier board this account's board (the current one is kept as a backup on this device) and push it. */
  bringGuestBoard(): Promise<BringGuestResult>;
}

const noError = async () => null;
const LOCAL_ONLY: SyncContextValue = {
  enabled: false,
  status: 'local-only',
  problem: null,
  user: null,
  lastSyncedAt: null,
  pendingFirstSync: false,
  signInWithGoogle: noError,
  signInWithPassword: noError,
  signUp: noError,
  signOut: async () => 'signed-out',
  resolveFirstSync: async () => {},
  guestBoardWaiting: false,
  bringGuestBoard: async () => 'refused',
};

const SyncContext = createContext<SyncContextValue>(LOCAL_ONLY);

/** Sync state and sign-in actions. Outside a SyncProvider this is a harmless local-only value. */
export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}

export const PUSH_DEBOUNCE_MS = 1500;
/** A board adopted from another tab is that tab's to push; this tab only steps in if it never arrives. */
export const ADOPTED_PUSH_DELAY_MS = 5000;
export const CONFLICT_BACKUP_PREFIX = 'vespera_state_v2_conflict_';
/** Conflict backups belong to one account, so sign-out can find and remove them. */
export const conflictBackupKey = (userId: string, ms: number) => `${CONFLICT_BACKUP_PREFIX}${userId}_${ms}`;

export const SYNC_PROBLEMS: Record<SyncProblem, string> = {
  'too-large': 'Your board is over the 2 MB sync limit, so new changes are saved on this device only until it’s smaller.',
  refused: 'The server didn’t accept your latest changes. They’re saved on this device, and Vespera will try again with your next change.',
  unreadable: 'The cloud copy of your board couldn’t be read, so this device’s copy is being used for now.',
  'no-room':
    'This device is too full to set aside the changes made while syncing was paused, so they stay as they are and syncing waits. Free up some space, then reload.',
};

/**
 * Marks an account whose sync paused for a newer Vespera. After the reload, whatever this device kept
 * meanwhile is set aside as a conflict backup before the cloud board replaces it.
 */
export const pausedSyncKey = (userId: string) => `vespera_sync_paused:${userId}`;

/**
 * Set (to the account's id) once the guest board is safely in an account's cloud row. Only then may
 * sign-out clear the pre-sign-in copies: without it they may be the only copy of someone's board.
 */
export const GUEST_MOVED_KEY = 'vespera_guest_moved';

const now = () => new Date();
const starter = () => createStarterState(toDateKey(now()), minutesOf(now()));
const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

function readBoard(key: string): VesperaState {
  return loadState(browserStorage(), toDateKey(now()), { key, nowMinutes: minutesOf(now()) });
}
/** Cache a board on this device, in the stored form (saveState never overwrites a newer stored board). */
function writeBoard(key: string, state: VesperaState) {
  saveState(state, browserStorage(), key);
}
function hasStored(key: string): boolean {
  try {
    return !!browserStorage()?.getItem(key);
  } catch {
    return false;
  }
}
/** This device's copy under `key` was written by newer Vespera (e.g. before a rollback). */
function storedIsFromTheFuture(key: string): boolean {
  try {
    const raw = browserStorage()?.getItem(key);
    return !!raw && isFromTheFuture(JSON.parse(raw));
  } catch {
    return false; // missing or unreadable: loadState sets it aside
  }
}

/** Never send a board the server would refuse anyway: say so instead (VB-04). Measures what is sent. */
function checkSize(stored: unknown) {
  if (boardBytes(stored) >= MAX_BOARD_BYTES) throw new SyncRefusal('too-large');
}

/**
 * Before the cloud board replaces this device's copy of an account: if sync was paused for a newer Vespera,
 * keep any edits made meanwhile as a conflict backup (the exact stored text). True if a backup was kept.
 * Throws `SyncRefusal('no-room')` if the backup can't be written, so the copy is never replaced unsaved.
 */
function keepPausedEdits(userId: string, key: string, remote: VesperaState): boolean {
  let storage: Storage;
  let raw: string | null;
  try {
    storage = globalThis.localStorage;
    if (!storage.getItem(pausedSyncKey(userId))) return false;
    raw = storage.getItem(key);
  } catch {
    return false; // storage blocked: nothing was kept on this device
  }
  let kept = false;
  if (raw && syncFingerprint(readBoard(key)) !== syncFingerprint(remote)) {
    try {
      storage.setItem(conflictBackupKey(userId, Date.now()), raw);
    } catch {
      throw new SyncRefusal('no-room');
    }
    kept = true;
  }
  try {
    storage.removeItem(pausedSyncKey(userId));
  } catch {
    // ignore: at worst the next sign-in compares again
  }
  return kept;
}

/**
 * Remove what this device keeps for an account: its cached board, its conflict backups and any copy set
 * aside next to them (every `vespera_*` key naming the account), plus unattributed conflict backups
 * written before backups were per account.
 */
function forgetAccount(userId: string) {
  try {
    const storage = globalThis.localStorage;
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => k !== null);
    for (const key of keys) {
      const theirs = key.startsWith('vespera_') && key.includes(userId);
      const legacyBackup = key.startsWith(CONFLICT_BACKUP_PREFIX) && /^\d+$/.test(key.slice(CONFLICT_BACKUP_PREFIX.length));
      if (theirs || legacyBackup) storage.removeItem(key);
    }
  } catch {
    // storage blocked: nothing was kept
  }
}

/**
 * A copy kept from before sign-in: the v1 and guest boards, anything set aside beside the guest board
 * (`vespera_state_v2_*`, except an account's conflict backups, which name it), and the guest board's
 * migration snapshots (`vespera_backup_*` without `:<userId>`).
 */
function isPreSignInKey(key: string): boolean {
  if (key === STORAGE_KEY || key === STORAGE_KEY_V1) return true;
  if (key.startsWith(CONFLICT_BACKUP_PREFIX)) return !/^.+_\d+$/.test(key.slice(CONFLICT_BACKUP_PREFIX.length));
  if (key.startsWith(`${STORAGE_KEY}_`)) return true;
  return key.startsWith('vespera_backup_') && !key.includes(':');
}

/** This device's guest board has something of the person's in it, and no account has taken it in yet. */
function guestBoardWaiting(): boolean {
  try {
    if (globalThis.localStorage.getItem(GUEST_MOVED_KEY)) return false;
  } catch {
    return false; // storage blocked: there is no earlier board to bring
  }
  return hasStored(STORAGE_KEY) && hasUserContent(readBoard(STORAGE_KEY));
}

/** The guest board as saved (migrated by parseState), or null if there is none or it can't be read. */
function readGuestBoard(): VesperaState | null {
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    return raw ? parseState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Once the guest board lives in an account, remove every pre-sign-in copy (and the marker) from this device. */
function forgetMovedGuestBoard() {
  try {
    const storage = globalThis.localStorage;
    if (!storage.getItem(GUEST_MOVED_KEY)) return; // never moved: it may be the only copy, so it stays
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => k !== null);
    for (const key of keys) if (isPreSignInKey(key)) storage.removeItem(key);
    storage.removeItem(GUEST_MOVED_KEY);
  } catch {
    // storage blocked: nothing was kept
  }
}

/**
 * Wraps the app (inside ToastProvider). With a backend, no board exists until someone signs in:
 * `loading` shows while the session is checked (and while a new sign-in's board is fetched), and
 * `signedOut` (the sign-in gate) while nobody is signed in. Signed in, it renders the VesperaProvider
 * for that account's board, remounting it when the account changes so each account's cache stays separate.
 * `backend`: omit for the configured Supabase backend, null for local-only, or a fake in tests.
 */
export function SyncProvider({
  children,
  backend,
  signedOut = null,
  loading = null,
}: {
  children: ReactNode;
  backend?: SyncBackend | null;
  signedOut?: ReactNode;
  loading?: ReactNode;
}) {
  const be = useMemo(() => (backend === undefined ? getDefaultBackend() : backend), [backend]);
  const [user, setUser] = useState<SyncUser | null>(null);
  const [authReady, setAuthReady] = useState(!be);
  const [storageKey, setStorageKey] = useState(STORAGE_KEY);
  const [status, setStatus] = useState<SyncStatus>(be ? 'signed-out' : 'local-only');
  const [problem, setProblem] = useState<SyncProblem | null>(null);
  const [pendingFirstSync, setPending] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const remoteAt = useRef<string | null>(null);
  /** Pushes whatever the cloud is missing; true once it has everything. Set while a SyncBridge is mounted. */
  const flushRef = useRef<(() => Promise<boolean>) | null>(null);
  /** Replaces the mounted account board and pushes it: true once the cloud has it. Set while a SyncBridge is mounted. */
  const replaceRef = useRef<ReplaceBoard | null>(null);
  /** Bumped when the guest board moves, so `guestWaiting` looks again. */
  const [guestMoves, setGuestMoves] = useState(0);
  /** The account just signed out of here, forgotten again once its board has unmounted. */
  const forgetting = useRef<string | null>(null);
  const userId = user?.id ?? null;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  /** Set when this account's sync has paused until reload; the status then stays as `pause` left it. */
  const paused = useRef(false);
  const showToast = useToast();

  /** Sync status, unless sync has paused (which nothing but a reload or another account undoes). */
  const showStatus = useCallback((s: SyncStatus) => {
    if (!paused.current) setStatus(s);
  }, []);

  const markSynced = useCallback(() => {
    if (paused.current) return;
    setStatus('synced');
    setProblem(null);
    setLastSyncedAt(Date.now());
  }, []);

  /**
   * Stop syncing this account until reload: nothing more is applied or pushed, and edits stay on this device.
   * Without a problem: newer Vespera wrote the board ('update-required'). With one: it says why syncing waits.
   */
  const pause = useCallback((why: SyncProblem | null = null) => {
    paused.current = true;
    setStatus(why ? 'error' : 'update-required');
    setProblem(why);
    const id = userIdRef.current;
    if (!why && id) {
      try {
        globalThis.localStorage.setItem(pausedSyncKey(id), '1');
      } catch {
        // storage full or blocked: then nothing new is kept on this device either
      }
    }
  }, []);

  /** A network hiccup reads "offline" (and retries); a refusal reads "error", with a reason; VSP01 pauses. */
  const fail = useCallback(
    (err: unknown) => {
      const result = classifySyncFailure(err, online());
      if (result.status === 'update-required') return pause();
      if (result.status === 'error' && result.problem === 'no-room') return pause('no-room');
      if (paused.current) return;
      setStatus(result.status);
      setProblem(result.status === 'error' ? result.problem : null);
    },
    [pause],
  );

  useEffect(() => {
    if (!be) return;
    let alive = true;
    void be.auth.getUser().then((u) => {
      if (!alive) return;
      setUser(u);
      setAuthReady(true);
    });
    const unsubscribe = be.auth.onChange((u) => {
      if (!alive) return;
      setUser(u);
      setAuthReady(true);
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [be]);

  /**
   * Create the cloud row for a board ('created'). If one appeared meanwhile, adopt it instead ('adopted'),
   * or, when newer Vespera wrote it, keep this board on the device and pause ('paused').
   * 'kept': the row that appeared couldn't be read, so nothing changed.
   */
  const createRemote = useCallback(
    async (id: string, key: string, state: VesperaState): Promise<'created' | 'adopted' | 'paused' | 'kept'> => {
      if (!be) return 'kept';
      const stored = storedBoard(state);
      checkSize(stored);
      const res = await be.store.push(id, stored, null);
      if (res.ok) {
        remoteAt.current = res.updatedAt;
        writeBoard(key, state);
        return 'created';
      }
      const row = await be.store.fetch(id);
      if (row && rowIsFromTheFuture(row)) {
        writeBoard(key, state);
        pause();
        return 'paused';
      }
      const parsed = row && parseState(row.state);
      if (row && parsed) {
        remoteAt.current = row.updatedAt;
        writeBoard(key, parsed);
        return 'adopted';
      }
      return 'kept';
    },
    [be, pause],
  );

  // First sync whenever the signed-in account changes.
  useEffect(() => {
    if (!be || !authReady) return;
    paused.current = false; // a pause belongs to one account's sync
    if (!userId) {
      remoteAt.current = null;
      setPending(false);
      setStorageKey(STORAGE_KEY);
      setStatus('signed-out');
      setProblem(null);
      return;
    }
    let cancelled = false;
    const key = userStorageKey(userId);
    setStatus('syncing');
    setProblem(null);
    void (async () => {
      try {
        const remote = await be.store.fetch(userId);
        if (cancelled) return;
        const guestHasContent = hasStored(STORAGE_KEY) && hasUserContent(readBoard(STORAGE_KEY));
        const decision = decideFirstSync({ remote, guestHasContent, accountCacheExists: hasStored(key) });
        if (decision === 'ask') {
          setPending(true);
          return;
        }
        if ((decision === 'use-remote' && rowIsFromTheFuture(remote!)) || storedIsFromTheFuture(key)) {
          // Newer Vespera wrote this board (in the cloud, or this device's copy): don't read it as ours,
          // don't write over it, and keep this device's copy as it is.
          pause();
          setStorageKey(key);
          return;
        }
        if (decision === 'use-remote') {
          const parsed = parseState(remote!.state);
          if (!parsed) throw new SyncRefusal('unreadable');
          const keptPausedEdits = keepPausedEdits(userId, key, parsed);
          remoteAt.current = remote!.updatedAt;
          writeBoard(key, parsed);
          if (keptPausedEdits) {
            showToast({ message: 'Opened your board from the cloud. Changes made here while syncing was paused were saved as a backup.' });
          }
        } else {
          await createRemote(userId, key, decision === 'upload-account-cache' ? readBoard(key) : starter());
        }
        if (cancelled) return;
        setStorageKey(key);
        markSynced();
      } catch (err) {
        if (cancelled) return;
        setStorageKey(key); // keep working from this device's copy; the bridge retries when back online
        fail(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [be, authReady, userId, createRemote, markSynced, fail, pause, showToast]);

  // Signed out: once the account's board has unmounted (so nothing can write it again), forget it once more.
  useEffect(() => {
    if (userId || !forgetting.current) return;
    forgetAccount(forgetting.current);
    forgetMovedGuestBoard();
    forgetting.current = null;
  }, [userId]);

  const resolveFirstSync = useCallback(
    async (choice: 'upload' | 'fresh') => {
      if (!be || !userId) return;
      const key = userStorageKey(userId);
      const board = choice === 'upload' ? readBoard(STORAGE_KEY) : starter();
      setPending(false);
      showStatus('syncing');
      try {
        const outcome = await createRemote(userId, key, board);
        if (choice === 'upload' && outcome === 'created') {
          try {
            // Moved, not copied: no later account on this device is offered it. Only once it's safely in the cloud.
            globalThis.localStorage.setItem(GUEST_MOVED_KEY, userId);
            globalThis.localStorage.removeItem(STORAGE_KEY);
          } catch {
            // ignore
          }
        }
        setStorageKey(key);
        markSynced();
      } catch (err) {
        writeBoard(key, board);
        setStorageKey(key);
        fail(err);
      }
    },
    [be, userId, createRemote, showStatus, markSynced, fail],
  );

  const bringGuestBoard = useCallback(async (): Promise<BringGuestResult> => {
    const id = userIdRef.current;
    const replace = replaceRef.current;
    const board = readGuestBoard();
    if (!id || !replace || !board) return 'refused';
    const result = await replace(board);
    if (result === 'moved') {
      try {
        // Moved, not copied (as on first sync): only once it's safely in the cloud.
        globalThis.localStorage.setItem(GUEST_MOVED_KEY, id);
        globalThis.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      setGuestMoves((n) => n + 1);
    }
    return result;
  }, []);

  const signOut = useCallback(
    async ({ force = false }: { force?: boolean } = {}): Promise<SignOutResult> => {
      if (!be) return 'signed-out';
      const id = userIdRef.current;
      if (id && !force && flushRef.current && !(await flushRef.current())) return 'unsynced';
      await be.auth.signOut();
      if (id) {
        forgetting.current = id;
        forgetAccount(id);
        forgetMovedGuestBoard();
        removeOracleKey(); // a paid key shouldn't outlive the person who added it (VB-03)
      }
      return 'signed-out';
    },
    [be],
  );

  const syncing = !!be && !!userId && storageKey === userStorageKey(userId);
  // Once an account's board is open (never while the first-sync question is still asked), look for an earlier board,
  // and look again once it has moved (guestMoves).
  const guestWaiting = useMemo(() => syncing && !pendingFirstSync && guestBoardWaiting(), [syncing, pendingFirstSync, guestMoves]);

  const value = useMemo<SyncContextValue>(() => {
    if (!be) return LOCAL_ONLY;
    return {
      enabled: true,
      status,
      problem: status === 'error' && problem ? SYNC_PROBLEMS[problem] : null,
      user,
      lastSyncedAt,
      pendingFirstSync,
      signInWithGoogle: async () => friendlyAuthError('google', await be.auth.signInWithGoogle()),
      signInWithPassword: async (email, password) => friendlyAuthError('sign-in', await be.auth.signInWithPassword(email, password)),
      signUp: async (email, password) => friendlyAuthError('sign-up', await be.auth.signUp(email, password)),
      signOut,
      resolveFirstSync,
      guestBoardWaiting: guestWaiting,
      bringGuestBoard,
    };
  }, [be, status, problem, user, lastSyncedAt, pendingFirstSync, signOut, resolveFirstSync, guestWaiting, bringGuestBoard]);


  if (be && (!authReady || !userId)) {
    // Signed out (or not known yet): no board is read or mounted. The account's board goes in the same
    // render as the sign-out, never one frame later.
    return <SyncContext.Provider value={value}>{authReady ? signedOut : loading}</SyncContext.Provider>;
  }
  if (be && !syncing && !pendingFirstSync) {
    // Just signed in: wait for this account's board rather than show anything else kept on the device.
    return <SyncContext.Provider value={value}>{loading}</SyncContext.Provider>;
  }
  // While asking whether to bring the guest board in, that board shows behind the question.
  const boardKey = userId ? storageKey : STORAGE_KEY;

  return (
    <SyncContext.Provider value={value}>
      <VesperaProvider key={boardKey} storageKey={boardKey}>
        {syncing && (
          <SyncBridge
            backend={be!}
            userId={userId!}
            remoteAt={remoteAt}
            flushRef={flushRef}
            replaceRef={replaceRef}
            paused={paused}
            pause={pause}
            setStatus={showStatus}
            markSynced={markSynced}
            fail={fail}
          />
        )}
        {children}
      </VesperaProvider>
    </SyncContext.Provider>
  );
}

type ReplaceBoard = (board: VesperaState) => Promise<BringGuestResult>;

/** Keeps the mounted board and the user's cloud row in step. Renders nothing. */
function SyncBridge({
  backend,
  userId,
  remoteAt,
  flushRef,
  replaceRef,
  paused,
  pause,
  setStatus,
  markSynced,
  fail,
}: {
  backend: SyncBackend;
  userId: string;
  remoteAt: { current: string | null };
  flushRef: { current: (() => Promise<boolean>) | null };
  replaceRef: { current: ReplaceBoard | null };
  /** Sync paused until reload: apply nothing, push nothing. */
  paused: { current: boolean };
  pause: () => void;
  setStatus: (s: SyncStatus) => void;
  markSynced: () => void;
  fail: (err: unknown) => void;
}) {
  const { state, applyRemoteState } = useVespera();
  const showToast = useToast();
  const stateRef = useRef(state);
  stateRef.current = state;
  /** The board both sides agree on, as canonical JSON of its stored form (what is pushed and cached). */
  const fingerprint = syncFingerprint;
  const syncedJson = useRef(fingerprint(state));
  /** The last board another tab of this device saved (and so will push itself). */
  const fromOtherTab = useRef<string | null>(null);
  const lastLocalEdit = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const queued = useRef(false);
  /** Counts boards adopted from the cloud, so a replacement can tell whether another device's board won. */
  const adoptions = useRef(0);

  const adopt = useCallback(
    (row: RemoteRow) => {
      const parsed = parseState(row.state);
      if (!parsed) return;
      adoptions.current++;
      remoteAt.current = row.updatedAt;
      syncedJson.current = fingerprint(parsed);
      stateRef.current = parsed; // what the next render shows: a push queued meanwhile mustn't resend the old board
      applyRemoteState(parsed);
      markSynced();
    },
    [applyRemoteState, markSynced, remoteAt],
  );

  /** Send the board; resolves once this push (and any queued behind it) has landed or failed. */
  const push = useCallback((): Promise<void> => {
    if (inFlight.current) {
      queued.current = true; // one push at a time; send the latest once this one lands
      return inFlight.current;
    }
    if (paused.current) return Promise.resolve(); // nothing reaches the cloud until reload
    const stored = storedBoard(stateRef.current);
    const json = canonicalJson(stored);
    if (json === syncedJson.current) {
      markSynced();
      return Promise.resolve();
    }
    const run = (async () => {
      try {
        checkSize(stored);
        const res = await backend.store.push(userId, stored, remoteAt.current);
        if (res.ok) {
          remoteAt.current = res.updatedAt;
          syncedJson.current = json;
          if (fingerprint(stateRef.current) === json) markSynced();
        } else {
          const row = await backend.store.fetch(userId);
          if (!row) {
            remoteAt.current = null; // the row was deleted: create it again
            queued.current = true;
          } else {
            settleRef.current(row);
          }
        }
      } catch (err) {
        fail(err);
      }
    })();
    const done = run.then(() => {
      inFlight.current = null;
      if (!queued.current) return;
      queued.current = false;
      return push();
    });
    inFlight.current = done;
    return done;
  }, [backend, userId, markSynced, remoteAt, fail, paused]);

  /** Both sides changed: keep whichever changed last; save the losing local copy as a backup. */
  const settle = (row: RemoteRow) => {
    if (rowIsFromTheFuture(row)) return pause(); // newer Vespera wrote it: neither adopt it nor push over it
    const parsed = parseState(row.state);
    if (parsed && fingerprint(parsed) === fingerprint(stateRef.current)) {
      // Same board on both sides (e.g. another tab of this device pushed it first): nothing to back up.
      remoteAt.current = row.updatedAt;
      syncedJson.current = fingerprint(parsed);
      markSynced();
      return;
    }
    if (resolveConflict(lastLocalEdit.current, row.updatedAt) === 'remote') {
      try {
        browserStorage()?.setItem(conflictBackupKey(userId, Date.now()), JSON.stringify(storedBoard(stateRef.current)));
      } catch {
        // ignore
      }
      adopt(row);
      showToast({ message: 'Synced the newer version from your other device. This device’s copy was saved as a backup.' });
    } else {
      remoteAt.current = row.updatedAt;
      void push();
    }
  };

  const onRemote = (row: RemoteRow) => {
    if (paused.current) return;
    if (rowIsFromTheFuture(row)) return pause();
    if (row.updatedAt === remoteAt.current) return; // already have this version
    if (remoteAt.current && toMillis(row.updatedAt) <= toMillis(remoteAt.current)) return; // not newer
    const parsed = parseState(row.state);
    if (!parsed) return;
    const incoming = fingerprint(parsed);
    if (incoming === fingerprint(stateRef.current) || incoming === syncedJson.current) {
      // Our own write echoing back (possibly before the push call returned), or another tab's: nothing to merge.
      remoteAt.current = row.updatedAt;
      syncedJson.current = incoming;
      if (incoming === fingerprint(stateRef.current)) markSynced();
      return;
    }
    const dirty = fingerprint(stateRef.current) !== syncedJson.current;
    if (dirty) settle(row);
    else adopt(row);
  };
  const onRemoteRef = useRef(onRemote);
  onRemoteRef.current = onRemote;
  const settleRef = useRef(settle);
  settleRef.current = settle;

  // Local edits → push after a short pause. A board adopted from another tab isn't a local edit: that tab
  // pushes it, and its echo settles this one; push it here only if it never arrives.
  useEffect(() => {
    const json = fingerprint(state);
    if (json === syncedJson.current) return;
    const adopted = json === fromOtherTab.current;
    if (!adopted) lastLocalEdit.current = Date.now();
    setStatus('syncing');
    const timer = setTimeout(() => void push(), adopted ? ADOPTED_PUSH_DELAY_MS : PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [state, push, setStatus]);

  // Notice when another tab saves this account's board (VesperaProvider adopts it; see above).
  useEffect(() => {
    const key = userStorageKey(userId);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || !e.newValue) return;
      try {
        const saved: unknown = JSON.parse(e.newValue);
        if (isFromTheFuture(saved)) return pause(); // a tab running newer Vespera: let it sync, not this one
        const parsed = parseState(saved);
        if (parsed) fromOtherTab.current = fingerprint(parsed);
      } catch {
        // half-written: the board won't adopt it either
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [userId, pause]);

  // Sign-out asks: does the cloud have everything? Push what's left, then answer.
  useEffect(() => {
    const clean = () => fingerprint(stateRef.current) === syncedJson.current;
    flushRef.current = async () => {
      for (let attempt = 0; attempt < 2 && !clean(); attempt++) await push();
      return clean();
    };
    return () => {
      flushRef.current = null;
    };
  }, [flushRef, push]);

  // Bringing the earlier board in: keep this account's board as a backup, show the earlier one, and push it now.
  useEffect(() => {
    replaceRef.current = async (board) => {
      if (paused.current) return 'refused';
      try {
        globalThis.localStorage.setItem(conflictBackupKey(userId, Date.now()), JSON.stringify(storedBoard(stateRef.current)));
      } catch {
        return 'refused'; // no room for the backup: the account's board is never replaced unsaved
      }
      const before = adoptions.current;
      lastLocalEdit.current = Date.now(); // a conflict now keeps this board, not the older cloud one
      stateRef.current = board; // what the push below sends, before the next render shows it
      applyRemoteState(board);
      const clean = () => fingerprint(stateRef.current) === syncedJson.current;
      for (let attempt = 0; attempt < 2 && !clean(); attempt++) await push();
      return clean() && adoptions.current === before ? 'moved' : 'pending';
    };
    return () => {
      replaceRef.current = null;
    };
  }, [replaceRef, userId, paused, applyRemoteState, push]);

  // Live changes, a pull whenever the app comes back into view, and a retry when the connection returns.
  useEffect(() => {
    const unsubscribe = backend.store.subscribe(userId, (row) => onRemoteRef.current(row));
    // Coming back fires both focus and visibilitychange: one fetch at a time is enough.
    let pulling = false;
    const pull = () => {
      if (pulling) return;
      pulling = true;
      backend.store
        .fetch(userId)
        .then((row) => row && onRemoteRef.current(row))
        .catch(fail)
        .finally(() => {
          pulling = false;
        });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') pull();
    };
    const reconnect = () => {
      void push();
      pull();
    };
    window.addEventListener('focus', pull);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', reconnect);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', pull);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', reconnect);
    };
  }, [backend, userId, push, fail]);

  return null;
}
