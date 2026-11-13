import { occurrencesForDate } from './recurrence';
import { vesperaReducer as reduce } from './reducer';
import type { BlockFields, OccurrenceSource } from './types';
import { createSeedState } from '../test/ownerWeek';

const seed = createSeedState();
const deskThu: OccurrenceSource = { type: 'series', id: 'ser-thu-desk', date: '2026-11-19' };
const deskFields: BlockFields = { title: 'Job 2: Bookshop Shift (Use for Essay Polish & Exam)', kind: 'anchor', start: 540, end: 780, categoryId: 'cat-job2' };
const titles = (s: typeof seed, date: string) => occurrencesForDate(s, date).map((o) => o.title);

describe('adding blocks', () => {
  it('adds a one-off block', () => {
    const s = reduce(seed, { type: 'addBlock', id: 'b1', date: '2026-11-16', fields: { title: 'Laundry', kind: 'flexible', start: 600, end: 630 }, repeat: null });
    expect(s.blocks.at(-1)).toEqual({ id: 'b1', date: '2026-11-16', title: 'Laundry', kind: 'flexible', start: 600, end: 630 });
  });

  it('adds a repeating series starting on the date', () => {
    const s = reduce(seed, { type: 'addBlock', id: 's9', date: '2026-11-16', fields: { title: 'Yoga', kind: 'flexible', start: 420, end: 450 }, repeat: { freq: 'weekdays' } });
    expect(s.series.at(-1)).toMatchObject({ id: 's9', startDate: '2026-11-16', repeat: { freq: 'weekdays' } });
    expect(titles(s, '2026-11-17')).toContain('Yoga');
  });
});

