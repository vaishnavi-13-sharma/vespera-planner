// Quick Scribe (v1.0): a header pill beside the Vanity Drawer opens a centered storybook modal.
// Nothing floats at the bottom of the screen any more (on phones, only the tab bar lives there).
import { test, type Page } from '@playwright/test';
import type { RealmId } from '../src/context/types';
import { contrast, expect, pinClock, seedBoard, showPanel, testBoard } from './fixtures';

const pill = (page: Page) => page.getByRole('banner').getByRole('button', { name: 'Quick Scribe' });
const modal = (page: Page) => page.getByRole('dialog', { name: 'Quick Scribe' });

async function start(page: Page, realm: RealmId = 'velvet') {
  await pinClock(page);
  const board = testBoard();
  await seedBoard(page, { ...board, settings: { ...board.settings, realm } });
  await page.goto('/');
}

/** The modal's bounding-box center sits within 10% of the viewport's center, both ways. */
async function expectCentered(page: Page) {
  const dialog = modal(page);
  await expect(dialog).toBeVisible();
  // Let the opening flourish settle before measuring.
  await expect.poll(() => dialog.evaluate((el) => el.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);
  const box = (await dialog.boundingBox())!;
  const { width, height } = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThanOrEqual(width * 0.1);
  expect(Math.abs(box.y + box.height / 2 - height / 2)).toBeLessThanOrEqual(height * 0.1);
  // A margin on every side, even on a phone.
  expect(box.x).toBeGreaterThanOrEqual(8);
  expect(box.x + box.width).toBeLessThanOrEqual(width - 8);
}

test('the pill sits in the header beside the Vanity Drawer, never over the title', async ({ page }, testInfo) => {
  await start(page);
  const button = pill(page);
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K');

  const [b, gear, title] = await Promise.all([
    button.boundingBox(),
    page.getByRole('button', { name: 'Open Settings' }).boundingBox(),
    page.getByRole('heading', { level: 1, name: 'Vespera' }).boundingBox(),
  ]);
  expect(Math.round(b!.width)).toBeGreaterThanOrEqual(44);
  expect(Math.round(b!.height)).toBeGreaterThanOrEqual(44);
  // Beside the gear, on the same line, just to its left.
  expect(Math.abs(b!.y - gear!.y)).toBeLessThanOrEqual(2);
  expect(b!.x + b!.width).toBeLessThanOrEqual(gear!.x);
  // Never overlapping the title.
  const overlaps = b!.x < title!.x + title!.width && title!.x < b!.x + b!.width && b!.y < title!.y + title!.height && title!.y < b!.y + b!.height;
  expect(overlaps).toBe(false);

  if (testInfo.project.name === 'mobile-iphone') {
    // A round quill on phones.
    expect(Math.round(b!.width)).toBe(44);
    await expect(button.getByText('Quick Scribe')).toBeHidden();
  } else {
    await expect(button.getByText('Quick Scribe')).toBeVisible();
  }
});

test('nothing floats in the bottom 120px (on phones, only the tab bar)', async ({ page }, testInfo) => {
  await start(page);
  await expect(pill(page)).toBeVisible();
  const floaters = await page.evaluate(() => {
    const vh = window.innerHeight;
    const tabBar = document.querySelector('nav[aria-label="Panels"]');
    const found: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const style = getComputedStyle(el);
      if (style.position !== 'fixed' && style.position !== 'sticky') continue;
      // Decorative layers (seasonal decor, sparkles, the empty toast well) never take a tap.
      if (style.pointerEvents === 'none' || style.display === 'none' || style.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom <= vh - 120 || r.top >= vh) continue;
      if (tabBar && tabBar.contains(el)) continue;
      found.push(`${el.tagName.toLowerCase()}.${el.className}`);
    }
    return { found, tabBar: !!tabBar && getComputedStyle(tabBar).display !== 'none' };
  });
  expect(floaters.found).toEqual([]);
  expect(floaters.tabBar).toBe(testInfo.project.name === 'mobile-iphone');
});

test('a click on the pill opens the modal in the middle of the screen', async ({ page }) => {
  await start(page);
  await pill(page).click();
  await expectCentered(page);
  await expect(modal(page).getByLabel('Capture')).toBeFocused();
  await modal(page).getByRole('button', { name: 'Close' }).click();
  await expect(modal(page)).toBeHidden();
});

test('Meta+K opens it centered too, and Escape closes it', async ({ page }) => {
  await start(page);
  await expect(pill(page)).toBeVisible();
  await page.keyboard.press('Meta+K');
  await expectCentered(page);
  await page.keyboard.press('Escape');
  await expect(modal(page)).toBeHidden();
  await page.keyboard.press('Control+K');
  await expect(modal(page)).toBeVisible();
});

test('a backdrop click closes it', async ({ page }) => {
  await start(page);
  await pill(page).click();
  await expect(modal(page)).toBeVisible();
  await page.mouse.click(4, 4);
  await expect(modal(page)).toBeHidden();
});

test('typing a quest and pressing Enter closes it and adds the quest', async ({ page }) => {
  await start(page);
  await pill(page).click();
  await modal(page).getByLabel('Capture').fill('quest: water the roses');
  await page.keyboard.press('Enter');
  await expect(modal(page)).toBeHidden();
  await expect(page.getByText('Captured 1 thing')).toBeVisible();
  await showPanel(page, 'Quests');
  await expect(page.getByRole('region', { name: 'Quest Board' }).getByText('Water the roses')).toBeVisible();
});

for (const realm of ['velvet', 'sunlit', 'moonlit'] as const) {
  test(`the page reads as ink on parchment in the ${realm} realm`, async ({ page }) => {
    await start(page, realm);
    await pill(page).click();
    const dialog = modal(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Plan my day' }).click();
    const ratios = await dialog.evaluate((el) => {
      const paper = getComputedStyle(el).getPropertyValue('--color-parchment').trim();
      const probe = document.createElement('span');
      el.appendChild(probe);
      const rgb = (css: string) => {
        probe.style.color = css;
        return getComputedStyle(probe).color;
      };
      const bg = rgb(paper);
      const colorOf = (sel: string) => getComputedStyle(el.querySelector(sel)!).color;
      const out = {
        bg,
        title: colorOf('h2'),
        chip: colorOf('[role="group"] button'),
        hint: colorOf('.scribe-hint'),
        save: getComputedStyle(Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Save'))!).color,
        saveBg: getComputedStyle(Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Save'))!).backgroundColor,
      };
      probe.remove();
      return out;
    });
    expect(contrast(ratios.bg, ratios.title), 'title').toBeGreaterThanOrEqual(4.5);
    expect(contrast(ratios.bg, ratios.chip), 'example chip').toBeGreaterThanOrEqual(4.5);
    expect(contrast(ratios.bg, ratios.hint), 'hint').toBeGreaterThanOrEqual(4.5);
    expect(contrast(ratios.saveBg, ratios.save), 'Save button').toBeGreaterThanOrEqual(4.5);
  });
}
