/** Verify the Daily Full serves a library 15x15 lattice puzzle. */
import { expect, test } from '@playwright/test';

test('daily full loads a 15x15 library puzzle', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /The Daily/ }).first().click();
  await page.waitForSelector('.xw-grid', { timeout: 20_000 });
  await expect(page.locator('.xw-cell')).toHaveCount(225);
  const title = await page.locator('.tb-title').textContent();
  expect(title?.length).toBeGreaterThan(2);
  await page.screenshot({ path: 'e2e/screenshots/daily-full.png' });
});
