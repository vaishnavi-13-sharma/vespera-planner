import { test } from '@playwright/test';
import { expect, pinClock, seedBoard, testBoard } from './fixtures';

test.beforeEach(async ({ page }) => {
  await pinClock(page);
  await seedBoard(page, testBoard());
  await page.goto('/');
});

test('each screen size gets its own layout', async ({ page }, testInfo) => {
  const timeline = page.getByRole('region', { name: 'Daily Timeline' });
  const quests = page.getByRole('region', { name: 'Quest Board' });
  const pinboard = page.getByRole('region', { name: 'Pinboard' });
  const panelTabs = page.getByRole('tablist', { name: 'Panels' });
  const pageTabs = page.getByRole('tablist', { name: 'Pages' });
  const nowPill = page.getByRole('button', { name: /^Happening now: Morning study/ });
  const fold = page.getByRole('button', { name: 'Fold Pinboard' });

  switch (testInfo.project.name) {
    case 'mobile-iphone': {
      // The Pocket Storybook: one panel at a time, a bottom tab bar, and the Happening Now pill.
      await expect(panelTabs).toBeVisible();
      await expect(panelTabs.getByRole('tab')).toHaveText([/Timeline/, /Quests/, /Pinboard/]);
      await expect(nowPill).toBeVisible();
      await expect(quests).toBeVisible();
      await expect(timeline).toBeHidden();
      await panelTabs.getByRole('tab', { name: /Pinboard/ }).click();
      await expect(pinboard).toBeVisible();
      await expect(quests).toBeHidden();
      await nowPill.click();
      await expect(timeline).toBeVisible();
      await expect(pageTabs).toHaveCount(0);
      await expect(fold).toHaveCount(0);
      break;
    }
    case 'tablet-ipad': {
      // The Two-Page Storybook: Timeline on the left, silk ribbon tabs for the right-hand page.
      await expect(timeline).toBeVisible();
      await expect(pageTabs).toBeVisible();
      await expect(pageTabs.getByRole('tab')).toHaveText([/Quest Board/, /Pinboard/]);
      await expect(quests).toBeVisible();
      await expect(pinboard).toBeHidden();
      await pageTabs.getByRole('tab', { name: /Pinboard/ }).click();
      await expect(pinboard).toBeVisible();
      await expect(quests).toBeHidden();
      const [left, right] = await Promise.all([timeline.boundingBox(), pinboard.boundingBox()]);
      expect(left!.x + left!.width).toBeLessThanOrEqual(right!.x);
      await expect(panelTabs).toHaveCount(0);
      await expect(nowPill).toHaveCount(0);
      break;
    }
    case 'desktop':
    case 'desktop-1150': {
      // The Vanity Triptych: three columns side by side, and a wax seal that folds the Pinboard away.
      await expect(timeline).toBeVisible();
      await expect(quests).toBeVisible();
      await expect(pinboard).toBeVisible();
      const [a, b, c] = await Promise.all([timeline.boundingBox(), quests.boundingBox(), pinboard.boundingBox()]);
      expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x);
      expect(b!.x + b!.width).toBeLessThanOrEqual(c!.x);
      await fold.click();
      await expect(page.getByRole('button', { name: 'Unfold Pinboard' })).toBeVisible();
      await expect(pinboard).toBeHidden();
      await page.getByRole('button', { name: 'Unfold Pinboard' }).click();
      await expect(pinboard).toBeVisible();
      await expect(panelTabs).toHaveCount(0);
      await expect(pageTabs).toHaveCount(0);
      break;
    }
  }
});

test('nothing spills sideways off the screen', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
