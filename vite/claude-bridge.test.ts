// @vitest-environment node
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { checkBridgeRequest, runClaude } from './claude-bridge';

const ok = {
  method: 'POST',
  remoteAddress: '127.0.0.1',
  headers: { host: 'localhost:5173', origin: 'http://localhost:5173', 'content-type': 'application/json', 'content-length': '40' },
};

describe('checkBridgeRequest', () => {
  it('accepts a same-origin request from this Mac', () => {
    expect(checkBridgeRequest(ok, 5173)).toEqual({ ok: true });
    expect(checkBridgeRequest({ ...ok, remoteAddress: '::1', headers: { ...ok.headers, host: '127.0.0.1:5173', origin: 'http://127.0.0.1:5173' } }, 5173)).toEqual({ ok: true });
  });

  it.each([
    ['another machine', { ...ok, remoteAddress: '192.168.1.20' }],
    ['a rebinding host', { ...ok, headers: { ...ok.headers, host: 'evil.example:5173' } }],
    ['another site', { ...ok, headers: { ...ok.headers, origin: 'https://evil.example' } }],
    ['no origin', { ...ok, headers: { ...ok.headers, origin: undefined } }],
    ['a form post', { ...ok, headers: { ...ok.headers, 'content-type': 'text/plain' } }],
    ['a huge body', { ...ok, headers: { ...ok.headers, 'content-length': '20000' } }],
  ])('rejects %s', (_, req) => {
    const result = checkBridgeRequest(req, 5173);
    expect(result.ok).toBe(false);
  });
});

describe('runClaude', () => {
  function fakeSpawn(stdout: string) {
    const calls: { cmd: string; args: string[]; opts: Record<string, unknown>; stdin: string }[] = [];
    const impl = (cmd: string, args: string[], opts: Record<string, unknown>) => {
      const child = new EventEmitter() as EventEmitter & { stdin: PassThrough; stdout: PassThrough; stderr: PassThrough; kill: () => void };
      child.stdin = new PassThrough();
      child.stdout = new PassThrough();
      child.stderr = new PassThrough();
      child.kill = vi.fn();
      const call = { cmd, args, opts, stdin: '' };
      calls.push(call);
      child.stdin.on('data', (d) => (call.stdin += d));
      child.stdin.on('finish', () => {
        child.stdout.end(stdout);
        setTimeout(() => child.emit('close', 0), 0);
      });
      return child;
    };
    return { impl, calls };
  }

  it('sends the prompt on stdin, never through a shell, and returns the result', async () => {
    const { impl, calls } = fakeSpawn(JSON.stringify({ result: '{"actions":[]}' }));
    const prompt = 'quest: $(rm -rf ~) `whoami`';
    await expect(runClaude(prompt, impl as never)).resolves.toBe('{"actions":[]}');
    expect(calls[0].cmd).toBe('claude');
    expect(calls[0].args).toContain('-p');
    expect(calls[0].args.join(' ')).not.toContain(prompt);
    expect(calls[0].opts.shell).toBe(false);
    expect(calls[0].stdin).toBe(prompt);
  });
});
