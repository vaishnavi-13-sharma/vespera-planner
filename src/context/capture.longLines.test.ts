// CG-10 · Low · Long runs of spaces make the capture parser quadratic; it re-parses on every keystroke, so a big paste freezes typing.
import { createStarterState, parseCapture } from './VesperaContext';

const today = '2026-11-12';
const state = createStarterState(today, 9 * 60);

function timed(line: string): number {
  const t = performance.now();
  parseCapture(line, state, today, 9 * 60);
  return performance.now() - t;
}

it.each([
  ['a time followed by a pasted gap', '1' + ' '.repeat(40_000) + 'x'],
  ['"every mon" followed by a pasted gap', 'every mon' + ' '.repeat(40_000) + 'x'],
])('%s parses within one frame budget (≈100 ms)', (_label, line) => {
  timed('warm up 3-4pm');
  // Linear work on 40k characters takes well under a millisecond; today this takes seconds.
  expect(timed(line)).toBeLessThan(100);
});

const gap = ' '.repeat(40_000);
const tabs = '\t \t'.repeat(13_000);
it.each([
  ['a vocab card with a gap before its dash', 'vocab: word' + gap + 'x'],
  ['a note with a gap', 'note:' + gap + 'x'],
  ['a would-be prefix with a gap and no colon', 'quest' + gap + 'x'],
  ['a slide with a gap', 'slide' + gap + 'x'],
  ['mixed tabs and spaces after a time', '3pm' + tabs + 'x'],
  ['a long list of weekdays', 'every ' + 'mon, '.repeat(8_000) + 'x'],
  ['a long chain of ranges', '1-'.repeat(20_000) + 'x'],
  ['a long run of digits and colons', '1:'.repeat(20_000)],
  ['a long run of dates', '1/'.repeat(20_000)],
])('%s still parses quickly', (_label, line) => {
  timed('warm up 3-4pm');
  expect(timed(line)).toBeLessThan(100);
});

it('a gap inside a line reads like a single space', () => {
  expect(parseCapture('dinner' + gap + 'tomorrow  7pm', state, today, 9 * 60)).toMatchObject({ kind: 'block', title: 'Dinner', start: 19 * 60 });
});

it('note text keeps the spacing the person typed', () => {
  expect(parseCapture('note: a   b', state, today, 9 * 60)).toMatchObject({ kind: 'note', text: 'a   b' });
});
