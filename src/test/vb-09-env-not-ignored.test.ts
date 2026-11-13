// @vitest-environment node
// VB-09 · Static: `.gitignore` ignores `*.local` but not `.env` or `.env.production`. Vite reads all of
// them, so the first time the owner pastes keys into a plain `.env` (the most common habit, and what most
// Supabase/Cloudflare guides say), `git add .` commits it to GitHub. A service_role key there bypasses
// every RLS policy; a `VITE_`-prefixed secret is also inlined into the public bundle.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ignored = readFileSync(resolve(process.cwd(), '.gitignore'), 'utf8')
  .split('\n')
  .map((line) => line.trim());

describe('VB-09: env files with secrets can never be committed', () => {
  it('.gitignore covers .env and every .env.* except the example', () => {
    expect(ignored.some((l) => l === '.env' || l === '.env*' || l === '.env.*' || l === '*.env')).toBe(true);
    expect(ignored.some((l) => l === '.env.*' || l === '.env*')).toBe(true);
    expect(ignored).toContain('!.env.example');
  });
});
