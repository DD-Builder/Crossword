/** Live-generation smoke: Free Play at every offered size, plus themed and
 * kids, must actually build a grid — not the "Could not build" error page.
 * This is the coverage gap that let broken generation ship: the other specs
 * only exercise the hand-authored library. */
import { expect, test } from '@playwright/test';

const SIZES = [5, 7, 9, 11, 13, 15];

for (const size of SIZES) {
  test(`free play ${size}x${size} builds a grid`, async ({ page }) => {
    await page.goto(`/#/puzzle/gen?mode=free&size=${size}&difficulty=1&seed=7`);
    await page.waitForSelector('.xw-grid', { timeout: 20_000 });
    await expect(page.locator('.solver-loading')).toHaveCount(0);
    await expect(page.getByText('Could not build')).toHaveCount(0);
    await expect(page.locator('.xw-cell').first()).toBeVisible();
  });
}

test('themed puzzle builds a grid (local fallback, no key)', async ({ page }) => {
  await page.goto('/#/puzzle/gen?mode=themed&size=9&difficulty=3&theme=ocean&seed=3');
  await page.waitForSelector('.xw-grid', { timeout: 20_000 });
  await expect(page.getByText('Could not build')).toHaveCount(0);
});

test('kids puzzle builds a grid', async ({ page }) => {
  await page.goto('/#/puzzle/gen?mode=kids&grade=2&theme=animals&seed=4');
  await page.waitForSelector('.xw-grid', { timeout: 20_000 });
  await expect(page.getByText('Could not build')).toHaveCount(0);
});
