// @vitest-environment node
// The sign-in gate can only be skipped by a build with VITE_E2E_LOCAL_ONLY=1 (see src/sync/localOnly.ts).
// Only the Playwright config may set it, for its own local-only test build: never an env file, a package
// script, CI, or the Vite config, or a deploy could ship a Vespera anyone can open without signing in.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { LOCAL_ONLY_ALLOWED, localOnlyAllowed } from '../sync/localOnly';

const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git', 'docs', 'test-results', 'playwright-report', 'coverage']);
const THIS_FILE = ['src', 'test', 'localOnlyFlag.test.ts'].join(sep);

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      if (!SKIP_DIRS.has(name) && !name.startsWith('dist')) yield* files(path);
    } else if (stat.size < 2_000_000 && !name.endsWith('.md')) {
      yield path;
    }
  }
}

/** `NAME: …` or `NAME=…` (an assignment), but not `NAME ===` (a read). */
const SETS_FLAG = /VITE_E2E_LOCAL_ONLY['"]?\s*(?::|=(?!=))/;

describe('the local-only switch', () => {
  it('is on under Vitest', () => {
    expect(LOCAL_ONLY_ALLOWED).toBe(true);
  });

  it('allows test mode, the E2E flag or the dev server, and never a production build without the flag', () => {
    expect(localOnlyAllowed({ MODE: 'test', DEV: false })).toBe(true);
    expect(localOnlyAllowed({ MODE: 'production', DEV: false, VITE_E2E_LOCAL_ONLY: '1' })).toBe(true);
    expect(localOnlyAllowed({ MODE: 'development', DEV: true })).toBe(true);
    expect(localOnlyAllowed({ MODE: 'production', DEV: false })).toBe(false);
    expect(localOnlyAllowed({ MODE: 'production', DEV: false, VITE_E2E_LOCAL_ONLY: '0' })).toBe(false);
    expect(localOnlyAllowed({ MODE: 'staging', DEV: false, VITE_E2E_LOCAL_ONLY: '' })).toBe(false);
  });

  it('is set by playwright.config.ts and nowhere else (env files included)', () => {
    const setters = [...files(ROOT)]
      .map((path) => relative(ROOT, path))
      .filter((path) => path !== THIS_FILE && SETS_FLAG.test(readFileSync(join(ROOT, path), 'utf8')));
    expect(setters).toEqual(['playwright.config.ts']);
  });
});
