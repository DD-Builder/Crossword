import { test, expect } from '@playwright/test';

const SIZE_KNOB_VALUES = [5, 7, 9, 11, 13, 15, 17, 19, 21];

/** Click the right (or left) half of a knob's body N times to step it. */
async function stepKnob(page: import('@playwright/test').Page, index: number, steps: number): Promise<void> {
  const body = page.locator('.knob').nth(index).locator('.knob-body');
  const box = await body.boundingBox();
  if (!box) throw new Error('knob not visible');
  const x = box.x + box.width * (steps >= 0 ? 0.85 : 0.15);
  const y = box.y + box.height / 2;
  for (let i = 0; i < Math.abs(steps); i++) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(120);
  }
}

// In-puzzle "Tune" panel: knobs regenerate the grid live. Guards the retune
// wiring and the 9×9 → 13×13 American fill via the Size knob.
test('in-puzzle tune rebuilds the grid at a new size', async ({ page }) => {
  await page.goto('/#/puzzle/gen?mode=free&size=9&difficulty=3&seed=rtE2E');
  await page.waitForSelector('.xw-grid .xw-cell', { timeout: 15000 });
  const before = await page.locator('.xw-grid .xw-cell').count();
  expect(before).toBe(81); // 9×9

  await page.locator('.retune-toggle').click();
  await page.locator('.retune-panel').waitFor({ state: 'visible' });
  // Size knob is index 1 (Difficulty, Size, Clue style); 9×9 is index 2 of
  // SIZE_KNOB_VALUES, 13×13 is index 4 — two steps right.
  expect(SIZE_KNOB_VALUES[2]).toBe(9);
  expect(SIZE_KNOB_VALUES[4]).toBe(13);
  await stepKnob(page, 1, 2);

  await page.waitForFunction(
    (b) => {
      const n = document.querySelectorAll('.xw-grid .xw-cell').length;
      return n > 0 && n !== b;
    },
    before,
    { timeout: 15000 },
  );
  expect(await page.locator('.xw-grid .xw-cell').count()).toBe(169); // 13×13
});

// Dailies stay fixed/shared for everyone, but the tune knobs are available —
// touching one detaches into a fresh Free Play puzzle at the adjusted
// setting, leaving the original daily untouched (see puzzle.ts retune()).
test('tuning a daily detaches into Free Play without touching the original', async ({ page }) => {
  await page.goto('/#/puzzle/daily-2026-07-08'); // a Wednesday
  await page.waitForSelector('.xw-grid .xw-cell', { timeout: 15000 });
  const originalTitle = await page.locator('.tb-title').textContent();

  await page.locator('.retune-toggle').click();
  await page.locator('.retune-panel').waitFor({ state: 'visible' });
  expect(await page.locator('.knob').nth(0).locator('.knob-value').textContent()).toBe('Wed');

  await stepKnob(page, 0, -1); // Difficulty knob, one step down: Wed → Tue

  await expect(page).toHaveURL(/puzzle\/gen\?/);
  await page.waitForSelector('.xw-grid .xw-cell', { timeout: 15000 });
  await expect(page.locator('.tb-title')).toContainText('Free Play');

  // The original daily is untouched — reopening it shows the same title again.
  await page.goto('/#/puzzle/daily-2026-07-08');
  await page.waitForSelector('.xw-grid .xw-cell', { timeout: 15000 });
  await expect(page.locator('.tb-title')).toHaveText(originalTitle ?? '');
});
