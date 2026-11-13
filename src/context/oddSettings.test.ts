// CG-04 · High · A save, backup or synced board with odd settings/activity loads fine, then crashes the app on the first tap.
import { createBaseState, parseImport, planDay, vesperaReducer, type VesperaState } from './VesperaContext';

const today = '2026-11-12';

/** A backup from an older/hand-edited build: valid ids everywhere, odd values inside. */
function oddBackup(patch: Record<string, unknown>, settings: Record<string, unknown> = {}): string {
  const base = createBaseState(today);
  base.tasks = [{ id: 'task-1', title: 'Email the tutor', categoryId: 'cat-work', done: false }];
  return JSON.stringify({ ...base, ...patch, settings: { ...base.settings, ...settings } });
}

describe('parseImport repairs (or rejects) settings it cannot use', () => {
  it('an unstick-action list that is not a list does not crash Gentle Start', () => {
    const s = parseImport(oddBackup({}, { unstickActions: null }));
    if (s === null) return; // rejecting the file is also fine
    expect(Array.isArray(s.settings.unstickActions)).toBe(true);
    expect(() => vesperaReducer(s, { type: 'triggerFiveMinuteReset', roll: 0.5, now: 0 })).not.toThrow();
  });

  it('a missing activity log does not crash checking off a quest', () => {
    const s = parseImport(oddBackup({ activity: null }));
    if (s === null) return;
    expect(() => vesperaReducer(s, { type: 'toggleTask', id: 'task-1', today })).not.toThrow();
  });

  it('a day that ends before it starts is repaired, so Plan my day still finds time', () => {
    const s = parseImport(oddBackup({}, { dayStart: 23 * 60, dayEnd: 7 * 60 }));
    if (s === null) return;
    expect(s.settings.dayEnd).toBeGreaterThan(s.settings.dayStart);
    expect(planDay(s, today, 9 * 60).length).toBeGreaterThan(0);
  });

  it('numbers that are not usable numbers fall back to defaults', () => {
    const s = parseImport(oddBackup({}, { volume: 'loud', focusMinutes: 'abc', lateOfferMinutes: 7, dayStart: '07:00' }));
    if (s === null) return;
    const { volume, focusMinutes, lateOfferMinutes, dayStart } = s.settings;
    expect(typeof volume === 'number' && volume >= 0 && volume <= 1).toBe(true);
    expect([2, 5, 10]).toContain(focusMinutes);
    expect([0, 5, 10, 15]).toContain(lateOfferMinutes);
    expect(Number.isInteger(dayStart)).toBe(true);
    const veiled = vesperaReducer(s as VesperaState, { type: 'triggerFiveMinuteReset', roll: 0, now: 1_000 });
    expect(Number.isFinite(veiled.focusVeil!.endsAt)).toBe(true);
  });

  it('a garbled focus session is dropped instead of opening a broken, un-closable Focus Chamber', () => {
    const s = parseImport(oddBackup({ focusSession: { title: 'Ghost' } }));
    if (s === null) return;
    const fs = s.focusSession;
    // Either cleared, or complete enough to time.
    expect(fs === null || (Number.isFinite(fs.startedAt) && Number.isFinite(fs.totalMinutes))).toBe(true);
  });
});