describe('editing a repeating block', () => {
  it('"just this one" overrides only that date', () => {
    const s = reduce(seed, { type: 'editOccurrence', source: deskThu, fields: { ...deskFields, start: 600, end: 840 }, scope: 'this', newId: 'x' });
    const on19 = occurrencesForDate(s, '2026-11-19').find((o) => o.source.id === 'ser-thu-desk')!;
    const on26 = occurrencesForDate(s, '2026-11-26').find((o) => o.source.id === 'ser-thu-desk')!;
    expect([on19.start, on19.end]).toEqual([600, 840]);
    expect([on26.start, on26.end]).toEqual([540, 780]);
  });

  it('"just this one" to another date skips the original and adds a one-off', () => {
    const s = reduce(seed, { type: 'editOccurrence', source: deskThu, fields: deskFields, scope: 'this', date: '2026-11-20', newId: 'moved' });
    expect(titles(s, '2026-11-19')).not.toContain(deskFields.title);
    expect(s.blocks.find((b) => b.id === 'moved')).toMatchObject({ date: '2026-11-20', title: deskFields.title });
  });

  it('"this and all future" splits the series; the past stays the same', () => {
    const s = reduce(seed, { type: 'editOccurrence', source: deskThu, fields: { ...deskFields, title: 'Bookshop Shift (new hours)', start: 600, end: 840 }, scope: 'future', newId: 'ser-new' });
    expect(s.series.find((x) => x.id === 'ser-thu-desk')!.endDate).toBe('2026-11-18');
    expect(s.series.find((x) => x.id === 'ser-new')).toMatchObject({ startDate: '2026-11-19', start: 600, repeat: { freq: 'weekly', interval: 1, weekdays: [4] } });
    expect(titles(s, '2026-11-12')).toContain(deskFields.title);
    expect(titles(s, '2026-11-26')).toContain('Bookshop Shift (new hours)');
  });

  it('"this and all future" carries later exceptions over to the new series', () => {
    const skipped = reduce(seed, { type: 'setSkipped', seriesId: 'ser-thu-desk', date: '2026-11-26', skipped: true });
    const s = reduce(skipped, { type: 'editOccurrence', source: deskThu, fields: deskFields, scope: 'future', newId: 'ser-new' });
    expect(s.exceptions['ser-new']['2026-11-26']).toEqual({ skipped: true });
    expect(s.exceptions['ser-thu-desk']?.['2026-11-26']).toBeUndefined();
  });

  it('editing the first occurrence for all future updates the series in place', () => {
    const first: OccurrenceSource = { type: 'series', id: 'ser-thu-desk', date: '2026-11-12' };
    const s = reduce(seed, { type: 'editOccurrence', source: first, fields: { ...deskFields, title: 'Renamed' }, scope: 'future', newId: 'unused' });
    expect(s.series.find((x) => x.id === 'ser-thu-desk')!.title).toBe('Renamed');
    expect(s.series.some((x) => x.id === 'unused')).toBe(false);
  });

  it('can change the repeat rule going forward', () => {
    const s = reduce(seed, { type: 'editOccurrence', source: deskThu, fields: deskFields, scope: 'future', repeat: { freq: 'weekly', interval: 2, weekdays: [4] }, newId: 'ser-new' });
    expect(titles(s, '2026-11-26')).not.toContain(deskFields.title);
    expect(titles(s, '2026-12-03')).toContain(deskFields.title);
  });

  it('turning repeat off going forward leaves a single one-off', () => {
    const s = reduce(seed, { type: 'editOccurrence', source: deskThu, fields: deskFields, scope: 'future', repeat: null, newId: 'solo' });
    expect(s.blocks.find((b) => b.id === 'solo')).toMatchObject({ date: '2026-11-19' });
    expect(titles(s, '2026-11-26')).not.toContain(deskFields.title);
  });

  it('a one-off can become repeating', () => {
    const s = reduce(seed, { type: 'editOccurrence', source: { type: 'oneoff', id: 'blk-tue-gym' }, fields: { title: 'Gym', kind: 'flexible', start: 720, end: 840 }, scope: 'this', repeat: { freq: 'weekly', interval: 1, weekdays: [2] }, newId: 'ser-gym' });
    expect(s.blocks.some((b) => b.id === 'blk-tue-gym')).toBe(false);
    expect(titles(s, '2026-11-24')).toContain('Gym');
  });

  it('edits a one-off in place, including its date', () => {
    const s = reduce(seed, { type: 'editOccurrence', source: { type: 'oneoff', id: 'blk-tue-gym' }, fields: { title: 'Gym', kind: 'anchor', start: 720, end: 840 }, scope: 'this', date: '2026-11-18', newId: 'x' });
    expect(s.blocks.find((b) => b.id === 'blk-tue-gym')).toEqual({ id: 'blk-tue-gym', date: '2026-11-18', title: 'Gym', kind: 'anchor', start: 720, end: 840 });
  });
});

describe('skipping and deleting', () => {
  it('skip today hides one occurrence, and undo brings it back', () => {
    const skipped = reduce(seed, { type: 'setSkipped', seriesId: 'ser-thu-class', date: '2026-11-19', skipped: true });
    expect(titles(skipped, '2026-11-19')).not.toContain('Class Attendance & Project Team Check-in');
    expect(titles(skipped, '2026-11-26')).toContain('Class Attendance & Project Team Check-in');
    const undone = reduce(skipped, { type: 'setSkipped', seriesId: 'ser-thu-class', date: '2026-11-19', skipped: false });
    expect(titles(undone, '2026-11-19')).toContain('Class Attendance & Project Team Check-in');
  });

  it('delete "just this one" on a series = skip', () => {
    const s = reduce(seed, { type: 'deleteOccurrence', source: deskThu, scope: 'this' });
    expect(s.exceptions['ser-thu-desk']['2026-11-19']).toEqual({ skipped: true });
  });

  it('delete "this and all future" ends the series the day before', () => {
    const s = reduce(seed, { type: 'deleteOccurrence', source: deskThu, scope: 'future' });
    expect(s.series.find((x) => x.id === 'ser-thu-desk')!.endDate).toBe('2026-11-18');
    expect(titles(s, '2026-11-12')).toContain(deskFields.title);
  });

  it('delete all future from the first occurrence removes the series', () => {
    const s = reduce(seed, { type: 'deleteOccurrence', source: { type: 'series', id: 'ser-thu-desk', date: '2026-11-12' }, scope: 'future' });
    expect(s.series.some((x) => x.id === 'ser-thu-desk')).toBe(false);
  });

  it('deletes a one-off', () => {
    const s = reduce(seed, { type: 'deleteOccurrence', source: { type: 'oneoff', id: 'blk-sat-gre' }, scope: 'this' });
    expect(s.blocks.some((b) => b.id === 'blk-sat-gre')).toBe(false);
  });
});

