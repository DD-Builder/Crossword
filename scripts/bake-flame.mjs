#!/usr/bin/env node
// Bake a realistic flame to a sprite strip. External photographic fire loops are
// blocked by the sandbox proxy, so we render a physically-based particle fire
// (buoyant, turbulent, blackbody-colored, additively blended) in headless
// Chromium and capture N frames side by side. The backdrop is TRANSPARENT — the
// additive glow accumulates its own alpha — so the sprite drops onto the answer
// box directly, no blend mode needed. Deterministic (seeded) so rebuilds match.
//
//   node scripts/bake-flame.mjs   →   src/themes/flame.png (RGBA sprite strip)
//
// Swap-friendly: drop a real fire strip (transparent PNG, same frame count/size)
// at src/themes/flame.png and the CSS keeps working.

import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const FRAMES = 30;      // animation frames in the strip (~1s loop at 30fps)
const FW = 64, FH = 96;  // per-frame size (tall — flames lick upward; upscaled in CSS)

// Use the sandbox's pre-installed Chromium (mirrors playwright.config.ts).
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const page = await (await chromium.launch({ executablePath })).newPage();
await page.setViewportSize({ width: FW, height: FH });

// The whole fire sim runs in the page so it has a real canvas/2D context.
const dataUrl = await page.evaluate(async ({ FRAMES, FW, FH }) => {
  // Seeded RNG so the bake is deterministic.
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const strip = document.createElement('canvas');
  strip.width = FW * FRAMES; strip.height = FH;
  const sctx = strip.getContext('2d');

  const frame = document.createElement('canvas');
  frame.width = FW; frame.height = FH;
  const ctx = frame.getContext('2d');

  // Blackbody color ramp by particle life (1 = just born/hottest at the base).
  // A tiny white-hot base, then a rich yellow→orange→red body as it rises/cools.
  const color = (life) => {
    if (life > 0.95) return [255, 246, 208];      // tiny white-hot base
    if (life > 0.80) return [255, 206, 92];       // yellow
    if (life > 0.58) return [255, 140, 36];       // orange
    if (life > 0.34) return [240, 82, 22];        // deep orange
    if (life > 0.16) return [198, 44, 18];        // red
    return [120, 28, 18];                         // ember tip
  };

  const parts = [];
  const spawn = () => {
    // Narrow, slightly randomized base so the flame tapers like a real tongue.
    const x = FW / 2 + (rnd() - 0.5) * FW * 0.22;
    parts.push({
      x, y: FH - 4,
      vx: (rnd() - 0.5) * 5,
      vy: -(58 + rnd() * 40),               // strong upward launch
      life: 1, decay: 0.007 + rnd() * 0.012, // slow decay → tall flames
      r: 7 + rnd() * 9,
      wob: rnd() * Math.PI * 2,
      wobAmp: 22 + rnd() * 26,
    });
  };

  const step = (dt) => {
    for (let i = 0; i < 13; i++) spawn();  // denser column → fuller flame
    for (const p of parts) {
      p.wob += dt * 8;
      // Sway grows as the particle rises & cools (flames waver more up top).
      p.vx += Math.sin(p.wob) * p.wobAmp * (1.4 - p.life) * dt * 3;
      p.vy -= 46 * dt;                       // buoyancy accelerates upward
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay;
    }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
  };

  const draw = () => {
    ctx.clearRect(0, 0, FW, FH);            // transparent backdrop (alpha sprite)
    ctx.globalCompositeOperation = 'lighter'; // additive glow builds up alpha
    for (const p of parts) {
      const [r, g, b] = color(p.life);
      // Radius grows a touch as it rises (plume widens), alpha fades with life
      // and stays low so the additive stack glows without blowing out to white.
      const rad = p.r * (0.5 + (1 - p.life) * 0.8);
      const a = 0.17 * p.life;   // low alpha → additive stack keeps fire color, not white
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  // Warm up so the column is fully alight before capture.
  const dt = 1 / 30;
  for (let i = 0; i < 90; i++) step(dt);

  for (let f = 0; f < FRAMES; f++) {
    step(dt); draw();
    sctx.drawImage(frame, f * FW, 0);
  }
  return strip.toDataURL('image/png');
}, { FRAMES, FW, FH });

const png = Buffer.from(dataUrl.split(',')[1], 'base64');
writeFileSync(new URL('../src/themes/flame.png', import.meta.url), png);
console.log(`Baked ${FRAMES}-frame flame strip (${FW}×${FH}/frame) → src/themes/flame.png (${(png.length / 1024).toFixed(0)} KB)`);
process.exit(0);
