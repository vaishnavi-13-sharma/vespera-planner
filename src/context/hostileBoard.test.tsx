// VB-01 · A board that passes parseState/parseImport can still crash the whole app, and keep it blank.
// parseState only checks that each list holds objects with a string `id`; nothing inside an item is
// checked. The same validator guards localStorage, backup import and the cloud row, and there is no
// error boundary, so one bad field blanks every panel on every reload (and, once synced, every device).
import { render, screen } from '@testing-library/react';
import App from '../App';
import { createStarterState } from './seed';
import { parseImport, parseState, STORAGE_KEY } from './storage';
import type { VesperaState } from './types';

const TODAY = '2026-11-12';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 12, 0));
  // React reports the crash loudly; keep the run readable.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A real starter board with one field made hostile: what a shared "template" backup or a bad cloud row could carry. */
function hostile(edit: (s: VesperaState) => void): string {
  const board = JSON.parse(JSON.stringify(createStarterState(TODAY, 12 * 60))) as VesperaState;
  edit(board);
  return JSON.stringify(board);
}

const CASES: [string, string][] = [
  ['a category accent that is not one of the five', hostile((s) => ((s.categories[0] as { accent: string }).accent = 'purple'))],
  ['a quest title that is an object', hostile((s) => ((s.tasks[0] as unknown as { title: unknown }).title = { html: '<img src=x onerror=alert(1)>' }))],
  ['a weekly series with no weekdays', hostile((s) => ((s.series[0] as unknown as { repeat: unknown }).repeat = { freq: 'weekly', interval: 1 }))],
];

describe('VB-01: hostile boards are rejected or repaired before they reach the UI', () => {
  it.each(CASES)('the app still opens when the saved board has %s', (_, text) => {
    // Correct behaviour: the board is rejected (the app falls back) or repaired, and the app opens either way.
    localStorage.setItem(STORAGE_KEY, text);
    expect(() => render(<App />)).not.toThrow();
    expect(screen.getByRole('region', { name: 'Quest Board' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Daily Timeline' })).toBeInTheDocument();
  });

  it.each(CASES)('a backup or cloud board with %s comes back rejected or repaired', (_, text) => {
    // Both entry points share one validator: an imported file and a row pulled from the cloud.
    for (const parsed of [parseImport(text), parseState(JSON.parse(text))]) {
      if (parsed === null) continue; // rejected: fine
      expect(parsed.categories.every((c) => ['gold', 'burgundy', 'rose', 'sage', 'taupe'].includes(c.accent)), 'every accent is a known one').toBe(true);
      expect(parsed.tasks.every((t) => typeof t.title === 'string'), 'every quest title is a string').toBe(true);
      expect(parsed.series.every((s) => s.repeat.freq !== 'weekly' || Array.isArray(s.repeat.weekdays)), 'every weekly rule has weekdays').toBe(true);
    }
  });
});