describe('push and begin', () => {
  it('pushes with ripple across one-offs on that date', () => {
    const s = reduce(seed, { type: 'pushOccurrence', date: '2026-11-11', key: 'blk-wed-cook', deltaMinutes: 30 });
    expect(s.blocks.find((b) => b.id === 'blk-wed-workout')).toMatchObject({ start: 1125, end: 1170 });
  });

  it('pushes a series occurrence via a per-date override', () => {
    const withFlex = reduce(seed, { type: 'addBlock', id: 's9', date: '2026-11-16', fields: { title: 'Yoga', kind: 'flexible', start: 420, end: 450 }, repeat: { freq: 'daily' } });
    const s = reduce(withFlex, { type: 'pushOccurrence', date: '2026-11-17', key: 's9@2026-11-17', deltaMinutes: 30 });
    expect(s.exceptions.s9['2026-11-17'].overrides).toEqual({ start: 450, end: 480 });
    expect(occurrencesForDate(s, '2026-11-18').find((o) => o.title === 'Yoga')!.start).toBe(420);
  });

  it('marks occurrences begun', () => {
    const a = reduce(seed, { type: 'beginOccurrence', source: { type: 'oneoff', id: 'blk-wed-cook' } });
    expect(a.blocks.find((b) => b.id === 'blk-wed-cook')!.begun).toBe(true);
    const b = reduce(seed, { type: 'beginOccurrence', source: deskThu });
    expect(b.exceptions['ser-thu-desk']['2026-11-19'].begun).toBe(true);
  });
});

describe('categories', () => {
  it('adds, renames and archives', () => {
    let s = reduce(seed, { type: 'addCategory', id: 'cat-new', name: 'Job 3 · Lab', emoji: '🧪', accent: 'sage' });
    expect(s.categories.at(-1)).toEqual({ id: 'cat-new', name: 'Job 3 · Lab', emoji: '🧪', accent: 'sage', archived: false });
    s = reduce(s, { type: 'updateCategory', id: 'cat-job2', patch: { name: 'Front Desk', archived: true } });
    expect(s.categories.find((c) => c.id === 'cat-job2')).toMatchObject({ name: 'Front Desk', archived: true });
  });

  it('reorders, ignoring moves past the ends', () => {
    const s = reduce(seed, { type: 'moveCategory', id: 'cat-grad', direction: -1 });
    expect(s.categories.map((c) => c.id)).toEqual(['cat-reset', 'cat-grad', 'cat-job1', 'cat-job2']);
    expect(reduce(seed, { type: 'moveCategory', id: 'cat-reset', direction: -1 })).toBe(seed);
  });

  it('keeps block links working after a rename (links use ids)', () => {
    const s = reduce(seed, { type: 'updateCategory', id: 'cat-job2', patch: { name: 'Front Desk' } });
    expect(occurrencesForDate(s, '2026-11-19').find((o) => o.source.id === 'ser-thu-desk')!.categoryId).toBe('cat-job2');
  });
});

