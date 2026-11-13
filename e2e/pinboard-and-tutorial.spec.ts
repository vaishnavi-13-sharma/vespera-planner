// The Pinboard's aligned scrapbook and single header row, the header cluster, and the clickable starter tutorial.
// Every test opens a brand-new board, so it starts from the real "Welcome to Vespera" starter guide.
import { test, type Locator, type Page } from '@playwright/test';
import { expect, pinClock, showPanel } from './fixtures';

const pinboard = (page: Page) => page.getByRole('region', { name: 'Pinboard' });

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box, 'element has a box').not.toBeNull();
  return box!;
}

/** Each scrapbook row's paper tops (the grid cell and the tilted paper inside it), grouped by grid row. */
async function scrapbookRows(page: Page) {
  return pinboard(page)
    .getByRole('list', { name: 'Pinned notes' })
    .evaluate((ul) => {
      const columns = getComputedStyle(ul).gridTemplateColumns.split(' ').filter(Boolean).length;
      const cells = [...ul.children] as HTMLElement[];
      const rows: { cell: number; paper: number }[][] = [];
      cells.forEach((li, i) => {
        const paper = li.querySelector('article')!;
        (rows[Math.floor(i / columns)] ??= []).push({ cell: li.getBoundingClientRect().top, paper: paper.getBoundingClientRect().top });
      });
      return { columns, rows };
    });
}

async function expectLevelRows(page: Page) {
  const { columns, rows } = await scrapbookRows(page);
  for (const [i, row] of rows.entries()) {
    const spread = (key: 'cell' | 'paper') => Math.max(...row.map((c) => c[key])) - Math.min(...row.map((c) => c[key]));
    expect(spread('cell'), `row ${i + 1} cells`).toBeLessThanOrEqual(2);
    expect(spread('paper'), `row ${i + 1} papers`).toBeLessThanOrEqual(2);
  }
  return columns;
}

/** Elements inside the Pinboard that poke out of its card, or past their own scrapbook column. */
async function overflowingPieces(page: Page) {
  return pinboard(page).evaluate((section) => {
    const card = section.getBoundingClientRect();
    const out: string[] = [];
    const describe = (el: Element) => `${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').slice(0, 40)}`;
    for (const el of section.querySelectorAll('*')) {
      // Chips past the filter row's edge are scrolled out of sight, not overflowing.
      if (el.closest('.pinboard-filter') && !el.classList.contains('pinboard-filter')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.left < card.left - 1 || r.right > card.right + 1) out.push(`${describe(el)} leaves the card`);
    }
    // Layout widths, not the tilted papers' bounding boxes: a 0.6° tilt widens a box by a pixel or two without overflowing.
    for (const li of section.querySelectorAll<HTMLElement>('ul[aria-label="Pinned notes"] > li')) {
      for (const el of li.querySelectorAll<HTMLElement>('article, article *')) {
        if (!(el instanceof HTMLElement)) continue;
        if (el.offsetWidth > li.clientWidth + 1) out.push(`${describe(el)} is wider than its column`);
        if (el.tagName === 'ARTICLE' && el.scrollWidth > el.clientWidth + 1) out.push(`${describe(el)} has text spilling out`);
      }
    }
    return out;
  });
}

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'sideways page scroll').toBeLessThanOrEqual(0);
}

test.beforeEach(async ({ page }) => {
  await pinClock(page);
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Starter tutorial' })).toBeVisible();
  // Measure only once the self-hosted fonts are in: a busy run can lay out with fallback widths first.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
});

test.describe('the Pinboard', () => {
  test('pins its cards in level rows, with columns that follow the width', async ({ page }, testInfo) => {
    await showPanel(page, 'Pinboard');
    await expect(pinboard(page)).toBeVisible();
    const columns = await expectLevelRows(page);
    if (testInfo.project.name === 'mobile-iphone' || testInfo.project.name === 'tablet-ipad') expect(columns).toBeGreaterThanOrEqual(2);
    expect(await overflowingPieces(page)).toEqual([]);
    await noSidewaysScroll(page);

    if (testInfo.project.name === 'desktop') {
      // 1422px wide is roughly a 1280px screen at 90% zoom.
      await page.setViewportSize({ width: 1422, height: 900 });
      expect(await expectLevelRows(page)).toBeGreaterThanOrEqual(2);
      expect(await overflowingPieces(page)).toEqual([]);
      await noSidewaysScroll(page);
    }
  });

  test('keeps its title and tools on one header row, with one scrolling filter row below', async ({ page }, testInfo) => {
    await showPanel(page, 'Pinboard');
    const board = pinboard(page);
    const tools = board.getByRole('group', { name: 'Pinboard tools' });
    const controls = [tools.getByRole('button', { name: 'Edit tags' }), tools.getByRole('button', { name: /^Study · \d+ due$/ })];
    const desktop = testInfo.project.name.startsWith('desktop');
    if (desktop) controls.push(tools.getByRole('button', { name: 'Fold Pinboard' }));
    else await expect(tools.getByRole('button', { name: 'Fold Pinboard' })).toHaveCount(0);

    const boxes = await Promise.all(controls.map(boxOf));
    for (const b of boxes) {
      expect(Math.round(b.height)).toBeGreaterThanOrEqual(44);
      expect(Math.round(b.width)).toBeGreaterThanOrEqual(44);
    }
    const tops = boxes.map((b) => b.y);
    expect(Math.max(...tops) - Math.min(...tops), 'controls share one top').toBeLessThanOrEqual(4);
    // Evenly spaced, left to right.
    const gaps = boxes.slice(1).map((b, i) => b.x - (boxes[i].x + boxes[i].width));
    for (const gap of gaps) expect(Math.abs(gap - gaps[0])).toBeLessThanOrEqual(1);

    // The same row as the title: beside it, not under it.
    const title = await boxOf(board.getByRole('heading', { name: 'Pinboard' }));
    expect(boxes[0].x).toBeGreaterThanOrEqual(title.x + title.width);
    expect(Math.abs(boxes[0].y - title.y)).toBeLessThanOrEqual(8);

    // The filter chips: All first, one row, no wrapping, every chip 44px tall.
    const filters = board.getByRole('group', { name: 'Filter notes' });
    const chips = filters.getByRole('button');
    await expect(chips.first()).toHaveAccessibleName('All');
    const chipBoxes = await Promise.all((await chips.all()).map(boxOf));
    for (const c of chipBoxes) {
      expect(Math.round(c.height)).toBeGreaterThanOrEqual(44);
      expect(Math.abs(c.y - chipBoxes[0].y)).toBeLessThanOrEqual(1);
    }
    const filterBox = await boxOf(filters);
    expect(filterBox.y).toBeGreaterThanOrEqual(Math.max(...boxes.map((b) => b.y + b.height)));
    await noSidewaysScroll(page);
  });
});

