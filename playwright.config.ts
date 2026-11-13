// Headless end-to-end tests. Never the owner's live tab: every test gets a fresh, isolated,
// non-persistent browser context with its own empty localStorage, against a dedicated build.
import { defineConfig } from '@playwright/test';
import { BASE_URL, GATE_BASE_URL, GATE_PORT, PORT } from './e2e/ports';

/** Its own build folder per server, so a test run never replaces a deploy build in dist/. */
const buildAndServe = (outDir: string, port: number) =>
  `npx vite build --outDir ${outDir} --emptyOutDir && npx vite preview --outDir ${outDir} --port ${port} --strictPort --host 127.0.0.1`;

// Never sync to a real Supabase project from a test run, even when .env.local holds keys.
const NO_SUPABASE = { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true' };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  outputDir: 'test-results/e2e',
  use: {
    baseURL: BASE_URL,
    headless: true,
    // A cached service worker must never serve an old build into a fresh test run.
    serviceWorkers: 'block',
    // Fixed zone and locale so dates and times are the same on every machine.
    timezoneId: 'UTC',
    locale: 'en-US',
    trace: 'retain-on-failure',
    // Owner rule: no screenshots (they cost usage); failures are read from the terminal output.
    screenshot: 'off',
  },
  projects: [
    {
      name: 'mobile-iphone',
      use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    },
    { name: 'tablet-ipad', use: { browserName: 'chromium', viewport: { width: 900, height: 1100 }, hasTouch: true } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
    { name: 'desktop-1150', use: { browserName: 'chromium', viewport: { width: 1150, height: 800 } } },
  ],
  webServer: [
    {
      // The board itself, local-only: the one build allowed to open without sign-in (see src/sync/localOnly.ts).
      command: buildAndServe('dist-e2e', PORT),
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { ...NO_SUPABASE, VITE_E2E_LOCAL_ONLY: '1' },
    },
    {
      // The sign-in gate (e2e/sign-in-gate.spec.ts): sync "configured" against an address nothing answers on
      // (never the real project), and no local-only flag, exactly like a production build signed out.
      command: buildAndServe('dist-e2e-gate', GATE_PORT),
      url: GATE_BASE_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      env: { ...NO_SUPABASE, VITE_SUPABASE_URL: 'http://127.0.0.1:9', VITE_SUPABASE_PUBLISHABLE_KEY: 'e2e-placeholder' },
    },
  ],
});
