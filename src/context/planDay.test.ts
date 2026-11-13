import { planDay } from './planDay';
import { createBaseState } from './seed';
import type { OneOffBlock, Series, Task, VesperaState } from './types';

const TODAY = '2026-11-12';
const at = (h: number, m = 0) => h * 60 + m;
const block = (id: string, start: number, end: number, extra: Partial<OneOffBlock> = {}): OneOffBlock => ({ id, date: TODAY, title: id, kind: 'flexible', start, end, ...extra });
const task = (id: string, extra: Partial<Task> = {}): Task => ({ id, title: id, categoryId: 'cat-work', done: false, ...extra });
const board = (extra: Partial<VesperaState> = {}): VesperaState => ({ ...createBaseState(TODAY), ...extra });

describe('planDay', () => {
  it('orders quests: overdue, due today, due soon, then the rest in board order', () => {
    const tasks = [
      task('later'),
      task('soon', { dueDate: '2026-11-14' }),
      task('today', { dueDate: TODAY }),
      task('overdue', { dueDate: '2026-11-10' }),
      task('far', { dueDate: '2026-11-30' }),
    ];
    const plan = planDay(board({ tasks }), TODAY, at(9));
    expect(plan.map((p) => p.taskId)).toEqual(['overdue', 'today', 'soon', 'later', 'far']);
    expect(plan.map((p) => [p.start, p.end])).toEqual([
      [at(9), at(9, 30)],
      [at(9, 30), at(10)],
      [at(10), at(10, 30)],
      [at(10, 30), at(11)],
      [at(11), at(11, 30)],
    ]);
    expect(plan[0]).toMatchObject({ title: 'overdue', categoryId: 'cat-work' });
  });

  it('starts at the next five minutes, or the start of the day if later', () => {
    expect(planDay(board({ tasks: [task('a')] }), TODAY, at(10, 2))[0].start).toBe(at(10, 5));
    expect(planDay(board({ tasks: [task('a')] }), TODAY, at(5))[0].start).toBe(at(7));
  });

  it('works around busy blocks and skips gaps shorter than 20 minutes', () => {
    const blocks = [block('busy1', at(10, 15), at(12)), block('busy2', at(12, 30), at(22, 45))];
    const plan = planDay(board({ tasks: [task('a'), task('b'), task('c')], blocks }), TODAY, at(10));
    // 10:00–10:15 is too short; 12:00–12:30 fits one; 22:45–23:00 is too short.
    expect(plan.map((p) => [p.taskId, p.start, p.end])).toEqual([['a', at(12), at(12, 30)]]);
  });

  it('uses a gap of at least 20 minutes whole when 30 do not fit', () => {
    const blocks = [block('busy', at(10, 25), at(23))];
    expect(planDay(board({ tasks: [task('a')], blocks }), TODAY, at(10))).toEqual([
      { taskId: 'a', title: 'a', categoryId: 'cat-work', start: at(10), end: at(10, 25) },
    ]);
  });

  it('counts repeating blocks as busy, but not skipped ones or untimed ones', () => {
    const series: Series = { id: 'ser', title: 'Class', kind: 'anchor', start: at(9), end: at(22), repeat: { freq: 'daily' }, startDate: '2026-11-01' };
    const floating = block('float', 0, 0, { start: null, end: null, timeLabel: 'Flexible' });
    const busy = board({ tasks: [task('a')], series: [series], blocks: [floating] });
    expect(planDay(busy, TODAY, at(9))[0].start).toBe(at(22));
    const skipped = { ...busy, exceptions: { ser: { [TODAY]: { skipped: true } } } };
    expect(planDay(skipped, TODAY, at(9))[0].start).toBe(at(9));
  });

  it('skips finished quests and quests already on today’s timeline', () => {
    const tasks = [task('done', { done: true, completedOn: TODAY }), task('Write essay'), task('fresh')];
    const blocks = [block('x', at(20), at(21), { title: 'write essay' })];
    expect(planDay(board({ tasks, blocks }), TODAY, at(9)).map((p) => p.taskId)).toEqual(['fresh']);
  });

  it('never plans past the end of the day', () => {
    expect(planDay(board({ tasks: [task('a')] }), TODAY, at(22, 50))).toEqual([]);
    expect(planDay(board({ tasks: [task('a')] }), TODAY, at(23, 30))).toEqual([]);
  });

  it('honours custom slot and gap lengths', () => {
    const plan = planDay(board({ tasks: [task('a'), task('b')] }), TODAY, at(9), { slotMinutes: 45, minGap: 10 });
    expect(plan.map((p) => [p.start, p.end])).toEqual([
      [at(9), at(9, 45)],
      [at(9, 45), at(10, 30)],
    ]);
  });
});
