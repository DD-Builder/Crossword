#!/usr/bin/env node
// Render PWA/iOS PNG icons from the favicon SVG using the sandbox Chromium.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const svg = readFileSync(`${ROOT}public/icons/favicon.svg`, 'utf8');

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-gpu'],
});

for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  // Home-screen PNGs are full-bleed: iOS and maskable Android apply their
  // own corner masks; baked-in rounding would leave dead corners.
  const fullBleed = svg.replaceAll('rx="96"', 'rx="0"');
  await page.setContent(
    `<body style="margin:0">${fullBleed.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`,
  );
  await page.screenshot({ path: `${ROOT}public/icons/icon-${size}.png` });
  await page.close();
  console.log(`icon-${size}.png`);
}
await browser.close();
