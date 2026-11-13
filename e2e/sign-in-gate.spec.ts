// The sign-in gate, against a build configured for sync (at an address nothing answers on) and without the
// local-only flag: exactly what a signed-out visitor to the deployed site gets. Nothing of a board may show,
// even when this browser holds one from before sign-in existed.
import { test } from '@playwright/test';
import { expect, pinClock, seedBoard, testBoard } from './fixtures';
import { GATE_BASE_URL } from './ports';

const SECRET_QUEST = 'Secret test quest';
const SECRET_NOTE = 'A private note about the castle garden';

test.use({ baseURL: GATE_BASE_URL });

test.beforeEach(async ({ page }) => {
  await pinClock(page);
  const board = testBoard();
  await seedBoard(page, {
    ...board,
    tasks: [...board.tasks, { id: 'task-e2e-secret', title: SECRET_QUEST, categoryId: 'cat-reset', done: false }],
    notes: [...board.notes, { id: 'note-e2e-secret', tagId: 'tag-braindump', text: SECRET_NOTE }],
  });
});

test('a signed-out visitor sees only the gate: the sign-in form and nothing of the board', async ({ page }) => {
  await page.goto('/');
  const gate = page.getByRole('main', { name: 'Sign in to Vespera' });
  await expect(gate.getByRole('heading', { level: 1, name: 'Vespera' })).toBeVisible();
  await expect(gate.getByText('a storybook planner')).toBeVisible();
  await expect(gate.getByLabel('Email')).toBeVisible();
  await expect(gate.getByLabel('Password')).toBeVisible();
  await expect(gate.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await gate.getByRole('button', { name: 'New here? Create an account' }).click();
  await expect(gate.getByRole('button', { name: 'Create account' })).toBeVisible();

  for (const name of ['Daily Timeline', 'Quest Board', 'Pinboard']) await expect(page.getByRole('region', { name })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open Settings' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Quick Scribe' })).toHaveCount(0);

  // Not in the text, the labels, or anywhere else in the page.
  const text = await page.locator('body').innerText();
  const html = await page.content();
  for (const secret of [SECRET_QUEST, SECRET_NOTE, 'Water the ferns', 'A tidy test thought']) {
    expect(text).not.toContain(secret);
    expect(html).not.toContain(secret);
  }

  // The board this browser held is still there, untouched: the gate never erases it.
  expect(await page.evaluate(() => localStorage.getItem('vespera_state_v2'))).toContain(SECRET_QUEST);
});

test('the gate fits the screen without sideways scrolling, with tappable controls', async ({ page }) => {
  await page.goto('/');
  const gate = page.getByRole('main', { name: 'Sign in to Vespera' });
  await expect(gate.getByLabel('Email')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const control of [gate.getByRole('button', { name: 'Continue with Google' }), gate.getByLabel('Email'), gate.getByLabel('Password'), gate.getByRole('button', { name: 'Sign in' })]) {
    const box = await control.boundingBox();
    expect(Math.round(box!.height)).toBeGreaterThanOrEqual(44);
  }
});
