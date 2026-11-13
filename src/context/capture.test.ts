import { describeIntent, parseCapture, parseCaptures, type CaptureIntent } from './capture';
import { createBaseState } from './seed';
import type { OneOffBlock, Series, VesperaState } from './types';

const TODAY = '2026-11-12'; // a Thursday
const at = (h: number, m = 0) => h * 60 + m;
const base = (extra: Partial<VesperaState> = {}): VesperaState => ({ ...createBaseState(TODAY), ...extra });
const parse = (line: string, state = base(), now = at(10)) => parseCapture(line, state, TODAY, now);

describe('blocks', () => {
  it('reads a weekday and a time range, and links a matching category', () => {
    expect(parse('Thu 3-5pm study')).toEqual({ kind: 'block', title: 'Study', date: TODAY, start: at(15), end: at(17), categoryId: 'cat-study' });
  });

  it('moves a weekday block to next week once today’s slot has passed', () => {
    expect(parse('Thu 3-5pm study', base(), at(18))).toMatchObject({ kind: 'block', date: '2026-11-19' });
    expect(parse('Thu 3-5pm study', base(), at(16))).toMatchObject({ kind: 'block', date: TODAY });
  });

  it('reads minutes, am/pm on the end only, and a missing category', () => {
    expect(parse('fri 9:30-10:15am deep work')).toEqual({ kind: 'block', title: 'Deep work', date: '2026-11-13', start: at(9, 30), end: at(10, 15), categoryId: 'cat-work' });
    expect(parse('11-1pm lunch')).toMatchObject({ kind: 'block', title: 'Lunch', date: TODAY, start: at(11), end: at(13) });
    expect(parse('3pm to 5pm reading')).toMatchObject({ start: at(15), end: at(17) });
    expect(parse('15:00-17:00 lab')).toMatchObject({ start: at(15), end: at(17) });
  });

  it('reads a single time with a duration, defaulting to an hour', () => {
    expect(parse('tomorrow at 3 call mum for 45m')).toEqual({ kind: 'block', title: 'Call mum', date: '2026-11-13', start: at(15), end: at(15, 45) });
    expect(parse('tomorrow 7am run')).toMatchObject({ start: at(7), end: at(8) });
    expect(parse('sat 10am brunch 1.5h')).toMatchObject({ date: '2026-11-14', start: at(10), end: at(11, 30) });
    expect(parse('tomorrow evening movie')).toMatchObject({ start: at(18), end: at(19) });
    expect(parse('tonight journal')).toMatchObject({ date: TODAY, start: at(20), end: at(21) });
  });

  it('reads next weekdays and calendar dates', () => {
    expect(parse('next fri 2pm dentist')).toMatchObject({ date: '2026-11-20', start: at(14) });
    expect(parse('Nov 20 noon lunch')).toMatchObject({ date: '2026-11-20', start: at(12), title: 'Lunch' });
    expect(parse('11/20 noon lunch')).toMatchObject({ date: '2026-11-20', start: at(12) });
    expect(parse('20 Nov 9am interview')).toMatchObject({ date: '2026-11-20', start: at(9) });
    expect(parse('Jan 5 9am term starts')).toMatchObject({ date: '2027-01-05' });
  });

  it('reads repeating blocks', () => {
    expect(parse('every mon wed 9-10 gym')).toEqual({
      kind: 'block', title: 'Gym', date: '2026-11-16', start: at(9), end: at(10), repeat: { freq: 'weekly', interval: 1, weekdays: [1, 3] },
    });
    expect(parse('daily 7am stretch')).toMatchObject({ date: TODAY, repeat: { freq: 'daily' }, start: at(7) });
    expect(parse('weekdays 8:30-9am commute')).toMatchObject({ repeat: { freq: 'weekdays' }, start: at(8, 30), end: at(9) });
  });

  it('links a block with #category', () => {
    expect(parse('tomorrow 2-3pm sync #work')).toMatchObject({ kind: 'block', title: 'Sync', categoryId: 'cat-work' });
  });
});

describe('quests', () => {
  it('reads a prefixed quest with a due date', () => {
    expect(parse('quest: email prof tomorrow')).toEqual({ kind: 'quest', title: 'Email prof', categoryId: 'cat-reset', dueDate: '2026-11-13' });
    expect(parse('todo: pay rent fri')).toMatchObject({ kind: 'quest', title: 'Pay rent', dueDate: '2026-11-13' });
  });

  it('turns plain text with a date into a quest, with #category', () => {
    expect(parse('email prof tomorrow #work')).toEqual({ kind: 'quest', title: 'Email prof', categoryId: 'cat-work', dueDate: '2026-11-13' });
  });

  it('marks a plain line as a guess', () => {
    expect(parse('buy stamps')).toEqual({ kind: 'quest', title: 'Buy stamps', categoryId: 'cat-reset', guessed: true });
  });

  it('never mistakes a bare number for a time', () => {
    expect(parse('finish 3 Exam modules')).toMatchObject({ kind: 'quest', title: 'Finish 3 Exam modules' });
  });

  it('skips archived categories', () => {
    const state = base();
    state.categories = state.categories.map((c) => (c.id === 'cat-reset' ? { ...c, archived: true } : c));
    expect(parse('buy stamps', state)).toMatchObject({ categoryId: 'cat-work' });
  });
});

