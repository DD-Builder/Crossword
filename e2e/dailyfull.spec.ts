/** Verify the Daily Full serves a library 15x15 lattice puzzle. Targets a
 * fixed Wednesday directly (not "today") — Sunday's daily is deliberately a
 * 21×21 grand grid, so resolving via the live date would flake once a week. */
import { expect, test } from '@playwright/test';

test('daily full loads a 15x15 library puzzle', async ({ page }) => {
  await page.goto('/#/puzzle/daily-2026-07-08'); // a Wednesday
  await page.waitForSelector('.xw-grid', { timeout: 20_000 });
  await expect(page.locator('.xw-cell')).toHaveCount(225);
  const title = await page.locator('.tb-title').textContent();
  expect(title?.length).toBeGreaterThan(2);
  await page.screenshot({ path: 'e2e/screenshots/daily-full.png' });
});
