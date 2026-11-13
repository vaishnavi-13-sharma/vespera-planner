// The real cloud backend: Supabase Auth + the `user_states` table (see supabase/migrations).
// Configured by VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. The anon key is public by design:
// row-level security limits every request to the signed-in user's own row.
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { RemoteRow, SyncBackend, SyncUser } from './types';
import { isUsableSupabaseUrl } from './supabaseUrl';

function toUser(user: User | null | undefined): SyncUser | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  const provider = user.app_metadata?.provider;
  return {
    id: user.id,
    email: user.email ?? null,
    name: (meta.full_name as string | undefined) ?? (meta.name as string | undefined) ?? null,
    avatarUrl: (meta.avatar_url as string | undefined) ?? null,
    provider: provider === 'google' ? 'google' : provider === 'email' ? 'email' : 'other',
  };
}

/**
 * A `user_states` row as the app sees it. `schema_version` exists once migration 0003 has run;
 * reading `*` (not naming it) keeps sync working on a project where it hasn't yet.
 */
function toRow(data: { state?: unknown; updated_at?: unknown; schema_version?: unknown }): RemoteRow {
  const row: RemoteRow = { state: data.state, updatedAt: data.updated_at as string };
  if (typeof data.schema_version === 'number') row.schemaVersion = data.schema_version;
  return row;
}

/** Supabase's error code (stable across versions) or, failing that, its message. SyncProvider words it for people. */
function rawAuthError(error: { code?: string; message: string } | null): string | null {
  return error ? error.code || error.message : null;
}

/**
 * Whether the project has Google sign-in switched on, from its public auth settings. Without this,
 * Supabase sends the person to a raw JSON error page. Throws on a network failure.
 */
async function googleIsOn(project: { url: string; key: string }): Promise<boolean> {
  const res = await fetch(`${project.url}/auth/v1/settings`, { headers: { apikey: project.key } });
  if (!res.ok) return true; // can't tell: let Supabase decide
  const settings = (await res.json()) as { external?: { google?: boolean } };
  return settings.external?.google !== false;
}

/** `project`: the URL and public key, used to check which sign-in providers are on before redirecting. */
export function createSupabaseBackend(client: SupabaseClient, project?: { url: string; key: string }): SyncBackend {
  return {
    auth: {
      async getUser() {
        const { data } = await client.auth.getSession();
        return toUser(data.session?.user);
      },
      onChange(callback) {
        const { data } = client.auth.onAuthStateChange((_event, session) => callback(toUser(session?.user)));
        return () => data.subscription.unsubscribe();
      },
      async signInWithGoogle() {
        if (project) {
          try {
            if (!(await googleIsOn(project))) return 'provider_disabled';
          } catch (err) {
            return String(err); // e.g. "TypeError: Failed to fetch": worded as "couldn't reach the cloud"
          }
        }
        const { error } =await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
        return rawAuthError(error);
      },
      async signInWithPassword(email, password) {
        const { error } = await client.auth.signInWithPassword({ email, password });
        return rawAuthError(error);
      },
      async signUp(email, password) {
        const { error } = await client.auth.signUp({ email, password });
        return rawAuthError(error);
      },
      async signOut() {
        await client.auth.signOut();
      },
    },
    store: {
      async fetch(userId) {
        const { data, error } = await client.from('user_states').select('*').eq('user_id', userId).maybeSingle();
        if (error) throw error;
        return data ? toRow(data) : null;
      },
      /** `state` is the stored form. A schema downgrade is refused by the database with code VSP01 (thrown). */
      async push(userId, state, expectedUpdatedAt) {
        if (expectedUpdatedAt === null) {
          const { data, error } = await client.from('user_states').insert({ user_id: userId, state }).select('updated_at').single();
          if (error?.code === '23505') return { ok: false }; // the row already exists: a conflict
          if (error) throw error;
          return { ok: true, updatedAt: data.updated_at as string };
        }
        const { data, error } = await client
          .from('user_states')
          .update({ state })
          .eq('user_id', userId)
          .eq('updated_at', expectedUpdatedAt)
          .select('updated_at');
        if (error) throw error;
        return data.length ? { ok: true, updatedAt: data[0].updated_at as string } : { ok: false };
      },
      subscribe(userId, onChange) {
        const channel = client
          .channel(`user_states:${userId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'user_states', filter: `user_id=eq.${userId}` }, (payload) => {
            const row = payload.new as { state?: unknown; updated_at?: string; schema_version?: unknown } | undefined;
            if (row?.state && row.updated_at) onChange(toRow(row));
          })
          .subscribe();
        return () => {
          void client.removeChannel(channel);
        };
      },
    },
  };
}

/** The configured backend, or null to run local-only (no env vars, e.g. in tests). */
export function getDefaultBackend(): SyncBackend | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  // Supabase now calls the public key "publishable" (sb_publishable_…); the older "anon" name still works.
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
  if (!url || !key) return null;
  if (!isUsableSupabaseUrl(url)) {
    // Never crash into a blank page: the sign-in gate says sign-in isn't set up instead.
    console.error('Vespera: VITE_SUPABASE_URL is not a plain https:// address, so sign-in is off. Fix it and rebuild.');
    return null;
  }
  return createSupabaseBackend(createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' } }), { url, key });
}
