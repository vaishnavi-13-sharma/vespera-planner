// CG-05 · Medium · Quick capture silently turns impossible dates (Feb 30, Apr 31, 2/29 in a non-leap year) into other days.
import { createStarterState, parseCapture } from './VesperaContext';

const today = '2026-11-12';
const state = createStarterState(today, 9 * 60);
const read = (line: string) => parseCapture(line, state, today, 9 * 60)!;

it.each([
  ['quest: pay rent Feb 30', 'quest'],
  ['quest: file taxes 2/30', 'quest'],
  ['Apr 31 3-4pm dentist', 'block'],
  ['quest: renew passport 31 June', 'quest'],
  ['quest: send report 13/5', 'quest'], // there is no 13th month
])('"%s" is refused, not moved to another date', (line) => {
  const intent = read(line);
  // Precedent: impossible times already come back as "That time doesn't exist".
  expect(intent.kind).toBe('unknown');
});

it.each(['quest: leap party Feb 29', 'quest: leap party 2/29'])('"%s" means the next real Feb 29, not Mar 1', (line) => {
  // Today is 2026-11-12; 2027 has no Feb 29, so the next one is 2028-02-29 (today it becomes 2027-03-01).
  expect(read(line)).toMatchObject({ kind: 'quest', dueDate: '2028-02-29' });
});

it('says kindly why the line was refused', () => {
  expect(read('quest: pay rent Feb 30')).toMatchObject({ kind: 'unknown', reason: 'That date doesn’t exist' });
  expect(read('Apr 31 3-4pm dentist')).toMatchObject({ kind: 'unknown', reason: 'That date doesn’t exist' });
  expect(read('quest: x 0/5')).toMatchObject({ kind: 'unknown', reason: 'That date doesn’t exist' });
  expect(read('quest: x 5/0')).toMatchObject({ kind: 'unknown', reason: 'That date doesn’t exist' });
  // Impossible times keep their own message.
  expect(read('25:00 tea')).toMatchObject({ kind: 'unknown', reason: 'That time doesn’t exist' });
});

describe('Feb 29 and ordinary dates around the turn of the year', () => {
  const on = (day: string, line: string) => parseCapture(line, createStarterState(day, 9 * 60), day, 9 * 60)!;

  it('on a leap day itself, Feb 29 is today', () => {
    expect(on('2028-02-29', 'quest: leap party Feb 29')).toMatchObject({ dueDate: '2028-02-29' });
  });

  it('just after a leap day, Feb 29 waits four years', () => {
    expect(on('2028-03-01', 'quest: leap party Feb 29')).toMatchObject({ dueDate: '2032-02-29' });
  });

  it('skips century years that have no Feb 29 (2100)', () => {
    expect(on('2096-03-01', 'quest: leap party 29 Feb')).toMatchObject({ dueDate: '2104-02-29' });
  });

  it('a real date already past this year still means next year', () => {
    expect(read('quest: renew passport Feb 28')).toMatchObject({ dueDate: '2027-02-28' });
    expect(read('quest: renew passport 11/1')).toMatchObject({ dueDate: '2027-11-01' });
    expect(read('quest: renew passport 12/1')).toMatchObject({ dueDate: '2026-12-01' });
    expect(read('quest: send report Nov 30')).toMatchObject({ dueDate: '2026-11-30' });
  });
});