describe('quests', () => {
  it('adds with an optional due date', () => {
    const s = reduce(seed, { type: 'addTask', id: 't1', title: 'Water plants', categoryId: 'cat-reset', dueDate: '2026-11-14' });
    expect(s.tasks.at(-1)).toEqual({ id: 't1', title: 'Water plants', categoryId: 'cat-reset', done: false, dueDate: '2026-11-14' });
  });

  it('toggles and stamps the completion day', () => {
    const done = reduce(seed, { type: 'toggleTask', id: 'task-sweep', today: '2026-11-12' });
    expect(done.tasks[0]).toMatchObject({ done: true, completedOn: '2026-11-12' });
    const undone = reduce(done, { type: 'toggleTask', id: 'task-sweep', today: '2026-11-12' });
    expect(undone.tasks[0].done).toBe(false);
    expect('completedOn' in undone.tasks[0]).toBe(false);
  });

  it('edits title, category and due date (null clears it)', () => {
    const s = reduce(seed, { type: 'updateTask', id: 'task-sop-draft', patch: { title: 'Essay v2', categoryId: 'cat-job1', dueDate: null } });
    const t = s.tasks.find((x) => x.id === 'task-sop-draft')!;
    expect(t).toMatchObject({ title: 'Essay v2', categoryId: 'cat-job1' });
    expect('dueDate' in t).toBe(false);
  });

  it('restores a chronicle entry as an open quest', () => {
    const s0 = { ...seed, chronicle: [{ ...seed.tasks[0], id: 'old', done: true, completedOn: '2026-11-10' }] };
    const s = reduce(s0, { type: 'restoreTask', id: 'old' });
    expect(s.chronicle).toEqual([]);
    expect(s.tasks.at(-1)).toMatchObject({ id: 'old', done: false });
    expect('completedOn' in s.tasks.at(-1)!).toBe(false);
  });

  it('restores into the first visible category if its own is archived', () => {
    const s0 = {
      ...seed,
      categories: seed.categories.map((c) => (c.id === 'cat-job2' ? { ...c, archived: true } : c)),
      chronicle: [{ id: 'old', title: 'x', categoryId: 'cat-job2', done: true, completedOn: '2026-11-10' }],
    };
    expect(reduce(s0, { type: 'restoreTask', id: 'old' }).tasks.at(-1)!.categoryId).toBe('cat-reset');
  });
});

describe('tags and notes', () => {
  it('adds and renames tags', () => {
    let s = reduce(seed, { type: 'addTag', id: 'tag-ideas', name: 'Ideas', emoji: '💡', vocab: false });
    s = reduce(s, { type: 'updateTag', id: 'tag-ideas', patch: { name: 'Big Ideas' } });
    expect(s.noteTags.at(-1)).toEqual({ id: 'tag-ideas', name: 'Big Ideas', emoji: '💡', vocab: false });
  });

  it('deleting a tag moves its notes to the first remaining tag of the same kind', () => {
    const s = reduce(seed, { type: 'deleteTag', id: 'tag-reminder' });
    expect(s.noteTags.some((t) => t.id === 'tag-reminder')).toBe(false);
    expect(s.notes.find((n) => n.id === 'note-sop-reminder')!.tagId).toBe('tag-braindump');
  });

  it('refuses to delete the last vocab tag', () => {
    expect(reduce(seed, { type: 'deleteTag', id: 'tag-vocab' })).toBe(seed);
  });

  it('pins notes to the front and deletes them', () => {
    let s = reduce(seed, { type: 'addNote', id: 'n1', tagId: 'tag-grocery', text: 'Oat milk' });
    expect(s.notes[0]).toEqual({ id: 'n1', tagId: 'tag-grocery', text: 'Oat milk' });
    s = reduce(s, { type: 'deleteNote', id: 'n1' });
    expect(s.notes.some((n) => n.id === 'n1')).toBe(false);
  });
});

