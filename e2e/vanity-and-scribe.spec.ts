// Settings as a single-open accordion, and the Quick Scribe's example chips.
// Every test opens a fresh board, the real starter guide, in its own isolated context.
import { test, type Locator, type Page } from '@playwright/test';
import { findBannedWords } from '../src/test/wording';
import { expect, pinClock } from './fixtures';

/** Words only a developer would know: never shown to the person using Vespera. */
const DEVELOPER_WORDS = /VESPERA_CLAUDE_BRIDGE|npm run dev|\bbridge\b|\bCLI\b/i;

const CHIPS = ['Add quest: Finish reading ch. 4', 'Block 2pm–3pm Deep Focus', 'Pin note: Buy oat milk', 'Fri 9am Coffee with Mum'];

const SECTIONS = ['Theme', 'Wax seal', 'Pinboard', 'Desk trinket', 'Quick Scribe', 'Your day', 'Gentle Start', 'Effects & sounds', 'Backup & reset'];

test.beforeEach(async ({ page }) => {
  await pinClock(page);
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Starter tutorial' })).toBeVisible();
});

async function openVanity(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Open Settings' }).click();
  const drawer = page.getByRole('dialog', { name: 'Settings' });
  await expect(drawer).toBeVisible();
  return drawer;
}

const header = (drawer: Locator, title: string) => drawer.getByRole('button', { name: title, exact: true });
const panel = (drawer: Locator, title: string) => drawer.getByRole('region', { name: title, exact: true });

/** Neither the page nor the drawer's own scroller can move sideways, and nothing inside pokes past the drawer. */
async function expectNoSidewaysScroll(page: Page, drawer: Locator) {
  const overflow = await drawer.evaluate((dialog) => {
    const box = dialog.getBoundingClientRect();
    const scrollers = [document.documentElement, ...dialog.querySelectorAll<HTMLElement>('*')].filter((el) => {
      const style = getComputedStyle(el);
      return el === document.documentElement || style.overflowX === 'auto' || style.overflowX === 'scroll' || style.overflowY === 'auto';
    });
    const scrolls = scrollers.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
    const poking = [...dialog.querySelectorAll<HTMLElement>('*')]
      .filter((el) => getComputedStyle(el).visibility !== 'hidden')
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.left < box.left - 1 || r.right > box.right + 1);
      })
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
    return { scrolls, poking };
  });
  expect(overflow.scrolls, 'sideways scrollers').toEqual([]);
  expect(overflow.poking, 'elements wider than the drawer').toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe('the Settings accordion', () => {
  test('every section starts folded, as a 44px header with a summary, and opening one folds the other', async ({ page }) => {
    const drawer = await openVanity(page);
    for (const title of SECTIONS) {
      const button = header(drawer, title);
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(panel(drawer, title)).toBeHidden();
      const box = (await button.boundingBox())!;
      expect(Math.round(box.height), `${title} header height`).toBeGreaterThanOrEqual(44);
      expect(await button.getAttribute('aria-describedby')).toBeTruthy();
    }
    await expect(header(drawer, 'Theme')).toContainText('Velvet Twilight · sky on');
    await expect(header(drawer, 'Quick Scribe')).toContainText('Free and offline');

    await header(drawer, 'Theme').click();
    await expect(header(drawer, 'Theme')).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();

    await header(drawer, 'Wax seal').click();
    await expect(header(drawer, 'Wax seal')).toHaveAttribute('aria-expanded', 'true');
    await expect(header(drawer, 'Theme')).toHaveAttribute('aria-expanded', 'false');
    await expect(panel(drawer, 'Theme')).toBeHidden();
    await expect(drawer.getByRole('radiogroup', { name: 'Seal color' })).toBeVisible();
    await expect(drawer.locator('button[aria-controls][aria-expanded="true"]')).toHaveCount(1);
  });

  test('Enter and Space open and fold a section', async ({ page }) => {
    const drawer = await openVanity(page);
    await header(drawer, 'Effects & sounds').focus();
    await page.keyboard.press('Enter');
    await expect(header(drawer, 'Effects & sounds')).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer.getByRole('switch', { name: 'Sparkles' })).toBeVisible();
    await header(drawer, 'Effects & sounds').focus();
    await page.keyboard.press(' ');
    await expect(header(drawer, 'Effects & sounds')).toHaveAttribute('aria-expanded', 'false');
    await expect(panel(drawer, 'Effects & sounds')).toBeHidden();
  });

  test('never scrolls sideways, folded or open, and speaks no developer words', async ({ page }) => {
    test.slow(); // opens and measures every section in turn
    const drawer = await openVanity(page);
    await expectNoSidewaysScroll(page, drawer);
    for (const title of SECTIONS) {
      await header(drawer, title).click();
      await expect(panel(drawer, title)).toBeVisible();
      if (title === 'Quick Scribe') await drawer.getByRole('button', { name: 'Use your own AI key (optional)' }).click();
      await expectNoSidewaysScroll(page, drawer);
      const text = await drawer.innerText();
      expect(text, `${title} section`).not.toMatch(DEVELOPER_WORDS);
      expect(findBannedWords(text), `${title} section`).toEqual([]);
    }
  });
});

