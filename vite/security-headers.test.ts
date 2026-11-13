// @vitest-environment node
// VB-05 · Static: the production site ships with no security headers. Cloudflare Pages reads
// `public/_headers` (copied to dist/), and there is none: no Content-Security-Policy, nothing stopping
// another site from framing Vespera (clickjacking "Reset everything" / "Sign out"), no Referrer-Policy,
// no nosniff. With no CSP, any injected script can read the plaintext Anthropic key and the cached boards.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const HEADERS = resolve(process.cwd(), 'public/_headers');
const read = () => (existsSync(HEADERS) ? readFileSync(HEADERS, 'utf8') : '');

describe('VB-05: Cloudflare Pages security headers', () => {
  it('public/_headers exists and applies to every path', () => {
    expect(existsSync(HEADERS)).toBe(true);
    expect(read()).toMatch(/^\/\*\s*$/m);
  });

  it('sets a Content-Security-Policy that blocks framing, plugins and inline script', () => {
    const csp = read().match(/^\s*Content-Security-Policy:\s*(.+)$/im)?.[1] ?? '';
    expect(csp).toMatch(/default-src 'self'/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/base-uri 'self'|base-uri 'none'/);
    const scriptSrc = csp.match(/script-src([^;]*)/)?.[1] ?? '';
    expect(scriptSrc).not.toMatch(/'unsafe-inline'|'unsafe-eval'/);
  });

  it('still lets Vespera reach what it needs, and nothing more', () => {
    const csp = read().match(/^\s*Content-Security-Policy:\s*(.+)$/im)?.[1] ?? '';
    const directive = (name: string) => csp.match(new RegExp(`(?:^|;)\\s*${name}\\s+([^;]*)`))?.[1].trim().split(/\s+/) ?? [];
    expect(directive('connect-src')).toEqual(expect.arrayContaining(["'self'", 'https://*.supabase.co', 'wss://*.supabase.co', 'https://api.anthropic.com']));
    expect(directive('font-src')).toEqual(["'self'"]); // fonts are self-hosted (VB-10)
    expect(directive('img-src')).toContain('https://*.googleusercontent.com'); // Google profile photos
    expect(csp).not.toMatch(/googleapis|gstatic|\*(?!\.)/);
  });

  it('index.html has no inline script the CSP would block', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    expect(scripts.length).toBeGreaterThan(0);
    for (const [, attrs, body] of scripts) {
      expect(attrs).toMatch(/\bsrc=/);
      expect(body.trim()).toBe('');
    }
  });

  it('sets the companion headers', () => {
    const text = read();
    expect(text).toMatch(/^\s*X-Frame-Options:\s*DENY\s*$/im);
    expect(text).toMatch(/^\s*X-Content-Type-Options:\s*nosniff\s*$/im);
    expect(text).toMatch(/^\s*Referrer-Policy:\s*(no-referrer|strict-origin-when-cross-origin|same-origin)\s*$/im);
    expect(text).toMatch(/^\s*Permissions-Policy:\s*.+$/im);
  });
});
