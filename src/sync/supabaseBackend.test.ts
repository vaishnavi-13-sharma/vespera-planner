// "Continue with Google" when the project hasn't switched Google on: Supabase would send the person to a raw
// JSON error page, so the backend asks the project's public auth settings first and answers in words instead.
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseBackend } from './supabaseBackend';

function fakeClient() {
  const signInWithOAuth = vi.fn(async () => ({ data: {}, error: null }));
  return { client: { auth: { signInWithOAuth } } as unknown as SupabaseClient, signInWithOAuth };
}

const PROJECT = { url: 'http://127.0.0.1:9', key: 'e2e-placeholder' };

afterEach(() => vi.unstubAllGlobals());

describe('signInWithGoogle', () => {
  it('reports provider_disabled, without redirecting, when Google is off', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ external: { google: false, email: true } })));
    vi.stubGlobal('fetch', fetch);
    const { client, signInWithOAuth } = fakeClient();
    expect(await createSupabaseBackend(client, PROJECT).auth.signInWithGoogle()).toBe('provider_disabled');
    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:9/auth/v1/settings', { headers: { apikey: 'e2e-placeholder' } });
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });

  it('goes on to Google when it is on', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ external: { google: true } }))));
    const { client, signInWithOAuth } = fakeClient();
    expect(await createSupabaseBackend(client, PROJECT).auth.signInWithGoogle()).toBeNull();
    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
  });

  it('says the cloud is out of reach when the settings can’t be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    const { client, signInWithOAuth } = fakeClient();
    expect(await createSupabaseBackend(client, PROJECT).auth.signInWithGoogle()).toMatch(/Failed to fetch/);
    expect(signInWithOAuth).not.toHaveBeenCalled();
  });
});
