/** Visual pass: capture key views and a few skins at iPad-landscape size.
 * Not assertive beyond smoke-level visibility — output goes to
 * e2e/screenshots/ for human review. */

import { test } from '@playwright/test';

test.use({ viewport: { width: 1180, height: 820 } }); // iPad Air landscape

const shot = (name: string) => `e2e/screenshots/${name}.png`;

test('capture core views', async ({ page }) => {
  await page.goto('/');
  await page.screenshot({ path: shot('home') });

  await page.goto('/#/themed');
  await page.screenshot({ path: shot('themed') });

  await page.goto('/#/kids');
  await page.screenshot({ path: shot('kids') });

  await page.goto('/#/settings');
  await page.screenshot({ path: shot('settings') });

  // Solver, light + dark, two skins.
  await page.goto('/');
  await page.getByRole('button', { name: /The Mini/ }).first().click();
  await page.waitForSelector('.xw-grid');
  await page.keyboard.type('CAT');
  await page.screenshot({ path: shot('solver-classic-light') });

  await page.evaluate(() => {
    document.documentElement.dataset.mode = 'dark';
  });
  await page.screenshot({ path: shot('solver-classic-dark') });

  await page.evaluate(() => {
    document.documentElement.dataset.skin = 'botanical';
    document.documentElement.dataset.mode = 'light';
  });
  await page.screenshot({ path: shot('solver-botanical') });

  await page.evaluate(() => {
    document.documentElement.dataset.skin = 'lisa-frank';
  });
  await page.screenshot({ path: shot('solver-lisa-frank') });

  // Phone portrait: soft keyboard + clue bar.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: shot('solver-phone') });
});
