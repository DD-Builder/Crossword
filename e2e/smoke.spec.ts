/** End-to-end smoke: navigate the shell, open the daily mini, solve it
 * entirely with the keyboard, and confirm the celebration + stats write.
 * The app exposes window.__xw (test hook) with the active session. */

import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __xw?: {
      solution: string[]; // grid rows of the active puzzle
      rows: number;
      cols: number;
    };
  }
}

async function openMini(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /The Mini/ }).first().click();
  await page.waitForSelector('.xw-grid', { timeout: 30_000 });
}

test('home renders daily cards and navigation works', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /The Daily/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /The Mini/ }).first()).toBeVisible();

  // Route walk: archive, stats, settings, free play, themed, kids.
  await page.getByRole('button', { name: 'Archive' }).click();
  await expect(page.locator('.cal-grid')).toBeVisible();
  await page.getByRole('button', { name: 'Stats' }).click();
  await expect(page.locator('.view-title')).toHaveText('Stats');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('.skin-gallery')).toBeVisible();
  await page.goto('/#/free');
  await expect(page.getByRole('button', { name: 'Build my puzzle' })).toBeVisible();
  await page.goto('/#/kids');
  await expect(page.locator('.kids-view')).toBeVisible();
});

test('keyboard navigation follows NYT conventions', async ({ page }) => {
  await openMini(page);

  const selected = page.locator('.xw-cell.selected');
  await expect(selected).toHaveCount(1);

  // Space toggles direction (in-word highlight axis flips).
  const before = await page.locator('.xw-grid').getAttribute('data-direction');
  await page.keyboard.press('Space');
  const after = await page.locator('.xw-grid').getAttribute('data-direction');
  expect(after).not.toBe(before);
  await page.keyboard.press('Space');

  // Typing advances the cursor.
  const posBefore = await selected.getAttribute('data-rc');
  await page.keyboard.press('A');
  const posAfter = await page.locator('.xw-cell.selected').getAttribute('data-rc');
  expect(posAfter).not.toBe(posBefore);

  // Backspace steps back and clears.
  await page.keyboard.press('Backspace');
  const posBack = await page.locator('.xw-cell.selected').getAttribute('data-rc');
  expect(posBack).toBe(posBefore);
});

test('solves the daily mini via keyboard and records the result', async ({ page }) => {
  await openMini(page);

  const hook = await page.evaluate(() => window.__xw);
  expect(hook, 'window.__xw test hook must exist').toBeTruthy();
  const { solution, rows, cols } = hook!;

  // Click each row's first white cell, ensure across, type the row's letters.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = solution[r]![c]!;
      if (ch === '#') continue;
      await page.locator(`.xw-cell[data-rc="${r},${c}"]`).click();
      // Force across via data-direction check.
      const dir = await page.locator('.xw-grid').getAttribute('data-direction');
      if (dir !== 'across') await page.keyboard.press('Space');
      await page.keyboard.press(ch);
    }
  }

  // The completion card now waits for the victory scene to finish (~6–8s) so it
  // never overlaps a live animation — allow headroom over the longest scene.
  await expect(page.locator('.celebrate')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.celebrate h3')).toContainText(/Solved|Flawless/);

  // Timer froze and stats got written (solves store has our row).
  const solveCount = await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    if (!dbs.some((d) => d.name === 'crossword')) return 0;
    return new Promise<number>((resolve) => {
      const req = indexedDB.open('crossword');
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('solves', 'readonly');
        const countReq = tx.objectStore('solves').count();
        countReq.onsuccess = () => resolve(countReq.result);
        countReq.onerror = () => resolve(0);
      };
      req.onerror = () => resolve(0);
    });
  });
  expect(solveCount).toBeGreaterThan(0);

  // Home shows the solved badge.
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('✓ Solved').first()).toBeVisible();
});

test('tapping during the victory animation skips straight to the card', async ({ page }) => {
  await openMini(page);
  const hook = await page.evaluate(() => window.__xw);
  const { solution, rows, cols } = hook!;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = solution[r]![c]!;
      if (ch === '#') continue;
      await page.locator(`.xw-cell[data-rc="${r},${c}"]`).click();
      const dir = await page.locator('.xw-grid').getAttribute('data-direction');
      if (dir !== 'across') await page.keyboard.press('Space');
      await page.keyboard.press(ch);
    }
  }
  // The scene starts ~150ms after the solve; a tap should bring the card up well
  // before the scene's full ~6–8s run would.
  await page.waitForTimeout(400);
  await expect(page.locator('.celebrate')).toHaveCount(0); // still animating
  await page.mouse.click(5, 5); // tap away from any control
  await expect(page.locator('.celebrate')).toBeVisible({ timeout: 2_000 });
});
