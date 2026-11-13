import { getDefaultBackend } from '../sync/supabaseBackend';

// Unit tests must never reach a real Supabase project, even when .env.local holds the owner's keys
// (vite.config.ts blanks them for Vitest).
describe('unit tests run without a real backend', () => {
  it('sees no Supabase settings', () => {
    expect(import.meta.env.VITE_SUPABASE_URL).toBeFalsy();
    expect(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY).toBeFalsy();
    expect(import.meta.env.VITE_SUPABASE_ANON_KEY).toBeFalsy();
    expect(getDefaultBackend()).toBeNull();
  });
});
