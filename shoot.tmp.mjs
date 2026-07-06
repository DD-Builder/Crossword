import { chromium } from '@playwright/test';
const OUT = '/tmp/claude-0/-home-user/979c8444-6ce0-54ac-8916-ade33b17a912/scratchpad/shots';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
const scenes = process.argv[2].split(',');
const waits = (process.argv[3] ?? '2200').split(',').map(Number);
for (const id of scenes) {
  for (const [i, wait] of waits.entries()) {
    await page.goto(`http://127.0.0.1:5199/#/dev?scene=${encodeURIComponent(id)}${process.argv[4] === 'dark' ? '&mode=dark' : ''}`);
    await page.waitForTimeout(150 + wait);
    await page.screenshot({ path: `${OUT}/${id.replace('/', '_')}${process.argv[4] === 'dark' ? '_dark' : ''}_t${i}.png` });
  }
}
await browser.close();