test.describe('the Quick Scribe', () => {
  const modal = (page: Page) => page.getByRole('dialog', { name: 'Quick Scribe' });
  const pill = (page: Page) => page.getByRole('banner').getByRole('button', { name: 'Quick Scribe' });

  async function expectChips(page: Page) {
    const dialog = modal(page);
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);
    const chips = dialog.getByRole('group', { name: 'Things to try' }).getByRole('button');
    await expect(chips).toHaveText(CHIPS);
    // Let the opening flourish settle before measuring.
    await expect.poll(() => dialog.evaluate((el) => el.getAnimations().filter((a) => a.playState === 'running').length)).toBe(0);
    for (const chip of await chips.all()) expect(Math.round((await chip.boundingBox())!.height)).toBeGreaterThanOrEqual(44);
    // Centered, within 10% of the middle both ways.
    const box = (await dialog.boundingBox())!;
    const { width, height } = page.viewportSize()!;
    expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThanOrEqual(width * 0.1);
    expect(Math.abs(box.y + box.height / 2 - height / 2)).toBeLessThanOrEqual(height * 0.1);
  }

  test('⌘K and the pill open the centered modal with the four chips, never the settings', async ({ page }) => {
    await expect(pill(page)).toBeVisible();
    await page.keyboard.press('Meta+K');
    await expectChips(page);
    await page.keyboard.press('Escape');
    await expect(modal(page)).toBeHidden();

    await pill(page).click();
    await expectChips(page);
  });

  test('a tapped chip fills the page and previews as it says', async ({ page }) => {
    await pill(page).click();
    const dialog = modal(page);
    await dialog.getByRole('button', { name: 'Block 2pm–3pm Deep Focus' }).click();
    await expect(dialog.getByLabel('Capture')).toHaveValue('Block 2pm–3pm Deep Focus');
    await expect(dialog.getByText(/^Block · .* · 2:00 PM – 3:00 PM/)).toBeVisible();
    await expect(dialog.getByText('Deep Focus', { exact: true })).toBeVisible();

    // A blank page brings the chips back.
    const clear = () =>
      expect(async () => {
        await dialog.getByLabel('Capture').fill('');
        await expect(dialog.getByRole('group', { name: 'Things to try' })).toBeVisible({ timeout: 1000 });
      }).toPass();

    await clear();
    await dialog.getByRole('button', { name: 'Add quest: Finish reading ch. 4' }).click();
    await expect(dialog.getByText(/^Quest · /)).toBeVisible();

    await clear();
    await dialog.getByRole('button', { name: 'Pin note: Buy oat milk' }).click();
    await expect(dialog.getByText(/^Note · /)).toBeVisible();
  });
});
