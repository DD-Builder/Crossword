import { test, expect } from '@playwright/test';

// In-puzzle "Tune" panel: change size/difficulty and the grid regenerates in
// place (with a morph). Guards the retune wiring and the 9×9 American fill.
test('in-puzzle tune rebuilds the grid at a new size', async ({ page }) => {
  await page.goto('/#/puzzle/gen?mode=free&size=9&difficulty=3&seed=rtE2E');
  await page.waitForSelector('.xw-grid .xw-cell', { timeout: 15000 });
  const before = await page.locator('.xw-grid .xw-cell').count();
  expect(before).toBe(81); // 9×9

  await page.locator('.retune-toggle').click();
  await page.locator('.retune-panel').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: '13×13' }).click();

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

// Dailies are fixed — no tune panel.
test('dailies are not retunable', async ({ page }) => {
  await page.goto('/#/');
  await page.waitForSelector('.mode-card');
  await page.goto('/#/puzzle/daily-2026-07-08');
  await page.waitForSelector('.xw-grid .xw-cell, .solver-loading', { timeout: 15000 });
  await page.waitForTimeout(500);
  expect(await page.locator('.retune-toggle').count()).toBe(0);
});
