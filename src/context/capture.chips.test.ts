// The Quick Scribe's example chips, and the everyday words behind them: "add quest:", "pin note:", "Block 2pm–3pm …".
import { parseCapture } from './capture';
import { createBaseState, createStarterState } from './seed';
import type { VesperaState } from './types';

const TODAY = '2026-11-12'; // a Thursday
const at = (h: number, m = 0) => h * 60 + m;
const base = (): VesperaState => createBaseState(TODAY);
const parse = (line: string, state = base(), now = at(10)) => parseCapture(line, state, TODAY, now);
const firstNoteTag = (state: VesperaState) => state.noteTags.find((t) => !t.vocab)!.id;

describe('the four example chips', () => {
  it('"Add quest: Finish reading ch. 4" is a quest', () => {
    const state = base();
    expect(parse('Add quest: Finish reading ch. 4', state)).toEqual({ kind: 'quest', title: 'Finish reading ch. 4', categoryId: state.categories[0].id });
  });

  it('"Block 2pm–3pm Deep Focus" is the block "Deep Focus", today, 14:00–15:00', () => {
    expect(parse('Block 2pm–3pm Deep Focus')).toMatchObject({ kind: 'block', title: 'Deep Focus', date: TODAY, start: at(14), end: at(15) });
  });

  it('"Pin note: Buy oat milk" is a note under the first non-vocab tag', () => {
    const state = base();
    expect(parse('Pin note: Buy oat milk', state)).toEqual({ kind: 'note', text: 'Buy oat milk', tagId: firstNoteTag(state) });
  });

  it('"Fri 9am Coffee with Mum" is a block on Friday at 9', () => {
    expect(parse('Fri 9am Coffee with Mum')).toMatchObject({ kind: 'block', title: 'Coffee with Mum', date: '2026-11-13', start: at(9), end: at(10) });
  });

  it('reads the same on the starter guide a new board opens with', () => {
    const starter = createStarterState(TODAY, at(10));
    expect(parse('Add quest: Finish reading ch. 4', starter)).toMatchObject({ kind: 'quest', title: 'Finish reading ch. 4' });
    expect(parse('Block 2pm–3pm Deep Focus', starter)).toMatchObject({ kind: 'block', title: 'Deep Focus', start: at(14), end: at(15) });
    expect(parse('Pin note: Buy oat milk', starter)).toMatchObject({ kind: 'note', text: 'Buy oat milk', tagId: firstNoteTag(starter) });
    expect(parse('Fri 9am Coffee with Mum', starter)).toMatchObject({ kind: 'block', title: 'Coffee with Mum' });
  });
});

describe('quest words', () => {
  it.each(['add quest:', 'add:', 'new quest:', 'ADD QUEST :', 'New  Quest:'])('"%s" means a quest', (prefix) => {
    expect(parse(`${prefix} water the roses`)).toMatchObject({ kind: 'quest', title: 'Water the roses' });
  });

  it('keeps a due date after the words', () => {
    expect(parse('add: email the tutor tomorrow')).toMatchObject({ kind: 'quest', title: 'Email the tutor', dueDate: '2026-11-13' });
  });

  it('a quest without a name asks for one', () => {
    expect(parse('add quest:')).toMatchObject({ kind: 'unknown', reason: 'Add something after "add quest:"' });
  });
});

describe('note words', () => {
  it.each(['pin note:', 'pin:', 'add note:', 'Pin Note:'])('"%s" means a note under the first non-vocab tag', (prefix) => {
    const state = base();
    expect(parse(`${prefix} ribbon for the parcel`, state)).toEqual({ kind: 'note', text: 'ribbon for the parcel', tagId: firstNoteTag(state) });
  });

  it('skips a vocab tag listed first', () => {
    const state = base();
    state.noteTags = [...state.noteTags.filter((t) => t.vocab), ...state.noteTags.filter((t) => !t.vocab)];
    expect(parse('pin: tea tin', state)).toMatchObject({ kind: 'note', tagId: firstNoteTag(state) });
  });

  it('says so when there is no note tag', () => {
    const state = { ...base(), noteTags: base().noteTags.filter((t) => t.vocab) };
    expect(parse('pin note: tea tin', state)).toMatchObject({ kind: 'unknown' });
  });
});

describe('a leading "block"', () => {
  it('is left out of the title before a time', () => {
    expect(parse('block 9-10am letters')).toMatchObject({ kind: 'block', title: 'Letters', start: at(9), end: at(10) });
    expect(parse('add block 4pm tea')).toMatchObject({ kind: 'block', title: 'Tea', start: at(16), end: at(17) });
    expect(parse('Block: tomorrow 3-5pm study')).toMatchObject({ kind: 'block', title: 'Study', date: '2026-11-13', start: at(15), end: at(17) });
  });

  it('stays in the words when no time follows', () => {
    expect(parse('block out the weekend')).toMatchObject({ kind: 'quest', title: 'Block out the weekend' });
    expect(parse('blockade picnic')).toMatchObject({ kind: 'quest', title: 'Blockade picnic' });
  });

  it('a block without a name asks for one', () => {
    expect(parse('block 2pm-3pm')).toMatchObject({ kind: 'unknown', reason: 'Give the block a name' });
  });
});
