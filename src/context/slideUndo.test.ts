// CG-03 · High · Undoing a capture "slide" restores a whole-series snapshot, erasing every later edit to that series.
import {
  addDays,
  applyCapture,
  createBaseState,
  occurrencesForDate,
  revertCapture,
  vesperaReducer,
  type ParsedLine,
  type VesperaState,
} from './VesperaContext';

const today = '2026-11-12';
const tomorrow = addDays(today, 1);

/** A daily 6–7 pm walk, repeating from today. */
function board(): VesperaState {
  const s = createBaseState(today);
  s.series = [{ id: 'ser-walk', title: 'Evening walk', kind: 'flexible', start: 18 * 60, end: 19 * 60, repeat: { freq: 'daily' }, startDate: today }];
  return s;
}

const slideWalk: ParsedLine = {
  line: 'slide evening 30m',
  intent: { kind: 'slide', minutes: 30, date: today, occurrenceKey: `ser-walk@${today}`, label: 'evening' },
};

function slid() {
  return applyCapture(board(), [slideWalk], ['cap-1'], 1);
}

it('undo of a slide keeps a "Skip" the person added afterwards on another day', () => {
  const { state, receipt } = slid();
  // After the slide, the person skips tomorrow's walk.
  const skipped = vesperaReducer(state, { type: 'setSkipped', seriesId: 'ser-walk', date: tomorrow, skipped: true });
  expect(occurrencesForDate(skipped, tomorrow)).toHaveLength(0);

  // Then taps Undo on the still-visible "Captured 1 thing" toast.
  const undone = revertCapture(skipped, receipt);

  expect(occurrencesForDate(undone, today)[0]).toMatchObject({ start: 18 * 60, end: 19 * 60 }); // slide reverted
  expect(occurrencesForDate(undone, tomorrow)).toHaveLength(0); // ...but tomorrow's skip must stay
});

it('undo of a slide keeps a later one-date edit (moved time) on another day', () => {
  const { state, receipt } = slid();
  const edited = vesperaReducer(state, {
    type: 'editOccurrence',
    source: { type: 'series', id: 'ser-walk', date: tomorrow },
    fields: { title: 'Long walk with Mum', kind: 'flexible', start: 17 * 60, end: 19 * 60 },
    scope: 'this',
    newId: 'blk-x',
  });

  const undone = revertCapture(edited, receipt);

  expect(occurrencesForDate(undone, tomorrow)[0]).toMatchObject({ title: 'Long walk with Mum', start: 17 * 60 });
});

it('undo of a slide keeps a later rename of the slid day itself, and puts only its times back', () => {
  const { state, receipt } = slid();
  const renamed = vesperaReducer(state, {
    type: 'editOccurrence',
    source: { type: 'series', id: 'ser-walk', date: today },
    fields: { ...occurrencesForDate(state, today)[0], title: 'Walk the long way' },
    scope: 'this',
    newId: 'blk-y',
  });

  const undone = revertCapture(renamed, receipt);

  expect(occurrencesForDate(undone, today)[0]).toMatchObject({ title: 'Walk the long way', start: 18 * 60, end: 19 * 60 });
});

it('undo of a slide returns a day that already had its own times to those times, not the series default', () => {
  const moved = vesperaReducer(board(), {
    type: 'editOccurrence',
    source: { type: 'series', id: 'ser-walk', date: today },
    fields: { title: 'Evening walk', kind: 'flexible', start: 17 * 60, end: 17 * 60 + 45 },
    scope: 'this',
    newId: 'blk-z',
  });
  const { state, receipt } = applyCapture(moved, [slideWalk], ['cap-2'], 2);
  expect(occurrencesForDate(state, today)[0]).toMatchObject({ start: 17 * 60 + 30 });

  expect(revertCapture(state, receipt)).toEqual(moved);
});

it('undo of a plain slide leaves no empty exception behind', () => {
  const { state, receipt } = slid();
  expect(revertCapture(state, receipt).exceptions).toEqual({});
});

it('undo after a cloud replace does not resurrect the pre-capture exceptions over the synced ones', () => {
  const { receipt } = slid();
  // Sync replaces the board with the phone's version, where tomorrow was skipped.
  const remote = vesperaReducer(board(), { type: 'setSkipped', seriesId: 'ser-walk', date: tomorrow, skipped: true });

  const undone = revertCapture(remote, receipt);

  expect(occurrencesForDate(undone, tomorrow)).toHaveLength(0);
});
