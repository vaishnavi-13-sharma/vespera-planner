// @vitest-environment node
// VB-07 · The dev bridge reads (and JSON-parses) the request body *before* its guard runs, and the body
// read has no deadline. A request from another machine, a rebinding Host or a foreign Origin that simply
// never finishes its body is never answered: the guard that should reject it at once is never reached,
// and the socket stays open until Node's own timeout (minutes). Many such requests pin the dev server.
import { bridgeMiddleware, send } from './bridgeHarness';

const prompts = vi.hoisted(() => [] as string[]);
vi.mock('node:child_process', async () => {
  const { fakeSpawnImpl: impl } = await import('./bridgeHarness');
  return { spawn: impl(prompts) };
});

describe('VB-07: the guard runs before the body is read', () => {
  it.each([
    ['another machine', { remoteAddress: '192.168.1.20' }],
    ['a DNS-rebinding Host', { headers: { host: 'evil.example:5173' } }],
    ['a foreign Origin', { headers: { origin: 'https://evil.example' } }],
    ['Origin: null', { headers: { origin: 'null' } }],
  ])('rejects %s at once, even if its body never ends', async (_, request) => {
    const res = await send(bridgeMiddleware(), { ...request, body: '{"text":"Thu 3-5', end: false }, 500);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
    expect(prompts).toHaveLength(0);
  });

  it('hangs up on a refused caller instead of leaving the socket open', async () => {
    const res = await send(bridgeMiddleware(), { remoteAddress: '192.168.1.20', body: '{"text":"Thu 3-5', end: false }, 500);
    expect(res?.hungUp?.()).toBe(true);
  });

  it('refuses a declared oversize body before reading it', async () => {
    const res = await send(bridgeMiddleware(), { headers: { 'content-length': '20000' }, body: '{"text":"', end: false }, 500);
    expect(res?.status).toBe(413);
    expect(prompts).toHaveLength(0);
  });
});

describe('VB-07: reading the body has limits', () => {
  it('gives this Mac’s own slow request a deadline (408), then hangs up', async () => {
    const res = await send(bridgeMiddleware({ bodyDeadlineMs: 50 }), { body: '{"text":"Thu 3-5', end: false }, 500);
    expect(res?.status).toBe(408);
    expect(res?.hungUp?.()).toBe(true);
    expect(prompts).toHaveLength(0);
  });

  it('stops reading an oversize body without parsing it (413)', async () => {
    const res = await send(bridgeMiddleware(), { body: JSON.stringify({ text: 'x', pad: 'y'.repeat(20_000) }), end: false }, 500);
    expect(res?.status).toBe(413);
    expect(res?.hungUp?.()).toBe(true);
    expect(prompts).toHaveLength(0);
  });

  it('answers a malformed body with 400', async () => {
    const res = await send(bridgeMiddleware(), { body: '{"text": "Thu' });
    expect(res?.status).toBe(400);
    expect(prompts).toHaveLength(0);
  });
});
