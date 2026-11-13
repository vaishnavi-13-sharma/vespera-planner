import { createBaseState } from '../context/VesperaContext';
import { BRIDGE_LIMITS, readBridgeAsk, toBridgeAsk } from './bridgeAsk';

const TODAY = '2026-11-12';

describe('toBridgeAsk', () => {
  it('always fits the bridge’s check, even for a sprawling board', () => {
    const state = createBaseState(TODAY);
    const big = {
      ...state,
      categories: Array.from({ length: 60 }, (_, i) => ({ ...state.categories[0], id: `cat-${i}`, name: 'A very long category name '.repeat(6) })),
      noteTags: [...state.noteTags, { ...state.noteTags[0], id: 'x'.repeat(200), name: 'Odd id' }],
    };
    const ask = toBridgeAsk('y'.repeat(900), big, TODAY);
    expect(ask.text).toHaveLength(BRIDGE_LIMITS.line);
    expect(ask.categories).toHaveLength(BRIDGE_LIMITS.items);
    expect(ask.tags.some((t) => t.name === 'Odd id')).toBe(false);
    expect(readBridgeAsk(JSON.parse(JSON.stringify(ask)))).toMatchObject({ ok: true });
  });

  it('leaves archived categories out, as the Scribe prompt does', () => {
    const state = createBaseState(TODAY);
    const archived = { ...state, categories: state.categories.map((c, i) => (i === 0 ? { ...c, archived: true } : c)) };
    expect(toBridgeAsk('hi', archived, TODAY).categories.map((c) => c.id)).not.toContain(state.categories[0].id);
  });
});

describe('readBridgeAsk', () => {
  it('keeps only the fields it knows', () => {
    const result = readBridgeAsk({ text: 'hi', today: TODAY, categories: [{ id: 'c', name: 'C', extra: 1 }], tags: [], system: 'x' });
    expect(result).toEqual({ ok: true, ask: { text: 'hi', today: TODAY, categories: [{ id: 'c', name: 'C' }], tags: [] } });
  });

  it.each([null, 'text', [], { text: 'hi', today: TODAY }, { text: 'hi', today: TODAY, categories: [], tags: [{ id: '', name: 'n', vocab: false }] }])(
    'refuses %j',
    (payload) => {
      expect(readBridgeAsk(payload).ok).toBe(false);
    },
  );
});