describe('settings, focus veil, data', () => {
  it('merges settings', () => {
    const s = reduce(seed, { type: 'updateSettings', patch: { focusMinutes: 10, lateOfferMinutes: 0 } });
    expect(s.settings).toMatchObject({ focusMinutes: 10, lateOfferMinutes: 0, dayStart: 420 });
  });

  it('uses the configured timer length', () => {
    const s0 = reduce(seed, { type: 'updateSettings', patch: { focusMinutes: 2 } });
    const s = reduce(s0, { type: 'triggerFiveMinuteReset', roll: 0, now: 1000 });
    expect(s.focusVeil).toEqual({ action: seed.tasks[0].title, taskId: 'task-sweep', endsAt: 1000 + 2 * 60_000 });
  });

  it('completing the veil checks off its quest with today’s date', () => {
    const started = reduce(seed, { type: 'triggerFiveMinuteReset', roll: 0, now: 0 });
    const done = reduce(started, { type: 'completeFiveMinuteReset', today: '2026-11-12' });
    expect(done.focusVeil).toBeNull();
    expect(done.tasks[0]).toMatchObject({ done: true, completedOn: '2026-11-12' });
  });

  it('dismissing closes without completing', () => {
    const started = reduce(seed, { type: 'triggerFiveMinuteReset', roll: 0, now: 0 });
    expect(reduce(started, { type: 'dismissFiveMinuteReset' }).tasks[0].done).toBe(false);
  });

  it('rolls over, replaces state, and sets notices', () => {
    expect(reduce(seed, { type: 'rollover', today: '2026-11-12' }).lastRolloverDate).toBe('2026-11-12');
    const other = { ...seed, tasks: [] };
    expect(reduce(seed, { type: 'replaceState', state: other })).toBe(other);
    expect(reduce(seed, { type: 'setNotice', notice: 'import-failed' }).notice).toBe('import-failed');
  });

  it('toggles the reserved assistant panel', () => {
    expect(reduce(seed, { type: 'toggleAssistantPanel' }).assistant.panelOpen).toBe(true);
  });
});

describe('repeat end dates', () => {
  it('adds a series that ends on a date', () => {
    const s = reduce(seed, { type: 'addBlock', id: 's9', date: '2026-11-16', fields: { title: 'Course', kind: 'focus', start: 600, end: 660 }, repeat: { freq: 'daily' }, endDate: '2026-11-18' });
    expect(titles(s, '2026-11-18')).toContain('Course');
    expect(titles(s, '2026-11-19')).not.toContain('Course');
  });

  it('sets, keeps and clears an end date when editing all future', () => {
    const ended = reduce(seed, { type: 'editOccurrence', source: deskThu, fields: deskFields, scope: 'future', endDate: '2026-12-10', newId: 'ser-new' });
    expect(ended.series.find((x) => x.id === 'ser-new')!.endDate).toBe('2026-12-10');
    const first = { type: 'series' as const, id: 'ser-new', date: '2026-11-19' };
    const kept = reduce(ended, { type: 'editOccurrence', source: first, fields: { ...deskFields, title: 'Kept' }, scope: 'future', newId: 'x' });
    expect(kept.series.find((x) => x.id === 'ser-new')!.endDate).toBe('2026-12-10');
    const cleared = reduce(ended, { type: 'editOccurrence', source: first, fields: deskFields, scope: 'future', endDate: null, newId: 'x' });
    expect('endDate' in cleared.series.find((x) => x.id === 'ser-new')!).toBe(false);
  });

  it('a one-off made repeating can get an end date', () => {
    const s = reduce(seed, { type: 'editOccurrence', source: { type: 'oneoff', id: 'blk-tue-gym' }, fields: { title: 'Gym', kind: 'flexible', start: 720, end: 840 }, scope: 'this', repeat: { freq: 'weekly', interval: 1, weekdays: [2] }, endDate: '2026-11-24', newId: 'ser-gym' });
    expect(titles(s, '2026-11-24')).toContain('Gym');
    expect(titles(s, '2026-12-01')).not.toContain('Gym');
  });
});

