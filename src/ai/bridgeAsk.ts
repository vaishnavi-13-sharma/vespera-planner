// What the Scribe sends the dev-only Mac bridge (vite/claude-bridge.ts): the line, today, and the category
// and tag names. The bridge checks these strictly and builds the prompt itself, so no caller can stretch the
// line or swap the system prompt (VB-06). Shared by the browser and the bridge (Node), so it imports the pure
// helpers directly rather than through VesperaContext.
import { parseDateKey, toDateKey } from '../context/dates';
import { buildOraclePrompt } from '../context/oracle';
import { visibleCategories } from '../context/selectors';
import type { DateKey, VesperaState } from '../context/types';

export const BRIDGE_LIMITS = { line: 500, items: 40, name: 80 } as const;

export interface BridgeAsk {
  text: string;
  today: DateKey;
  categories: { id: string; name: string }[];
  tags: { id: string; name: string; vocab: boolean }[];
}

const fits = (s: string) => s.length <= BRIDGE_LIMITS.name;

/** The request body for one line. Lists and names are trimmed to the bridge's limits, so a real board always fits. */
export function toBridgeAsk(text: string, state: VesperaState, today: DateKey): BridgeAsk {
  const clip = (s: string) => s.slice(0, BRIDGE_LIMITS.name);
  return {
    text: text.slice(0, BRIDGE_LIMITS.line),
    today,
    categories: visibleCategories(state.categories)
      .filter((c) => fits(c.id))
      .slice(0, BRIDGE_LIMITS.items)
      .map((c) => ({ id: c.id, name: clip(c.name) })),
    tags: state.noteTags
      .filter((t) => fits(t.id))
      .slice(0, BRIDGE_LIMITS.items)
      .map((t) => ({ id: t.id, name: clip(t.name), vocab: !!t.vocab })),
  };
}

export type BridgeAskCheck = { ok: true; ask: BridgeAsk } | { ok: false; error: string };

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isName = (x: unknown): x is string => typeof x === 'string' && fits(x);
const isId = (x: unknown): x is string => isName(x) && x.length > 0;

function list<T>(x: unknown, item: (raw: Record<string, unknown>) => T | null): T[] | null {
  if (!Array.isArray(x) || x.length > BRIDGE_LIMITS.items) return null;
  const out: T[] = [];
  for (const raw of x) {
    const parsed = isObject(raw) ? item(raw) : null;
    if (!parsed) return null;
    out.push(parsed);
  }
  return out;
}

/** Strictly check a bridge request body. Anything unexpected is refused, never repaired. */
export function readBridgeAsk(payload: unknown): BridgeAskCheck {
  if (!isObject(payload)) return { ok: false, error: 'Unreadable request.' };
  const { text, today } = payload;
  if (typeof text !== 'string' || !text.trim() || text.length > BRIDGE_LIMITS.line) {
    return { ok: false, error: `One line of up to ${BRIDGE_LIMITS.line} characters, please.` };
  }
  if (typeof today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(today) || toDateKey(parseDateKey(today)) !== today) {
    return { ok: false, error: 'Today’s date is missing.' };
  }
  const categories = list(payload.categories, (c) => (isId(c.id) && isName(c.name) ? { id: c.id, name: c.name } : null));
  const tags = list(payload.tags, (t) =>
    isId(t.id) && isName(t.name) && typeof t.vocab === 'boolean' ? { id: t.id, name: t.name, vocab: t.vocab } : null,
  );
  if (!categories || !tags) return { ok: false, error: 'Unexpected category or tag list.' };
  return { ok: true, ask: { text, today, categories, tags } };
}

/** The whole prompt for `claude -p`, built here from checked fields only. */
export function bridgePrompt(ask: BridgeAsk): string {
  // buildOraclePrompt reads only these two lists from the board.
  const board = { categories: ask.categories, noteTags: ask.tags } as unknown as VesperaState;
  const { system, user } = buildOraclePrompt(ask.text, board, ask.today);
  return `${system}\n\n${user}`;
}
