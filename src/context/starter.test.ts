import { occurrencesForDate } from './recurrence';
import { vesperaReducer } from './reducer';
import { createStarterState, hasTutorial, isTutorialId } from './seed';
import { pickUnstickAction } from './selectors';

describe('Welcome to Vespera starter guide', () => {
  const s = createStarterState('2026-11-12', 10 * 60 + 20); // Thu 10:20

  it('opens with a Start Here category of "do this" quests above four general categories', () => {
    expect(s.categories.map((c) => c.name)).toEqual(['Start Here', 'Quick Reset & Self-Care', 'Work', 'Study', 'Life Admin']);
    const startHere = s.tasks.filter((t) => t.categoryId === 'tut-cat-start').map((t) => t.title);
    expect(startHere).toHaveLength(6);
    expect(startHere[0]).toMatch(/light today’s candle/);
    expect(startHere).toContain('Feeling stuck? Tap “Gentle Start” for a quick 5-minute focus timer');
    expect(startHere).toContain('Tap the ⋯ menu on any category to rename it or change its color');
  });

  it('puts the Sample Focus Block in the next free hour, plus a weekly routine', () => {
    const today = occurrencesForDate(s, '2026-11-12');
    expect(today.map((o) => o.title)).toEqual([
      'Sample Focus Block: tap the pencil to change the time or repeat it, or start the Focus Timer',
      'Daily routine: try “Skip today”',
    ]);
    expect(today[0]).toMatchObject({ start: 11 * 60, end: 12 * 60, kind: 'focus' });
    expect(occurrencesForDate(s, '2026-11-19').map((o) => o.title)).toEqual(['Daily routine: try “Skip today”']);
  });

  it('moves the Sample Focus Block to tomorrow morning when it is late', () => {
    const late = createStarterState('2026-11-12', 21 * 60);
    expect(late.blocks.find((b) => b.id === 'tut-blk-focus')).toMatchObject({ date: '2026-11-13', start: 600, end: 660 });
  });

  it('pins a welcome note, a tags hint and starter flip-cards including Daily 5', () => {
    expect(s.notes.map((n) => n.text)).toEqual(
      expect.arrayContaining(['Daily 5', 'Ephemeral', 'Sanguine', 'Halcyon', expect.stringMatching(/^Welcome to Vespera/)]),
    );
  });

  it('marks every tutorial item and nothing personal', () => {
    for (const items of [s.tasks, s.blocks, s.series, s.notes]) expect(items.every((i) => isTutorialId(i.id))).toBe(true);
    expect(JSON.stringify(s)).not.toMatch(/Essay|Café|Tutor|Exam/);
  });

  it('never offers a tutorial quest in Gentle Start', () => {
    for (const roll of [0, 0.2, 0.5, 0.99]) expect(pickUnstickAction(s, () => roll).taskId).toBeNull();
  });
});

describe('clearing the tutorial', () => {
  it('removes every tutorial item and keeps the general categories and anything the user added', () => {
    let s = createStarterState('2026-11-12', 600);
    s = vesperaReducer(s, { type: 'addTask', id: 'mine', title: 'My own quest', categoryId: 'tut-cat-start' });
    s = vesperaReducer(s, { type: 'addTask', id: 'mine2', title: 'Another', categoryId: 'cat-work' });
    s = vesperaReducer(s, { type: 'addBlock', id: 'blk-mine', date: '2026-11-12', fields: { title: 'Mine', kind: 'focus', start: 600, end: 660, categoryId: 'tut-cat-start' }, repeat: null });
    s = vesperaReducer(s, { type: 'setSkipped', seriesId: 'tut-ser-routine', date: '2026-11-12', skipped: true });
    expect(hasTutorial(s)).toBe(true);

    const cleared = vesperaReducer(s, { type: 'clearTutorial' });
    expect(hasTutorial(cleared)).toBe(false);
    expect(cleared.categories.map((c) => c.name)).toEqual(['Quick Reset & Self-Care', 'Work', 'Study', 'Life Admin']);
    expect(cleared.tasks.map((t) => [t.id, t.categoryId])).toEqual([['mine', 'cat-reset'], ['mine2', 'cat-work']]);
    expect(cleared.exceptions).toEqual({});
    expect(cleared.notes).toEqual([]);
    expect(cleared.blocks).toEqual([{ id: 'blk-mine', date: '2026-11-12', title: 'Mine', kind: 'focus', start: 600, end: 660, categoryId: 'cat-reset' }]);
    expect(cleared.noteTags.map((t) => t.name)).toEqual(['Brain Dump', 'Groceries', 'Reminders', 'Vocab']);
  });
});
