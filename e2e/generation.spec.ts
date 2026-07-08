/** Live-generation smoke: Free Play at every offered size, plus themed and
 * kids, must actually build a grid — not the "Could not build" error page.
 * This is the coverage gap that let broken generation ship: the other specs
 * only exercise the hand-authored library. */
import { expect, test } from '@playwright/test';

const SIZES = [5, 7, 9, 11, 13, 15, 17, 19, 21];

for (const size of SIZES) {
  test(`free play ${size}x${size} builds a grid`, async ({ page }) => {
    await page.goto(`/#/puzzle/gen?mode=free&size=${size}&difficulty=1&seed=7`);
    // Large grids run more fill restarts; give them headroom on slow CI.
    await page.waitForSelector('.xw-grid', { timeout: size >= 17 ? 40_000 : 20_000 });
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

// A K-2 kids puzzle is a lattice grid (alternate cells unchecked) — a grid type
// the solver hadn't exercised before. Solve one fully to prove lattice grids
// number, navigate, and detect completion correctly, not just render.
test('kindergarten lattice puzzle solves to completion', async ({ page }) => {
  await page.goto('/#/puzzle/gen?mode=kids&grade=K&theme=animals&seed=7');
  await page.waitForSelector('.xw-grid', { timeout: 20_000 });
  const hook = await page.evaluate(() => (window as unknown as {
    __xw?: { solution: string[]; rows: number; cols: number };
  }).__xw);
  expect(hook, 'window.__xw test hook must exist').toBeTruthy();
  const { solution, rows, cols } = hook!;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = solution[r]![c]!;
      if (ch === '#') continue;
      await page.locator(`.xw-cell[data-rc="${r},${c}"]`).click();
      await page.keyboard.press(ch);
    }
  }
  // Completion → the celebration card (after the victory scene, ~6–8s).
  await expect(page.locator('.celebrate')).toBeVisible({ timeout: 15_000 });
});
