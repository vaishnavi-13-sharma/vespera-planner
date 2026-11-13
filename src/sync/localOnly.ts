/**
 * May Vespera open without sign-in when no cloud backend is configured? Only under Vitest, in the
 * Playwright local-only test build (the only place that sets the flag; src/test/localOnlyFlag.test.ts
 * keeps it that way), or on the Vite dev server (`npm run dev`), so anyone can try the app offline with no
 * setup. `DEV` is false in every production build, so a deployed build with a missing config shows the gate.
 * With a backend configured, none of this applies: sync is on and sign-in is required.
 */
export function localOnlyAllowed(env: Pick<ImportMetaEnv, 'MODE' | 'DEV' | 'VITE_E2E_LOCAL_ONLY'>): boolean {
  return env.MODE === 'test' || env.DEV === true || env.VITE_E2E_LOCAL_ONLY === '1';
}

export const LOCAL_ONLY_ALLOWED: boolean = localOnlyAllowed(import.meta.env);
