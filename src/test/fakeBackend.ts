// An in-memory stand-in for Supabase (auth + user_states + Realtime), for tests.
// Like the real table after migration 0003, every row records its board's schema version,
// and an update that would lower it is refused with `{ code: 'VSP01' }`.
import { schemaVersionOf } from '../context/schema';
import type { RemoteRow, SyncBackend, SyncUser } from '../sync/types';

export const ME: SyncUser = { id: 'user-me', email: 'me@example.com', name: 'Me', avatarUrl: null, provider: 'google' };

export function createFakeBackend({ user = null, rows = {} }: { user?: SyncUser | null; rows?: Record<string, RemoteRow> } = {}) {
  let current = user;
  const authListeners = new Set<(u: SyncUser | null) => void>();
  const table = new Map(Object.entries(rows));
  const subscribers = new Map<string, Set<(row: RemoteRow) => void>>();
  let tick = 0;
  /** Server timestamps, strictly increasing, starting from midnight on Nov 12 (before "now" in tests). */
  const stamp = () => new Date(Date.UTC(2026, 10, 12, 0, 0, ++tick)).toISOString();
  const notify = (id: string, row: RemoteRow) => subscribers.get(id)?.forEach((cb) => cb(row));
  const pushes: { userId: string; state: unknown }[] = [];
  /** The version the server records for a row (its `schema_version` column). */
  const versionOf = (row: RemoteRow) => row.schemaVersion ?? schemaVersionOf(row.state);

  const backend: SyncBackend = {
    auth: {
      getUser: async () => current,
      onChange: (cb) => {
        authListeners.add(cb);
        return () => authListeners.delete(cb);
      },
      signInWithGoogle: async () => {
        fake.setUser(ME);
        return null;
      },
      signInWithPassword: async (email, password) => {
        if (password !== 'correct horse') return 'Invalid login credentials';
        fake.setUser({ ...ME, email, provider: 'email' });
        return null;
      },
      signUp: async (email) => {
        fake.setUser({ ...ME, email, provider: 'email' });
        return null;
      },
      signOut: async () => fake.setUser(null),
    },
    store: {
      fetch: async (id) => table.get(id) ?? null,
      push: async (id, state, expected) => {
        const existing = table.get(id);
        if (expected === null ? !!existing : existing?.updatedAt !== expected) return { ok: false };
        const stored = JSON.parse(JSON.stringify(state)) as unknown;
        const schemaVersion = schemaVersionOf(stored);
        if (existing && schemaVersion < versionOf(existing)) throw { code: 'VSP01', message: 'schema downgrade' };
        const row = { state: stored, updatedAt: stamp(), schemaVersion };
        table.set(id, row);
        pushes.push({ userId: id, state: row.state });
        notify(id, row);
        return { ok: true, updatedAt: row.updatedAt };
      },
      subscribe: (id, cb) => {
        if (!subscribers.has(id)) subscribers.set(id, new Set());
        subscribers.get(id)!.add(cb);
        return () => subscribers.get(id)?.delete(cb);
      },
    },
  };

  const fake = {
    backend,
    table,
    pushes,
    setUser(u: SyncUser | null) {
      current = u;
      authListeners.forEach((cb) => cb(u));
    },
    /**
     * Another device writes the user's row (at an optional explicit server time). `schemaVersion` overrides
     * the row's recorded version, e.g. to serve a row whose column is ahead of its board.
     */
    remoteEdit(id: string, state: unknown, at?: string, { schemaVersion }: { schemaVersion?: number } = {}) {
      const stored = JSON.parse(JSON.stringify(state)) as unknown;
      const row = { state: stored, updatedAt: at ?? stamp(), schemaVersion: schemaVersion ?? schemaVersionOf(stored) };
      table.set(id, row);
      notify(id, row);
    },
  };
  return fake;
}
