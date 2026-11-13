// The optional AI fallback for Quick Scribe (Build D): the Mac's `claude` CLI (dev bridge) or the person's own key.
// Only the line, today's date and category/tag names are sent (see buildOraclePrompt). Replies are checked by
// parseOracleReply and only ever previewed; nothing is saved until the person confirms.
import { useEffect, useState } from 'react';
import { buildOraclePrompt, ORACLE_SCHEMA, parseOracleReply, type CaptureIntent, type DateKey, type VesperaState } from '../context/VesperaContext';
import { toBridgeAsk } from './bridgeAsk';
import { hasOracleKey, ORACLE_KEY_EVENT, ORACLE_KEY_STORAGE, readOracleKey } from './oracleKey';

export { hasOracleKey, ORACLE_KEY_EVENT, readOracleKey, removeOracleKey, saveOracleKey } from './oracleKey';

export type OracleVia = 'bridge' | 'key';
export type OracleResult =
  | { ok: true; intents: CaptureIntent[]; via: OracleVia }
  | { ok: false; reason: 'unavailable' | 'unreadable' | 'failed'; message: string };

const PROBE_MS = 800;
const MODEL = 'claude-haiku-5-5';

// Everything a person can read here speaks of the Scribe (Quick Scribe); the code keeps its older Oracle names.
export const ORACLE_MESSAGES = {
  unavailable: 'AI help isn’t available right now. Quick Scribe still works without it.',
  unreadable: 'AI couldn’t understand that line.',
  failed: 'Couldn’t reach the AI. Try again in a moment.',
  refused: 'AI declined to answer that line.',
  badKey: 'That key didn’t work. Check it in Settings.',
} as const;

/** Is the dev-only Mac bridge answering? Never asked outside `npm run dev`. */
async function probeBridge(): Promise<boolean> {
  if (!import.meta.env.DEV) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_MS);
  try {
    const res = await fetch('/__oracle/health', { signal: controller.signal });
    if (!res.ok) return false;
    const body: unknown = await res.json();
    return (body as { ok?: unknown } | null)?.ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** The bridge builds its own prompt from the line, today and the names (see bridgeAsk.ts). */
async function askBridge(text: string, state: VesperaState, today: DateKey): Promise<unknown> {
  const res = await fetch('/__oracle', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(toBridgeAsk(text, state, today)),
  });
  if (!res.ok) throw new Error(`bridge ${res.status}`);
  const body: unknown = await res.json();
  return (body as { reply?: unknown } | null)?.reply;
}

class OracleRefusal extends Error {}

async function askWithKey(apiKey: string, system: string, user: string): Promise<unknown> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: ORACLE_SCHEMA as unknown as Record<string, unknown> } },
    system,
    messages: [{ role: 'user', content: user }],
  });
  if (message.stop_reason === 'refusal') throw new OracleRefusal();
  const block = message.content.find((b) => b.type === 'text');
  return block && 'text' in block ? block.text : undefined;
}

function isBadKey(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  return status === 401 || status === 403;
}

/** Ask the Scribe to read one line. The bridge wins when it answers; otherwise the stored key; otherwise unavailable. */
export async function askOracle(text: string, state: VesperaState, today: DateKey): Promise<OracleResult> {
  const via: OracleVia | null = (await probeBridge()) ? 'bridge' : hasOracleKey() ? 'key' : null;
  if (!via) return { ok: false, reason: 'unavailable', message: ORACLE_MESSAGES.unavailable };

  let reply: unknown;
  try {
    if (via === 'bridge') {
      reply = await askBridge(text, state, today);
    } else {
      const key = readOracleKey();
      if (!key) return { ok: false, reason: 'unavailable', message: ORACLE_MESSAGES.unavailable };
      const { system, user } = buildOraclePrompt(text, state, today);
      reply = await askWithKey(key, system, user);
    }
  } catch (err) {
    if (err instanceof OracleRefusal) return { ok: false, reason: 'failed', message: ORACLE_MESSAGES.refused };
    if (via === 'key' && isBadKey(err)) return { ok: false, reason: 'failed', message: ORACLE_MESSAGES.badKey };
    return { ok: false, reason: 'failed', message: ORACLE_MESSAGES.failed };
  }

  const intents = parseOracleReply(reply, state, today);
  if (!intents) return { ok: false, reason: 'unreadable', message: ORACLE_MESSAGES.unreadable };
  return { ok: true, intents, via };
}

/** Which AI route is reachable right now, if any. Re-checks when the key changes, here or in another tab. */
export function useOracleAvailability(): { via: OracleVia | null } {
  const [bridge, setBridge] = useState(false);
  const [keyStored, setKeyStored] = useState(hasOracleKey);

  useEffect(() => {
    let latest = 0;
    const check = () => {
      const run = ++latest;
      setKeyStored(hasOracleKey());
      void probeBridge().then((ok) => {
        if (run === latest) setBridge(ok);
      });
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === ORACLE_KEY_STORAGE) check();
    };
    check();
    window.addEventListener(ORACLE_KEY_EVENT, check);
    window.addEventListener('storage', onStorage);
    return () => {
      latest = -1;
      window.removeEventListener(ORACLE_KEY_EVENT, check);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return { via: bridge ? 'bridge' : keyStored ? 'key' : null };
}
