import { test, type Page } from '@playwright/test';
import { contrast, expect, pinClock, seedBoard, showPanel, testBoard } from './fixtures';

async function openVanity(page: Page) {
  await page.getByRole('button', { name: 'Open Settings' }).click();
  return page.getByRole('dialog', { name: 'Settings' });
}

/** Page background vs main text color, as actually rendered. */
async function pageContrast(page: Page): Promise<number> {
  const [bg, fg] = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    return [body.backgroundColor, body.color];
  });
  return contrast(bg, fg);
}

test.beforeEach(async ({ page }) => {
  await pinClock(page);
  await seedBoard(page, testBoard());
  await page.goto('/');
});

test('every realm paints the page and keeps text readable, and the choice survives a reload', async ({ page }) => {
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-realm', 'velvet');
  expect(await pageContrast(page)).toBeGreaterThanOrEqual(4.5);

  const drawer = await openVanity(page);
  await drawer.getByRole('button', { name: 'Theme', exact: true }).click();
  const realms = drawer.getByRole('radiogroup', { name: 'Theme' });
  for (const [name, id] of [['Starlit Ballroom', 'moonlit'], ['Vintage Vanity', 'vintage'], ['Sunlit Conservatory', 'sunlit']] as const) {
    await realms.getByRole('radio', { name: new RegExp(name) }).click();
    await expect(html).toHaveAttribute('data-realm', id);
    expect(await pageContrast(page), `${name} contrast`).toBeGreaterThanOrEqual(4.5);
  }

  // Sunlit Conservatory is the light realm.
  await expect(html).toHaveCSS('color-scheme', 'light');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const [r, g, b] = (bg.match(/\d+/g) ?? []).map(Number);
  expect((r + g + b) / 3).toBeGreaterThan(200);

  await page.keyboard.press('Escape');
  await page.reload();
  await expect(html).toHaveAttribute('data-realm', 'sunlit');
});

test('a custom wax seal is pressed into finished quests', async ({ page }) => {
  const drawer = await openVanity(page);
  await drawer.getByRole('button', { name: 'Wax seal', exact: true }).click();
  await drawer.getByRole('radiogroup', { name: 'Seal color' }).getByRole('radio', { name: /Gold/ }).click();
  await drawer.getByRole('radiogroup', { name: 'Emblem' }).getByRole('radio', { name: /Crown/ }).click();
  await expect(drawer.getByRole('img', { name: 'Gold wax seal with a crown' })).toBeVisible();
  await page.keyboard.press('Escape');

  await showPanel(page, 'Quests');
  const quest = page.getByRole('checkbox', { name: 'Water the ferns' });
  await quest.click();
  await expect(quest).toHaveAttribute('aria-checked', 'true');
  await expect(quest.locator('[data-emblem="crown"][data-seal-color="gold"]')).toBeVisible();
});

test('the living desk trinket wakes for the current block and can be swapped', async ({ page }) => {
  // 10:30 inside the 10:00–11:00 study block: the kitten is awake.
  await expect(page.getByRole('button', { name: 'Castle kitten, awake' })).toBeVisible();

  const drawer = await openVanity(page);
  await drawer.getByRole('button', { name: 'Desk trinket', exact: true }).click();
  await drawer.getByRole('radiogroup', { name: 'Desk trinket' }).getByRole('radio', { name: /Firefly jar/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Firefly jar, \d+ small wins? this week$/ })).toBeVisible();

  const again = await openVanity(page);
  await again.getByRole('button', { name: 'Desk trinket', exact: true }).click();
  await again.getByRole('radiogroup', { name: 'Desk trinket' }).getByRole('radio', { name: /Rosewater vial/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Rosewater vial, 0 of 2 quests' })).toBeVisible();
});
