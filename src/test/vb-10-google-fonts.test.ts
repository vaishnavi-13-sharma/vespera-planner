// @vitest-environment node
// VB-10 · Static: every visit (and every offline-first launch while online) fetches fonts from Google,
// handing Google each friend's IP address, user agent and visit times, plus a Referer. The app promises
// a private board; the fonts can be self-hosted from `public/` at no cost and without new dependencies.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

describe('VB-10: no third-party requests on page load', () => {
  it('index.html does not load fonts from Google', () => {
    expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
  });
});
