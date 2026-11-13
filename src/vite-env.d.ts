/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** '1' only in the Playwright local-only test build (see src/sync/localOnly.ts). */
  readonly VITE_E2E_LOCAL_ONLY?: string;
}