test('the header cluster: time-of-day glyph, Quick Scribe and the gear, centred on one line', async ({ page }, testInfo) => {
  const banner = page.getByRole('banner');
  const glyph = banner.locator('[data-sky-glyph]');
  await expect(glyph).toHaveAttribute('data-sky-glyph', 'day');
  await expect(glyph).toHaveAttribute('aria-hidden', 'true');
  await expect(glyph).toHaveAttribute('title', 'Daytime');
  const [g, scribe, gear] = await Promise.all([
    boxOf(glyph),
    boxOf(banner.getByRole('button', { name: 'Quick Scribe' })),
    boxOf(banner.getByRole('button', { name: 'Open Settings' })),
  ]);
  const centres = [g, scribe, gear].map((b) => b.y + b.height / 2);
  expect(Math.max(...centres) - Math.min(...centres), 'one vertical centre').toBeLessThanOrEqual(2);
  for (const b of [g, scribe, gear]) expect(Math.round(b.height)).toBe(44);
  expect(g.x + g.width).toBeLessThanOrEqual(scribe.x);
  expect(scribe.x + scribe.width).toBeLessThanOrEqual(gear.x);
  // Evenly spaced.
  expect(Math.abs(scribe.x - (g.x + g.width) - (gear.x - (scribe.x + scribe.width)))).toBeLessThanOrEqual(1);
  if (testInfo.project.name === 'mobile-iphone') expect(Math.round(scribe.width)).toBe(44);

  // Nothing floats in the sky by the controls, and nothing overlaps the title.
  await expect(page.locator('.sky-moon')).toHaveCount(0);
  const title = await boxOf(page.getByRole('heading', { level: 1, name: 'Vespera' }));
  for (const b of [g, scribe, gear]) {
    const overlaps = b.x < title.x + title.width && title.x < b.x + b.width && b.y < title.y + title.height && title.y < b.y + b.height;
    expect(overlaps).toBe(false);
  }
  await noSidewaysScroll(page);
});

test.describe('the clickable tutorial', () => {
  test('"Start Here" turns to the quests, brings the category into view and rings it in gold', async ({ page }) => {
    // Start from the Pinboard, so phones and tablets must turn back to the quests.
    await showPanel(page, 'Pinboard');
    const button = page.getByRole('region', { name: 'Starter tutorial' }).getByRole('button', { name: 'Start Here' });
    expect(Math.round((await boxOf(button)).height)).toBeGreaterThanOrEqual(44);
    const category = page.getByRole('region', { name: 'Start Here' });
    // Read the 2-second ring the moment it's lit, before the glide (which can take longer on a busy machine).
    // By id: on phones and tablets the category is still in the hidden Quests panel here, out of reach of role queries.
    await page.locator('#quest-category-tut-cat-start').evaluate((el) => {
      const flag = window as unknown as { __lit?: boolean };
      flag.__lit = false;
      new MutationObserver(() => {
        if (el.hasAttribute('data-spotlight')) flag.__lit = true;
      }).observe(el, { attributes: true, attributeFilter: ['data-spotlight'] });
    });
    await button.click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __lit?: boolean }).__lit)).toBe(true);
    await expect(category).toBeInViewport();
    await expect(category).not.toHaveAttribute('data-spotlight', '', { timeout: 6000 });
    await noSidewaysScroll(page);
  });

  test('the Gentle Start quest opens Gentle Start, and the History quest opens History', async ({ page }) => {
    await showPanel(page, 'Quests');
    const startHere = page.getByRole('region', { name: 'Start Here' });
    await startHere.getByRole('button', { name: /^Feeling stuck\? Tap “Gentle Start”.*focus timer$/ }).click();
    const veil = page.getByRole('dialog', { name: 'Gentle Start' });
    await expect(veil).toBeVisible();
    await veil.getByRole('button', { name: 'Not now' }).click();
    await expect(veil).toHaveCount(0);

    await startHere.getByRole('button', { name: /^Check History tomorrow to see your completed tasks$/ }).click();
    await expect(page.getByRole('dialog', { name: 'History' })).toBeVisible();
  });

  test('the wax seal still checks a tutorial quest off', async ({ page }) => {
    await showPanel(page, 'Quests');
    const seal = page.getByRole('region', { name: 'Start Here' }).getByRole('checkbox', { name: /^Check History tomorrow/ });
    await seal.click();
    await expect(seal).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('dialog', { name: 'History' })).toHaveCount(0);
  });
});
