import { test, type Page } from '@playwright/test';
import { findWordingIssues } from '../src/test/wording';
import { expect, PERSONAL_STRINGS, pinClock, showPanel } from './fixtures';

/** Everything on the page a person can read or hear: rendered text plus labels, titles, placeholders and alt text. */
async function heardText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const attrs = ['aria-label', 'aria-description', 'aria-roledescription', 'aria-valuetext', 'title', 'placeholder', 'alt'];
    const labels = [...document.body.querySelectorAll('*')].flatMap((el) => attrs.map((a) => el.getAttribute(a) ?? ''));
    return [document.body.innerText, document.title, ...labels].join('\n');
  });
}

test.describe('a brand-new visitor', () => {
  test.beforeEach(async ({ page }) => {
    await pinClock(page);
    await page.goto('/');
  });

  test('sees the "Welcome to Vespera" starter guide and nothing personal', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Vespera' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Starter tutorial' })).toBeVisible();
    await showPanel(page, 'Quests');
    await expect(page.getByRole('checkbox', { name: /Check off a task to light today’s candle/ })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(PERSONAL_STRINGS);
  });

  test('hears only plain fairy-tale words, with the starter guide and Settings open', async ({ page }) => {
    await expect(page.getByRole('region', { name: 'Starter tutorial' })).toBeVisible();
    for (const panel of ['Timeline', 'Quests', 'Pinboard'] as const) {
      await showPanel(page, panel);
      expect(findWordingIssues(await heardText(page)), `${panel} panel`).toEqual([]);
    }
    await page.getByRole('button', { name: 'Open Settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    expect(findWordingIssues(await heardText(page)), 'Settings').toEqual([]);
  });

  test('can press their first wax seal', async ({ page }) => {
    await showPanel(page, 'Quests');
    const seal = page.getByRole('checkbox', { name: /Check off a task to light today’s candle/ });
    await expect(seal).toHaveAttribute('aria-checked', 'false');
    await seal.click();
    await expect(seal).toHaveAttribute('aria-checked', 'true');
    await expect(seal.locator('[data-emblem]')).toBeVisible();
  });

  test('can clear the starter tutorial and start fresh', async ({ page }) => {
    await page.getByRole('button', { name: /Clear starter tutorial & start fresh/ }).first().click();
    const dialog = page.getByRole('alertdialog', { name: 'Clear the starter tutorial?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /Clear it & start fresh/ }).click();
    await expect(page.getByRole('region', { name: 'Starter tutorial' })).toHaveCount(0);
    await showPanel(page, 'Quests');
    await expect(page.getByRole('checkbox', { name: /Check off a task to light today’s candle/ })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('region', { name: 'Starter tutorial' })).toHaveCount(0);
  });
});
