import { test } from '@playwright/test';
import { expect, pinClock, seedStorage, showPanel, STORAGE_KEY, testBoard } from './fixtures';

/** A board as an older (v2) build saved it: no schemaVersion and no archives. */
function legacyV2Text(): string {
  const { schemaVersion: _v, chronicleArchive: _c, activityArchive: _a, captureLog: _l, ...v2 } = testBoard();
  return JSON.stringify(v2);
}

test('an older board is upgraded to schema 3, with the original kept as vespera_backup_v2', async ({ page }) => {
  const original = legacyV2Text();
  await pinClock(page);
  await seedStorage(page, STORAGE_KEY, original);
  await page.goto('/');
  await showPanel(page, 'Quests');
  await expect(page.getByRole('checkbox', { name: 'Water the ferns' })).toBeVisible();

  const stored = await page.evaluate((key) => ({ board: localStorage.getItem(key), backup: localStorage.getItem('vespera_backup_v2') }), STORAGE_KEY);
  expect(stored.backup).toBe(original);
  expect(JSON.parse(stored.board!).schemaVersion).toBe(3);

  // Upgrading is a one-off: a reload keeps the same single backup and stays on schema 3.
  await page.reload();
  const again = await page.evaluate((key) => ({ board: localStorage.getItem(key), backup: localStorage.getItem('vespera_backup_v2') }), STORAGE_KEY);
  expect(again.backup).toBe(original);
  expect(JSON.parse(again.board!).schemaVersion).toBe(3);
});

test('a board from a newer version opens read-only, asks to reload, and is never overwritten', async ({ page }) => {
  const future = JSON.stringify({ ...JSON.parse(legacyV2Text()), schemaVersion: 99, someFutureField: { keep: 'me' } });
  await pinClock(page);
  await seedStorage(page, STORAGE_KEY, future);
  await page.goto('/');

  await expect(page.getByText('A newer version of Vespera is available', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();

  // Even after an edit on this older version, the newer board stays exactly as it was.
  await showPanel(page, 'Quests');
  const quest = page.getByRole('checkbox', { name: 'Water the ferns' });
  if (await quest.isVisible()) await quest.click();
  await page.waitForTimeout(300);
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(future);

  await page.reload();
  await expect(page.getByText('A newer version of Vespera is available', { exact: false })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe(future);
});