describe('notes and vocab', () => {
  it('files a note under a named tag', () => {
    expect(parse('groceries: milk, eggs')).toEqual({ kind: 'note', text: 'milk, eggs', tagId: 'tag-grocery' });
    expect(parse('Reminders: call the bank')).toEqual({ kind: 'note', text: 'call the bank', tagId: 'tag-reminder' });
    expect(parse('note: call back')).toEqual({ kind: 'note', text: 'call back', tagId: 'tag-braindump' });
  });

  it('makes vocab cards', () => {
    expect(parse('vocab: halcyon - calm and peaceful')).toEqual({ kind: 'vocab', word: 'halcyon', definition: 'calm and peaceful', tagId: 'tag-vocab' });
    expect(parse('word: limn: to depict')).toMatchObject({ kind: 'vocab', word: 'limn', definition: 'to depict' });
    expect(parse('vocab: petrichor')).toMatchObject({ kind: 'vocab', word: 'petrichor', definition: '' });
  });
});

describe('slides', () => {
  const evening: OneOffBlock = { id: 'b-eve', date: TODAY, title: 'Study session', kind: 'focus', start: at(18), end: at(19) };
  const morning: OneOffBlock = { id: 'b-morn', date: TODAY, title: 'Gym', kind: 'flexible', start: at(11), end: at(12) };
  const anchor: OneOffBlock = { id: 'b-anchor', date: TODAY, title: 'Shift', kind: 'anchor', start: at(17), end: at(18) };
  const board = base({ blocks: [morning, anchor, evening] });

  it('slides the evening, skipping locked anchors', () => {
    expect(parse('slide evening 30m', board)).toEqual({ kind: 'slide', minutes: 30, date: TODAY, occurrenceKey: 'b-eve', label: 'evening' });
  });

  it('slides from now on, or a named block', () => {
    expect(parse('slide 1h', board)).toMatchObject({ kind: 'slide', minutes: 60, occurrenceKey: 'b-morn', label: 'the rest of today' });
    expect(parse('push study 15 min', board)).toMatchObject({ kind: 'slide', minutes: 15, occurrenceKey: 'b-eve', label: 'Study session' });
  });

  it('slides a repeating block by its occurrence key', () => {
    const series: Series = { id: 'ser-x', title: 'Reading', kind: 'flexible', start: at(19), end: at(20), repeat: { freq: 'daily' }, startDate: '2026-11-01' };
    expect(parse('slide evening 30m', base({ series: [series] }))).toMatchObject({ occurrenceKey: `ser-x@${TODAY}` });
  });

  it('explains when there is nothing to slide or no duration', () => {
    expect(parse('slide 30m')).toMatchObject({ kind: 'unknown', reason: 'Nothing left to slide today' });
    expect(parse('slide evening', board)).toMatchObject({ kind: 'unknown', reason: 'Say how long, like "slide evening 30m"' });
    expect(parse('slide evening 300m', board)).toMatchObject({ kind: 'unknown' });
  });
});

describe('unknown lines', () => {
  it('flags empty prefixes and impossible times', () => {
    expect(parse('quest:')).toMatchObject({ kind: 'unknown' });
    expect(parse('25pm tea')).toMatchObject({ kind: 'unknown' });
    expect(parse('tomorrow 3pm')).toMatchObject({ kind: 'unknown', reason: 'Give the block a name' });
  });

  it('ignores blank lines', () => {
    expect(parse('   ')).toBeNull();
  });
});

describe('parseCaptures', () => {
  it('keeps each non-blank line with its reading', () => {
    const lines = parseCaptures('buy stamps\n\n  quest: email prof tomorrow  \n', base(), TODAY, at(10));
    expect(lines.map((l) => l.line)).toEqual(['buy stamps', 'quest: email prof tomorrow']);
    expect(lines[1].intent).toMatchObject({ kind: 'quest', dueDate: '2026-11-13' });
  });
});

describe('describeIntent', () => {
  const state = base();
  const cases: [CaptureIntent, string][] = [
    [{ kind: 'block', title: 'Study', date: '2026-11-13', start: at(15), end: at(17), categoryId: 'cat-study' }, 'Block · Fri 13 Nov · 3:00 PM – 5:00 PM · Study'],
    [{ kind: 'block', title: 'Gym', date: '2026-11-16', start: at(9), end: at(10), repeat: { freq: 'weekly', interval: 1, weekdays: [1, 3] } }, 'Block · Mon 16 Nov · 9:00 AM – 10:00 AM · Weekly · Mon, Wed'],
    [{ kind: 'quest', title: 'Email prof', categoryId: 'cat-work', dueDate: '2026-11-13' }, 'Quest · Work · due Fri 13 Nov'],
    [{ kind: 'quest', title: 'Buy stamps', categoryId: 'cat-reset', guessed: true }, 'Quest · Quick Reset & Self-Care'],
    [{ kind: 'note', text: 'milk', tagId: 'tag-grocery' }, 'Note · Groceries'],
    [{ kind: 'vocab', word: 'halcyon', definition: 'calm', tagId: 'tag-vocab' }, 'Vocab card · halcyon'],
    [{ kind: 'slide', minutes: 30, date: TODAY, occurrenceKey: 'b', label: 'evening' }, 'Slide · evening · 30 min later'],
    [{ kind: 'unknown', text: '25pm', reason: 'That time doesn’t exist' }, 'Not sure: That time doesn’t exist'],
  ];
  it.each(cases)('%#: %j', (intent, text) => {
    expect(describeIntent(intent, state)).toBe(text);
  });
});