describe('activity log (candle streak)', () => {
  it('counts quests finished, and un-counts them if unchecked the same day', () => {
    const done = reduce(seed, { type: 'toggleTask', id: 'task-sweep', today: '2026-11-12' });
    expect(done.activity['2026-11-12'].quests).toBe(1);
    const undone = reduce(done, { type: 'toggleTask', id: 'task-sweep', today: '2026-11-12' });
    expect(undone.activity['2026-11-12'].quests).toBe(0);
  });

  it('counts a completed Gentle Start (and its quest)', () => {
    const started = reduce(seed, { type: 'triggerFiveMinuteReset', roll: 0, now: 0 });
    const done = reduce(started, { type: 'completeFiveMinuteReset', today: '2026-11-12' });
    expect(done.activity['2026-11-12']).toMatchObject({ spells: 1, quests: 1 });
  });
});

describe('focus sessions', () => {
  const MIN = 60_000;
  const occ = { key: 'blk-wed-focus', date: '2026-11-11', title: 'Research Push', categoryId: 'cat-job1', start: 1140, end: 1230 };

  it('starts a session sized to the block and remembers the choices', () => {
    const s = reduce(seed, { type: 'startFocus', occurrence: occ, rhythm: 'whole', sound: 'fire', now: 1000 });
    expect(s.focusSession).toEqual({
      title: 'Research Push', categoryId: 'cat-job1', date: '2026-11-11', occurrenceKey: 'blk-wed-focus',
      rhythm: 'whole', sound: 'fire', startedAt: 1000, totalMinutes: 90, pausedAt: null, pausedMs: 0,
    });
    expect(s.settings).toMatchObject({ focusRhythm: 'whole', focusSound: 'fire' });
  });

  it('pauses and resumes, accumulating paused time', () => {
    let s = reduce(seed, { type: 'startFocus', occurrence: occ, rhythm: 'whole', sound: 'off', now: 0 });
    s = reduce(s, { type: 'pauseFocus', now: 10 * MIN });
    expect(s.focusSession!.pausedAt).toBe(10 * MIN);
    s = reduce(s, { type: 'resumeFocus', now: 15 * MIN });
    expect(s.focusSession).toMatchObject({ pausedAt: null, pausedMs: 5 * MIN });
  });

  it('finishing logs the focus minutes actually spent and clears the session', () => {
    const start = new Date(2026, 10, 11, 19, 0).getTime();
    let s = reduce(seed, { type: 'startFocus', occurrence: occ, rhythm: 'pomodoro25', sound: 'rain', now: start });
    s = reduce(s, { type: 'finishFocus', now: start + 40 * MIN, today: '2026-11-11' });
    expect(s.focusSession).toBeNull();
    expect(s.activity['2026-11-11'].focusMinutes).toBe(35); // 25 + 10, rest excluded
  });

  it('logs nothing for a session under a minute', () => {
    let s = reduce(seed, { type: 'startFocus', occurrence: occ, rhythm: 'whole', sound: 'off', now: 0 });
    s = reduce(s, { type: 'finishFocus', now: 30_000, today: '2026-11-11' });
    expect(s.activity['2026-11-11']).toBeUndefined();
  });
});

describe('vocab reviews', () => {
  it('schedules the card and logs a reviewed card', () => {
    const s = reduce(seed, { type: 'reviewCard', id: 'vocab-laconic', knew: true, today: '2026-11-12' });
    expect(s.notes.find((n) => n.id === 'vocab-laconic')!.review).toEqual({ step: 1, due: '2026-11-15' });
    expect(s.activity['2026-11-12'].cards).toBe(1);
  });
});

describe('weekly summary', () => {
  it('remembers which week was dismissed', () => {
    expect(reduce(seed, { type: 'dismissWeeklySummary', today: '2026-11-18' }).lastSummaryWeek).toBe('2026-11-16');
  });
});
