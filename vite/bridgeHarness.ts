// Drives the dev bridge's middleware in-process, with fake req/res objects. Tests that import this
// must also `vi.mock('node:child_process', …)` (see fakeSpawn) so no real `claude` is ever started.
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { claudeBridge, type BridgeOptions } from './claude-bridge';

type Middleware = (req: unknown, res: unknown, next: () => void) => unknown;

export interface FakeRequest {
  method?: string;
  url?: string;
  remoteAddress?: string;
  headers?: Record<string, string>;
  /** The body to send; omit `end` to leave the request open forever. */
  body?: string;
  end?: boolean;
}

export interface FakeResponse {
  status: number;
  body: unknown;
  /** Did the bridge close the request (rather than leave the socket open)? */
  hungUp?: () => boolean;
}

/** The bridge middleware, installed exactly as `vite` would (with VESPERA_CLAUDE_BRIDGE=1). */
export function bridgeMiddleware(options?: BridgeOptions): Middleware {
  const previous = process.env.VESPERA_CLAUDE_BRIDGE;
  process.env.VESPERA_CLAUDE_BRIDGE = '1';
  let handler: Middleware | null = null;
  try {
    const hook = claudeBridge(options).configureServer as unknown as (server: unknown) => void;
    hook({
      middlewares: { use: (fn: Middleware) => (handler = fn) },
      config: { logger: { warn: () => {} } },
    });
  } finally {
    if (previous === undefined) delete process.env.VESPERA_CLAUDE_BRIDGE;
    else process.env.VESPERA_CLAUDE_BRIDGE = previous;
  }
  if (!handler) throw new Error('bridge did not install its middleware');
  return handler;
}

/** Send one request; resolves with the response, or null if none came within `waitMs`. */
export function send(middleware: Middleware, request: FakeRequest, waitMs = 1000): Promise<FakeResponse | null> {
  const req = Object.assign(new PassThrough(), {
    method: request.method ?? 'POST',
    url: request.url ?? '/__oracle',
    headers: {
      host: 'localhost:5173',
      origin: 'http://localhost:5173',
      'content-type': 'application/json',
      ...request.headers,
    },
    socket: { remoteAddress: request.remoteAddress ?? '127.0.0.1', localPort: 5173 },
  });
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), waitMs);
    const res = Object.assign(new EventEmitter(), {
      statusCode: 200,
      setHeader: () => {},
      end: (text: string) => {
        clearTimeout(timer);
        resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null, hungUp: () => req.destroyed });
        res.emit('finish');
      },
    });
    void middleware(req, res, () => {
      clearTimeout(timer);
      resolve({ status: 404, body: null });
    });
    if (request.body !== undefined) req.write(request.body);
    if (request.end !== false) req.end();
  });
}

/** A stand-in for child_process.spawn that records the prompt and answers like `claude -p --output-format json`. */
export function fakeSpawnImpl(prompts: string[]) {
  return () => {
    const child = Object.assign(new EventEmitter(), {
      stdin: new PassThrough(),
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      kill: () => {},
    });
    let prompt = '';
    child.stdin.on('data', (d: Buffer) => (prompt += d));
    child.stdin.on('finish', () => {
      prompts.push(prompt);
      child.stdout.end(JSON.stringify({ result: '{"actions":[]}' }));
      setTimeout(() => child.emit('close', 0), 0);
    });
    return child;
  };
}
