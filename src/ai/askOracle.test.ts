import { createBaseState, exportState } from '../context/VesperaContext';
import { askOracle, hasOracleKey, ORACLE_MESSAGES, removeOracleKey, saveOracleKey } from './askOracle';
import { readBridgeAsk } from './bridgeAsk';

const sdk = vi.hoisted(() => ({ create: vi.fn(), ctor: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: sdk.create };
    constructor(opts: unknown) {
      sdk.ctor(opts);
    }
  },
}));

const TODAY = '2026-11-12';
const state = createBaseState(TODAY);
const reply = JSON.stringify({ actions: [{ kind: 'quest', title: 'Email prof', categoryId: 'cat-work', dueDate: '2026-11-13' }] });

beforeEach(() => {
  localStorage.clear();
  sdk.create.mockReset();
  sdk.ctor.mockReset();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no bridge')));
});
afterEach(() => vi.unstubAllGlobals());

describe('askOracle', () => {
  it('is unavailable without the bridge or a key', async () => {
    await expect(askOracle('buy stamps', state, TODAY)).resolves.toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('uses the Mac bridge when it answers', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/__oracle/health') return new Response(JSON.stringify({ ok: true }));
      return new Response(JSON.stringify({ reply }));
    }));
    const result = await askOracle('email prof tomorrow', state, TODAY);
    expect(result).toMatchObject({ ok: true, via: 'bridge', intents: [{ kind: 'quest', title: 'Email prof', dueDate: '2026-11-13' }] });
  });

  it('sends the bridge only the line, today and names, never a prompt of its own (VB-06)', async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url === '/__oracle/health') return new Response(JSON.stringify({ ok: true }));
      return new Response(JSON.stringify({ reply }));
    });
    vi.stubGlobal('fetch', fetchMock);
    await askOracle('email prof tomorrow', state, TODAY);
    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(Object.keys(body).sort()).toEqual(['categories', 'tags', 'text', 'today']);
    expect(body).toMatchObject({ text: 'email prof tomorrow', today: TODAY });
    expect(readBridgeAsk(body).ok).toBe(true);
  });

  it('uses your own key with the cheapest Haiku and structured JSON', async () => {
    saveOracleKey('sk-ant-test');
    sdk.create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: reply }] });
    const result = await askOracle('email prof tomorrow', state, TODAY);
    expect(result).toMatchObject({ ok: true, via: 'key' });
    expect(sdk.ctor).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'sk-ant-test', dangerouslyAllowBrowser: true }));
    const params = sdk.create.mock.calls[0][0];
    expect(params.model).toBe('claude-haiku-5-5');
    expect(params.output_config.format.type).toBe('json_schema');
    expect(JSON.stringify(params)).not.toContain('sk-ant-test');
  });

  it('turns an unreadable reply into a gentle message', async () => {
    saveOracleKey('sk-ant-test');
    sdk.create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json' }] });
    await expect(askOracle('???', state, TODAY)).resolves.toMatchObject({ ok: false, reason: 'unreadable', message: 'AI couldn’t understand that line.' });
  });

  it('speaks of the Scribe in every message a person can see', () => {
    for (const message of Object.values(ORACLE_MESSAGES)) expect(message).not.toMatch(/oracle/i);
    expect(ORACLE_MESSAGES.unavailable).toMatch(/Scribe/);
  });
});

describe('the key', () => {
  it('stays on this device and out of the board', () => {
    saveOracleKey('sk-ant-secret');
    expect(hasOracleKey()).toBe(true);
    expect(exportState(state)).not.toContain('sk-ant-secret');
    removeOracleKey();
    expect(hasOracleKey()).toBe(false);
  });
});
