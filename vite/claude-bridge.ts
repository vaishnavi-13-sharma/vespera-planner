// Dev-only bridge from Vespera to the Mac's `claude` CLI (Build D). Never part of the production build.
// Opt in with `VESPERA_CLAUDE_BRIDGE=1 npm run dev`. Only this Mac's own Vespera tab may call it:
// loopback sockets, a localhost Host (no DNS rebinding), a same-origin JSON POST, small bodies read against a
// deadline, one at a time. The prompt is built here from the checked line and names (src/ai/bridgeAsk.ts).
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { bridgePrompt, readBridgeAsk } from '../src/ai/bridgeAsk';

const MAX_BODY = 16_384;
const MAX_OUTPUT = 1_000_000;
const BODY_DEADLINE_MS = 2000;
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export interface BridgeRequest {
  method: string;
  remoteAddress?: string;
  headers: Record<string, string | undefined>;
}

export type BridgeCheck = { ok: true } | { ok: false; status: number; error: string };

/**
 * The guard every /__oracle request passes before its body is even read: who is asking (address, Host,
 * Origin), how (JSON), and a declared length that fits. Pure, so it is tested on its own.
 */
export function checkBridgeRequest(req: BridgeRequest, port: number): BridgeCheck {
  if (!req.remoteAddress || !LOOPBACK.has(req.remoteAddress)) return { ok: false, status: 403, error: 'Only this Mac may ask.' };
  const hosts = [`localhost:${port}`, `127.0.0.1:${port}`];
  if (!hosts.includes(req.headers.host ?? '')) return { ok: false, status: 403, error: 'Unexpected host.' };
  if (req.method === 'POST') {
    if (!hosts.map((h) => `http://${h}`).includes(req.headers.origin ?? '')) return { ok: false, status: 403, error: 'Unexpected origin.' };
    if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      return { ok: false, status: 415, error: 'JSON only.' };
    }
  }
  if (Number(req.headers['content-length'] ?? 0) > MAX_BODY) return { ok: false, status: 413, error: 'Too long.' };
  return { ok: true };
}

export type SpawnLike = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;

/**
 * Ask the `claude` CLI once, with every tool turned off. The prompt travels on stdin, never in argv or
 * through a shell, so nothing in it can run. Resolves the CLI's `result` text.
 */
export function runClaude(prompt: string, spawnImpl: SpawnLike = spawn, timeoutMs = 30_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawnImpl(
      'claude',
      ['-p', '--output-format', 'json', '--tools', '', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence'],
      { shell: false, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let out = '';
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(() => reject(new Error('The claude CLI took too long.')));
    }, timeoutMs);

    child.on('error', (err) => finish(() => reject(err)));
    child.stdout?.on('data', (chunk) => {
      out += chunk;
      if (out.length > MAX_OUTPUT) {
        child.kill();
        finish(() => reject(new Error('The claude CLI said too much.')));
      }
    });
    child.stderr?.resume();
    child.on('close', (code) =>
      finish(() => {
        if (code !== 0) return reject(new Error(`The claude CLI exited with code ${code}.`));
        try {
          const parsed: unknown = JSON.parse(out);
          const result = (parsed as { result?: unknown; is_error?: unknown })?.result;
          if ((parsed as { is_error?: unknown }).is_error === true || typeof result !== 'string') {
            return reject(new Error('The claude CLI did not answer.'));
          }
          resolve(result);
        } catch {
          reject(new Error('The claude CLI answered in an unexpected shape.'));
        }
      }),
    );
    child.stdin?.on('error', () => {});
    child.stdin?.end(prompt);
  });
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

/** Answer and hang up without reading (the rest of) the body, so a refused caller can't hold the socket open. */
function refuse(req: IncomingMessage, res: ServerResponse, status: number, error: string) {
  res.setHeader('connection', 'close');
  res.once('finish', () => req.destroy());
  send(res, status, { error });
}

type BodyRead = { ok: true; body: string } | { ok: false; status: number; error: string };

/** Read at most MAX_BODY bytes within the deadline; a longer or slower body is refused and never parsed. */
function readBody(req: IncomingMessage, deadlineMs: number): Promise<BodyRead> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let length = 0;
    const finish = (result: BodyRead) => {
      clearTimeout(timer);
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      resolve(result);
    };
    const timer = setTimeout(() => finish({ ok: false, status: 408, error: 'Too slow.' }), deadlineMs);
    const onData = (chunk: Buffer) => {
      length += chunk.length;
      if (length > MAX_BODY) return finish({ ok: false, status: 413, error: 'Too long.' });
      chunks.push(chunk);
    };
    const onEnd = () => finish({ ok: true, body: Buffer.concat(chunks).toString('utf8') });
    const onError = () => finish({ ok: false, status: 400, error: 'Unreadable request.' });
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

export interface BridgeOptions {
  /** How long a caller has to send its whole body. */
  bodyDeadlineMs?: number;
}

export function claudeBridge({ bodyDeadlineMs = BODY_DEADLINE_MS }: BridgeOptions = {}): Plugin {
  return {
    name: 'vespera-claude-bridge',
    apply: 'serve',
    configureServer(server) {
      if (process.env.VESPERA_CLAUDE_BRIDGE !== '1') return;
      let busy = false;

      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        if (path !== '/__oracle' && path !== '/__oracle/health') return next();
        const port = req.socket.localPort ?? 0;
        const headers = {
          host: req.headers.host,
          origin: req.headers.origin,
          'content-type': req.headers['content-type'],
          'content-length': req.headers['content-length'],
        };
        // Guard first: nothing from a refused caller is read, parsed or waited for.
        const check = checkBridgeRequest({ method: req.method ?? '', remoteAddress: req.socket.remoteAddress, headers }, port);

        if (path === '/__oracle/health') {
          if (req.method !== 'GET') return refuse(req, res, 405, 'GET only.');
          return check.ok ? send(res, 200, { ok: true }) : refuse(req, res, check.status, check.error);
        }

        if (req.method !== 'POST') return refuse(req, res, 405, 'POST only.');
        if (!check.ok) return refuse(req, res, check.status, check.error);

        const read = await readBody(req, bodyDeadlineMs);
        if (!read.ok) return refuse(req, res, read.status, read.error);
        let payload: unknown;
        try {
          payload = JSON.parse(read.body);
        } catch {
          return send(res, 400, { error: 'Unreadable request.' });
        }
        const ask = readBridgeAsk(payload);
        if (!ask.ok) return send(res, 400, { error: ask.error });
        if (busy) return send(res, 429, { error: 'The Scribe is still writing.' });

        busy = true;
        try {
          const reply = await runClaude(bridgePrompt(ask.ask));
          send(res, 200, { reply });
        } catch (err) {
          server.config.logger.warn(`[vespera-claude-bridge] ${(err as Error).message}`);
          send(res, 502, { error: 'The claude CLI could not answer.' });
        } finally {
          busy = false;
        }
      });
    },
  };
}
