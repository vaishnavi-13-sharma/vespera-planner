// @vitest-environment node
import { supabaseEnvProblems } from './checkEnv';

const key = 'sb_publishable_abcDEF123_xyz';

describe('build-time Supabase settings check', () => {
  it('accepts a plain https address with a publishable key, or no settings at all', () => {
    expect(supabaseEnvProblems({ VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: key })).toEqual([]);
    expect(supabaseEnvProblems({})).toEqual([]);
    expect(supabaseEnvProblems({ VITE_SUPABASE_URL: 'http://127.0.0.1:9', VITE_SUPABASE_PUBLISHABLE_KEY: 'e2e-placeholder' })).toEqual([]);
  });

  it('stops a pasted Markdown link, a missing scheme, or stray spaces', () => {
    for (const bad of ['[https://abc.supabase.co](https://abc.supabase.co)', 'abc.supabase.co', ' https://abc.supabase.co', '"https://abc.supabase.co"']) {
      expect(supabaseEnvProblems({ VITE_SUPABASE_URL: bad, VITE_SUPABASE_PUBLISHABLE_KEY: key }), bad).toHaveLength(1);
    }
  });

  it('stops a missing key, a quoted key, and any secret key', () => {
    expect(supabaseEnvProblems({ VITE_SUPABASE_URL: 'https://abc.supabase.co' })).toHaveLength(1);
    expect(supabaseEnvProblems({ VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: `"${key}"` })).toHaveLength(1);
    expect(supabaseEnvProblems({ VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc' })).toHaveLength(1);
  });
});
