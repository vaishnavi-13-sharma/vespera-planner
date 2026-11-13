import { parseCaptures } from './capture';
import { applyCapture, revertCapture, vesperaReducer } from './reducer';
import { createBaseState } from './seed';
import { parseState, persistable } from './storage';
import type { OneOffBlock, Series, VesperaState } from './types';

const TODAY = '2026-11-12';
const at = (h: number, m = 0) => h * 60 + m;
const shift: OneOffBlock = { id: 'b-shift', date: TODAY, title: 'Bookshop shift', kind: 'flexible', start: at(18), end: at(19) };
const reading: Series = { id: 'ser-read', title: 'Reading', kind: 'flexible', start: at(19), end: at(20), repeat: { freq: 'daily' }, startDate: '2026-11-01' };
const board = (): VesperaState => ({ ...createBaseState(TODAY), blocks: [shift], series: [reading] });
const ids = (n: number) => Array.from({ length: n + 1 }, (_, i) => `id-${i}`);

const TEXT = [
  'Thu 3-5pm study',
  'every mon 9-10 gym',
  'quest: email prof tomorrow',
  'groceries: milk',
  'vocab: halcyon - calm',
  'slide evening 30m',
  '25pm tea',
].join('\n');

describe('applyCapture', () => {
  it('saves every readable line in one step and returns a receipt', () => {
    const original = board();
    const lines = parseCaptures(TEXT, original, TODAY, at(10));
    const { state, receipt } = applyCapture(original, lines, ids(lines.length), 1000);
    expect(receipt.count).toBe(6);
    expect(receipt.blockIds).toHaveLength(1);
    expect(receipt.seriesIds).toHaveLength(1);
    expect(receipt.taskIds).toHaveLength(1);
    expect(receipt.noteIds).toHaveLength(2);
    expect(state.blocks.find((b) => b.title === 'Study')).toMatchObject({ date: TODAY, start: at(15), end: at(17), kind: 'flexible', categoryId: 'cat-study' });
    expect(state.series.find((s) => s.title === 'Gym')).toMatchObject({ repeat: { freq: 'weekly', interval: 1, weekdays: [1] }, startDate: '2026-11-16' });
    expect(state.tasks.find((t) => t.title === 'Email prof')).toMatchObject({ dueDate: '2026-11-13', done: false });
    expect(state.notes.find((n) => n.text === 'halcyon')).toMatchObject({ definition: 'calm', tagId: 'tag-vocab' });
    expect(state.blocks.find((b) => b.id === 'b-shift')).toMatchObject({ start: at(18, 30), end: at(19, 30) });
    expect(state.exceptions['ser-read'][TODAY].overrides).toEqual({ start: at(19, 30), end: at(20, 30) });
    expect(state.captureLog.map((e) => e.text)).toEqual([...TEXT.split('\n').slice(0, 6)].reverse());
    expect(state.captureLog[0]).toMatchObject({ summary: 'Slide · evening · 30 min later', at: 1000 });
  });

  it('keeps only the last eight log entries', () => {
    let state = board();
    for (let i = 0; i < 5; i++) {
      const lines = parseCaptures('note: a\nnote: b', state, TODAY, at(10));
      state = applyCapture(state, lines, lines.map((_, j) => `n${i}-${j}`).concat(`r${i}`), i).state;
    }
    expect(state.captureLog).toHaveLength(8);
  });

  it('changes nothing when no line is readable', () => {
    const original = board();
    const lines = parseCaptures('25pm tea\nslide 30', original, TODAY, at(10));
    const { state, receipt } = applyCapture(original, lines, ids(lines.length), 0);
    expect(receipt.count).toBe(0);
    expect(state).toBe(original);
  });
});

describe('revertCapture', () => {
  it('puts the board back exactly as it was', () => {
    const original = board();
    const lines = parseCaptures(TEXT, original, TODAY, at(10));
    const { state, receipt } = applyCapture(original, lines, ids(lines.length), 1000);
    const reverted = revertCapture(state, receipt);
    expect({ ...reverted, captureLog: [] }).toEqual({ ...original, captureLog: [] });
    expect(reverted.captureLog).toEqual([]);
  });

  it('works through the reducer actions', () => {
    const original = board();
    const lines = parseCaptures('quest: a\nslide 15m', original, TODAY, at(10));
    const actionIds = ids(lines.length);
    const { receipt } = applyCapture(original, lines, actionIds, 5);
    const after = vesperaReducer(original, { type: 'capture', lines, ids: actionIds, at: 5 });
    expect(after.tasks).toHaveLength(1);
    const undone = vesperaReducer(after, { type: 'undoCapture', receipt });
    expect(undone.tasks).toHaveLength(0);
    expect(undone.blocks).toEqual(original.blocks);
  });
});

describe('the capture log is never saved', () => {
  it('is dropped when persisting and when loading', () => {
    const original = board();
    const lines = parseCaptures('note: a', original, TODAY, at(10));
    const { state } = applyCapture(original, lines, ids(1), 0);
    expect(persistable(state).captureLog).toEqual([]);
    expect(parseState(JSON.parse(JSON.stringify(state)))!.captureLog).toEqual([]);
  });
});
