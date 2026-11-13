// Shared E2E helpers: a pinned clock and generic test boards seeded into the test's own,
// isolated localStorage. Never the owner's data: boards are built from the app's generic seed.
import { expect, type Page } from '@playwright/test';
import { createBaseState } from '../src/context/seed';
import type { OneOffBlock, Task, VesperaState } from '../src/context/types';

/** Thursday 12 November 2026, 10:30 (the projects run in UTC). */
export const TODAY = '2026-11-12';
export const NOW = new Date('2026-11-12T10:30:00Z');
export const STORAGE_KEY = 'vespera_state_v2';

/** Strings from the test-only sample week (src/test/ownerWeek.ts) that must never appear in the app itself. */
export const PERSONAL_STRINGS = /Café Holiday Cup|Bookshop Shift|language-app|Laconic|Obdurate|Personal Essay|Exam Module/;

export async function pinClock(page: Page, at: Date = NOW): Promise<void> {
  await page.clock.setFixedTime(at);
}

/**
 * Put `value` into localStorage under `key` before the app's first load in this tab.
 * Reloads keep whatever the app saved since (the seed is written once per tab).
 */
export async function seedStorage(page: Page, key: string, value: string): Promise<void> {
  await page.addInitScript(
    ([k, v]) => {
      if (sessionStorage.getItem(`__e2e_seeded:${k}`)) return;
      localStorage.setItem(k, v);
      sessionStorage.setItem(`__e2e_seeded:${k}`, '1');
    },
    [key, value] as const,
  );
}

export async function seedBoard(page: Page, board: unknown, key = STORAGE_KEY): Promise<void> {
  await seedStorage(page, key, JSON.stringify(board));
}

/** A generic test board: a study block running "now" (10:00–11:00), a few quests and a note. */
export function testBoard(extra: Partial<VesperaState> = {}): VesperaState {
  const base = createBaseState(TODAY);
  const study: OneOffBlock = { id: 'blk-e2e-study', date: TODAY, title: 'Morning study', kind: 'focus', start: 10 * 60, end: 11 * 60, categoryId: 'cat-study' };
  const tasks: Task[] = [
    { id: 'task-e2e-1', title: 'Water the ferns', categoryId: 'cat-reset', done: false },
    { id: 'task-e2e-2', title: 'Read chapter three', categoryId: 'cat-study', done: false, dueDate: TODAY },
  ];
  return {
    ...base,
    lastRolloverDate: TODAY,
    blocks: [study],
    tasks,
    notes: [{ id: 'note-e2e-1', tagId: 'tag-braindump', text: 'A tidy test thought' }],
    ...extra,
  };
}

/** On phones only one panel shows at a time: open the one asked for (no-op on wider screens). */
export async function showPanel(page: Page, panel: 'Timeline' | 'Quests' | 'Pinboard'): Promise<void> {
  const tab = page.getByRole('tablist', { name: 'Panels' }).getByRole('tab', { name: panel });
  if (await tab.isVisible()) {
    await tab.click();
    return;
  }
  if (panel === 'Pinboard') {
    const page2 = page.getByRole('tablist', { name: 'Pages' }).getByRole('tab', { name: /Pinboard/ });
    if (await page2.isVisible()) await page2.click();
  }
  if (panel === 'Quests') {
    const page2 = page.getByRole('tablist', { name: 'Pages' }).getByRole('tab', { name: /Quest Board/ });
    if (await page2.isVisible()) await page2.click();
  }
}

/** WCAG contrast ratio between two CSS rgb() colors. */
export function contrast(a: string, b: string): number {
  const lum = (rgb: string) => {
    const [r, g, bl] = (rgb.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map((n) => {
      const c = Number(n) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export { expect };
