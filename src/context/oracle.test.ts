import { buildOraclePrompt, ORACLE_SCHEMA, parseOracleReply } from './oracle';
import { createBaseState } from './seed';
import type { VesperaState } from './types';

const TODAY = '2026-11-12';
const board = (): VesperaState => ({
  ...createBaseState(TODAY),
  tasks: [{ id: 't1', title: 'Secret thesis title', categoryId: 'cat-study', done: false }],
  notes: [{ id: 'n1', tagId: 'tag-braindump', text: 'Private diary line' }],
});

describe('buildOraclePrompt', () => {
  it('sends only the line, today, and the category and tag names', () => {
    const { system, user } = buildOraclePrompt('email prof tomorrow', board(), TODAY);
    expect(user).toContain('email prof tomorrow');
    expect(system).toContain('2026-11-12');
    expect(system).toContain('Thursday');
    for (const s of ['cat-work', 'Work', 'cat-study', 'tag-grocery', 'Groceries', 'tag-vocab']) expect(system).toContain(s);
    expect(system + user).not.toContain('Secret thesis title');
    expect(system + user).not.toContain('Private diary line');
  });

  it('keeps the line short', () => {
    expect(buildOraclePrompt('x'.repeat(2000), board(), TODAY).user.length).toBeLessThan(700);
  });
});

describe('ORACLE_SCHEMA', () => {
  it('is a closed object schema with an actions array', () => {
    const schema = ORACLE_SCHEMA as unknown as { type: string; additionalProperties: boolean; required: string[]; properties: { actions: { items: { additionalProperties: boolean; required: string[] } } } };
    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['actions']);
    expect(schema.properties.actions.items.additionalProperties).toBe(false);
    expect(schema.properties.actions.items.required).toEqual(['kind', 'title', 'detail', 'date', 'start', 'end', 'categoryId', 'tagId']);
  });
});

describe('parseOracleReply', () => {
  const state = board();
  const flat = (a: Record<string, unknown>) => ({ kind: 'quest', title: '', detail: '', date: '', start: '', end: '', categoryId: '', tagId: '', ...a });

  it('reads every kind from the schema shape, as a string or an object', () => {
    const reply = {
      actions: [
        flat({ kind: 'block', title: 'Study', date: '2026-11-13', start: '15:00', end: '17:00', categoryId: 'cat-study' }),
        flat({ kind: 'quest', title: 'Email prof', date: '2026-11-13', categoryId: 'cat-work' }),
        flat({ kind: 'note', title: 'milk', tagId: 'tag-grocery' }),
        flat({ kind: 'vocab', title: 'halcyon', detail: 'calm' }),
      ],
    };
    const expected = [
      { kind: 'block', title: 'Study', date: '2026-11-13', start: 900, end: 1020, categoryId: 'cat-study' },
      { kind: 'quest', title: 'Email prof', categoryId: 'cat-work', dueDate: '2026-11-13' },
      { kind: 'note', text: 'milk', tagId: 'tag-grocery' },
      { kind: 'vocab', word: 'halcyon', definition: 'calm', tagId: 'tag-vocab' },
    ];
    expect(parseOracleReply(reply, state, TODAY)).toEqual(expected);
    expect(parseOracleReply(JSON.stringify(reply), state, TODAY)).toEqual(expected);
    expect(parseOracleReply('```json\n' + JSON.stringify(reply) + '\n```', state, TODAY)).toEqual(expected);
  });

  it('tolerates natural field names and minute numbers', () => {
    expect(parseOracleReply({ actions: [{ kind: 'quest', title: 'Email prof', categoryId: 'cat-work', dueDate: '2026-11-13' }] }, state, TODAY)).toEqual([
      { kind: 'quest', title: 'Email prof', categoryId: 'cat-work', dueDate: '2026-11-13' },
    ]);
    expect(parseOracleReply({ actions: [{ kind: 'block', title: 'Run', date: TODAY, start: 420, end: 480 }] }, state, TODAY)).toEqual([
      { kind: 'block', title: 'Run', date: TODAY, start: 420, end: 480 },
    ]);
  });

  it('repairs ids it does not recognise', () => {
    const [quest, note, block] = parseOracleReply(
      { actions: [flat({ title: 'A', categoryId: 'cat-hacked' }), flat({ kind: 'note', title: 'B', tagId: 'tag-vocab' }), flat({ kind: 'block', title: 'C', date: TODAY, start: '09:00', end: '10:00', categoryId: 'nope' })] },
      state,
      TODAY,
    )!;
    expect(quest).toMatchObject({ categoryId: 'cat-reset' });
    expect(note).toMatchObject({ tagId: 'tag-braindump' });
    expect(block).not.toHaveProperty('categoryId');
  });

  it('caps text and the number of actions', () => {
    const many = { actions: Array.from({ length: 15 }, (_, i) => flat({ title: `Quest ${i} ${'x'.repeat(300)}` })) };
    const result = parseOracleReply(many, state, TODAY)!;
    expect(result).toHaveLength(10);
    expect((result[0] as { title: string }).title.length).toBe(200);
  });

  it('drops unknown kinds, bad dates and impossible times', () => {
    const result = parseOracleReply(
      {
        actions: [
          flat({ kind: 'deleteEverything', title: 'x' }),
          flat({ kind: 'slide', title: 'x' }),
          flat({ title: 'Far future', date: '2030-01-01' }),
          flat({ title: 'Not a date', date: '13/45' }),
          flat({ kind: 'block', title: 'Backwards', date: TODAY, start: '17:00', end: '15:00' }),
          flat({ kind: 'block', title: 'Too late', date: TODAY, start: '23:00', end: '25:00' }),
          flat({ kind: 'block', title: 'No time', date: TODAY }),
          flat({ title: '   ' }),
          flat({ title: 'Keeper' }),
        ],
      },
      state,
      TODAY,
    );
    expect(result).toEqual([{ kind: 'quest', title: 'Keeper', categoryId: 'cat-reset' }]);
  });

  it('returns null for anything malformed or empty', () => {
    for (const bad of ['not json', '{"actions": "nope"}', '[]', 42, null, { actions: [] }, { actions: [flat({ kind: 'nope' })] }]) {
      expect(parseOracleReply(bad, state, TODAY)).toBeNull();
    }
  });
});
