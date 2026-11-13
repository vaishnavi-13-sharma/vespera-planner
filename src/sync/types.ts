// The seams between Vespera and its (optional) cloud backend. The Supabase implementation
// lives in supabaseBackend.ts; tests use an in-memory fake with the same shape.

export interface SyncUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  provider: 'google' | 'email' | 'other';
}

/** One user's board as stored in the cloud. `updatedAt` is the server's timestamp (ISO-ish string). */
export interface RemoteRow {
  /** The board in its stored (lean) form; read it with `parseState`. */
  state: unknown;
  updatedAt: string;
  /** The row's `schema_version` column (supabase/migrations/0003), when the server has it. */
  schemaVersion?: number;
}

export type PushResult = { ok: true; updatedAt: string } | { ok: false };

export interface RemoteStore {
  fetch(userId: string): Promise<RemoteRow | null>;
  /**
   * Write the board, already in its stored form (`storedBoard` in logic.ts). `expectedUpdatedAt` null =
   * create the row; otherwise only overwrite if the row is still at that version.
   * `{ ok: false }` = someone else wrote first (a conflict). Throws `{ code: 'VSP01' }` on a schema downgrade.
   */
  push(userId: string, state: unknown, expectedUpdatedAt: string | null): Promise<PushResult>;
  /** Live changes to this user's row. Returns an unsubscribe function. */
  subscribe(userId: string, onChange: (row: RemoteRow) => void): () => void;
}

export interface AuthClient {
  getUser(): Promise<SyncUser | null>;
  /** Fires on sign-in and sign-out. Returns an unsubscribe function. */
  onChange(callback: (user: SyncUser | null) => void): () => void;
  /**
   * Each resolves to the raw error (a code or message), or null on success. Google redirects away and back.
   * Never shown as-is: SyncProvider turns it into a fixed, non-revealing message (authErrors.ts).
   */
  signInWithGoogle(): Promise<string | null>;
  signInWithPassword(email: string, password: string): Promise<string | null>;
  signUp(email: string, password: string): Promise<string | null>;
  signOut(): Promise<void>;
}

export interface SyncBackend {
  auth: AuthClient;
  store: RemoteStore;
}
