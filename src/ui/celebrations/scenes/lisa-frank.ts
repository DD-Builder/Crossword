/** Lisa Frank victory scenes (the kids skin): neon rainbow dolphins, slapping
 * stickers, and a galloping unicorn with a rainbow contrail. Joy to eleven. */

import type { Ctx2D, Scene } from '../types.ts';
import {
  ParticleSystem, TAU, clamp01, easeOutBack, lerp, withAlpha,
} from '../particles.ts';

// The skin is defined by its neon palette; these are intrinsic to it.
const RAINBOW = ['#ff3ba7', '#ff8a3d', '#ffe14d', '#5dff9f', '#3dd6ff', '#9b6bff'];

function star(ctx: Ctx2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    const a2 = a + TAU / 10;
    ctx.lineTo(x + Math.cos(a2) * r * 0.44, y + Math.sin(a2) * r * 0.44);
  }
  ctx.closePath();
  ctx.fill();
}

function rainbowRibbon(ctx: Ctx2D, pts: { x: number; y: number }[], width: number, alpha: number): void {
  RAINBOW.forEach((col, b) => {
    ctx.strokeStyle = withAlpha(col, alpha);
    ctx.lineWidth = width / RAINBOW.length;
    ctx.beginPath();
    const off = (b - RAINBOW.length / 2) * (width / RAINBOW.length);
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y + off) : ctx.moveTo(p.x, p.y + off)));
    ctx.stroke();
  });
}

/* --- 1. rainbow-dolphins ----------------------------------------------------- */

function makeRainbowDolphins(): Scene {
  let glitter: ParticleSystem;
  const trails: { x: number; y: number }[][] = [[], [], []];

  const dolphin = (ctx: Ctx2D, x: number, y: number, s: number, ang: number, col: string): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.quadraticCurveTo(0, -s * 0.7, s, -s * 0.2);
    ctx.quadraticCurveTo(s * 1.2, 0, s, s * 0.1);
    ctx.quadraticCurveTo(0, s * 0.4, -s, 0);
    ctx.closePath();
    ctx.fill();
    // dorsal fin
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.45);
    ctx.lineTo(s * 0.2, -s * 0.9);
    ctx.lineTo(s * 0.35, -s * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  return {
    id: 'lisa-frank/rainbow-dolphins',
    skin: 'lisa-frank',
    duration: 6.5,
    init(c) {
      glitter = new ParticleSystem(Math.round(140 * c.quality));
      trails.forEach((t) => (t.length = 0));
    },
    frame(c) {
      const { ctx } = c;
      for (let d = 0; d < 3; d++) {
        const phase = c.t * 1.1 - d * 0.7;
        const x = lerp(-80, c.w + 80, clamp01(phase / 4.2));
        const arc = Math.sin(clamp01(phase / 4.2) * Math.PI); // leap
        const y = c.h * 0.75 - arc * c.h * 0.5 - d * 20;
        const ang = Math.cos(clamp01(phase / 4.2) * Math.PI) * 0.9;
        const col = RAINBOW[d * 2]!;
        if (x > -60 && x < c.w + 60) {
          trails[d]!.unshift({ x, y });
          if (trails[d]!.length > 22) trails[d]!.pop();
          rainbowRibbon(ctx, trails[d]!, 22, 0.5);
          dolphin(ctx, x, y, 52 * c.unit, ang, col);
          if (c.rng.next() < 0.4) glitter.spawn({ x, y, vx: (c.rng.next() - 0.5) * 80, vy: (c.rng.next() - 0.5) * 80, life: 1, size: 4 + c.rng.next() * 5, seed: c.rng.next() });
        }
      }
      glitter.update(c.dt, c.t, { drag: 1 });
      glitter.each((pt) => star(ctx, pt.x, pt.y, pt.size * (1 - pt.age / pt.life), withAlpha(RAINBOW[Math.floor(pt.seed * 6)]!, 1 - pt.age / pt.life)));
    },
  };
}

/* --- 2. sticker-slap --------------------------------------------------------- */

function makeStickerSlap(): Scene {
  const KINDS = ['star', 'heart', 'rainbow', 'moon', 'bolt', 'peace'] as const;
  let slaps: { x: number; y: number; at: number; kind: number; size: number; rot: number; col: string }[] = [];
  let glitter: ParticleSystem;

  const shape = (ctx: Ctx2D, kind: number, r: number): void => {
    const k = KINDS[kind % KINDS.length];
    ctx.beginPath();
    if (k === 'heart') {
      ctx.moveTo(0, r * 0.3);
      ctx.bezierCurveTo(r, -r * 0.6, r * 0.5, -r, 0, -r * 0.4);
      ctx.bezierCurveTo(-r * 0.5, -r, -r, -r * 0.6, 0, r * 0.3);
    } else if (k === 'moon') {
      ctx.arc(0, 0, r, 0.4, TAU - 0.4);
      ctx.arc(r * 0.4, 0, r * 0.9, TAU - 0.7, 0.7, true);
    } else if (k === 'bolt') {
      ctx.moveTo(-r * 0.3, -r); ctx.lineTo(r * 0.3, -r * 0.1); ctx.lineTo(0, -r * 0.1);
      ctx.lineTo(r * 0.3, r); ctx.lineTo(-r * 0.3, r * 0.1); ctx.lineTo(0, r * 0.1);
    } else {
      ctx.arc(0, 0, r, 0, TAU);
    }
    ctx.closePath();
  };

  return {
    id: 'lisa-frank/sticker-slap',
    skin: 'lisa-frank',
    duration: 6.5,
    init(c) {
      glitter = new ParticleSystem(Math.round(120 * c.quality));
      slaps = Array.from({ length: 9 }, (_, i) => ({
        x: c.w * (0.2 + 0.6 * c.rng.next()),
        y: c.h * (0.2 + 0.6 * c.rng.next()),
        at: 0.2 + i * 0.5,
        kind: i,
        size: (34 + i * 5 + c.rng.next() * 12) * c.unit,
        rot: (c.rng.next() - 0.5) * 0.6,
        col: RAINBOW[i % RAINBOW.length]!,
      }));
    },
    frame(c) {
      const { ctx } = c;
      for (const s of slaps) {
        const k = easeOutBack(clamp01((c.t - s.at) / 0.4));
        if (k <= 0) continue;
        if (Math.abs(c.t - (s.at + 0.4)) < 0.05) {
          for (let i = 0; i < 8 * c.quality; i++) glitter.spawn({ x: s.x, y: s.y, vx: (c.rng.next() - 0.5) * 200, vy: (c.rng.next() - 0.5) * 200, life: 0.7, size: 3 + c.rng.next() * 3, seed: c.rng.next() });
        }
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.scale(k, k);
        // white sticker border
        ctx.fillStyle = '#fff';
        shape(ctx, s.kind, s.size * 1.18);
        ctx.fill();
        ctx.fillStyle = s.col;
        shape(ctx, s.kind, s.size);
        ctx.fill();
        // shine swipe
        ctx.fillStyle = withAlpha('#ffffff', 0.5);
        ctx.beginPath(); ctx.ellipse(-s.size * 0.3, -s.size * 0.35, s.size * 0.3, s.size * 0.12, -0.6, 0, TAU); ctx.fill();
        ctx.restore();
      }
      // final SOLVED! starburst banner
      const fin = clamp01((c.t - 5) / 0.6);
      if (fin > 0) {
        const cx = c.w / 2; const cy = c.h / 2;
        star(ctx, cx, cy, 120 * easeOutBack(fin), withAlpha('#ff3ba7', 0.9));
        star(ctx, cx, cy, 96 * easeOutBack(fin), withAlpha('#ffe14d', 0.95));
        ctx.fillStyle = '#7a1f5c';
        ctx.font = `900 ${Math.round(40 * fin)}px ${c.palette.fontDisplay}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('SOLVED!', cx, cy);
      }
      glitter.update(c.dt, c.t, { drag: 1.5 });
      glitter.each((pt) => star(ctx, pt.x, pt.y, pt.size, withAlpha(RAINBOW[Math.floor(pt.seed * 6)]!, 1 - pt.age / pt.life)));
    },
  };
}

/* --- 3. unicorn-dash --------------------------------------------------------- */

function makeUnicornDash(): Scene {
  let sparks: ParticleSystem;
  const trail: { x: number; y: number }[] = [];

  const unicorn = (ctx: Ctx2D, x: number, y: number, s: number, gallop: number): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#fff';
    // body
    ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.6, 0, 0, TAU); ctx.fill();
    // neck — a wedge sweeping up from the shoulder to the head
    ctx.beginPath();
    ctx.moveTo(s * 0.45, -s * 0.25);
    ctx.lineTo(s * 0.98, -s * 0.98);
    ctx.lineTo(s * 1.22, -s * 0.82);
    ctx.lineTo(s * 0.85, s * 0.05);
    ctx.closePath(); ctx.fill();
    // head — a rounded muzzle sitting on the neck (this is what was missing:
    // before, the horn attached straight to the bare neck top).
    ctx.beginPath();
    ctx.ellipse(s * 1.32, -s * 0.9, s * 0.44, s * 0.28, -0.45, 0, TAU);
    ctx.fill();
    // ear
    ctx.beginPath();
    ctx.moveTo(s * 1.04, -s * 1.04);
    ctx.lineTo(s * 1.14, -s * 1.34);
    ctx.lineTo(s * 1.26, -s * 1.02);
    ctx.closePath(); ctx.fill();
    // eye + nostril
    ctx.fillStyle = '#5b3a70';
    ctx.beginPath(); ctx.arc(s * 1.34, -s * 0.98, s * 0.07, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 1.66, -s * 0.74, s * 0.04, 0, TAU); ctx.fill();
    // horn — rises from the forehead, above the eye
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.moveTo(s * 1.26, -s * 1.12);
    ctx.lineTo(s * 1.46, -s * 1.72);
    ctx.lineTo(s * 1.44, -s * 1.06);
    ctx.closePath(); ctx.fill();
    // mane (rainbow strips)
    RAINBOW.forEach((col, i) => {
      ctx.strokeStyle = col; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(s * 0.6 - i * 3, -s * 0.5);
      ctx.quadraticCurveTo(s * 0.2 - i * 4, -s * 0.2 + Math.sin(gallop + i) * 4, s * 0.1 - i * 5, s * 0.3);
      ctx.stroke();
    });
    // legs (gallop)
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let l = 0; l < 4; l++) {
      const lx = -s * 0.5 + (l % 2) * s * 0.9;
      const ph = gallop + l * 1.6;
      ctx.beginPath();
      ctx.moveTo(lx, s * 0.4);
      ctx.lineTo(lx + Math.cos(ph) * s * 0.4, s * 0.9 + Math.abs(Math.sin(ph)) * s * 0.2);
      ctx.stroke();
    }
    ctx.restore();
  };

  return {
    id: 'lisa-frank/unicorn-dash',
    skin: 'lisa-frank',
    duration: 6.5,
    init(c) { sparks = new ParticleSystem(Math.round(120 * c.quality)); trail.length = 0; },
    frame(c) {
      const { ctx } = c;
      const prog = clamp01(c.t / 5);
      const x = lerp(-100, c.w + 100, prog);
      const jump = Math.max(0, Math.sin((prog - 0.45) * Math.PI * 3)) * (prog > 0.4 && prog < 0.72 ? 1 : 0);
      const y = c.h * 0.68 - jump * c.h * 0.28 + Math.sin(c.t * 12) * 4;
      const gallop = c.t * 14;

      const s = 58 * c.unit;
      trail.unshift({ x: x - 40, y: y + 10 });
      if (trail.length > 26) trail.pop();
      rainbowRibbon(ctx, trail, s * 1.1, 0.55 * (1 - prog * 0.3));

      if (x > -80 && x < c.w + 80) {
        unicorn(ctx, x, y, s, gallop);
        // hoof sparks
        if (jump < 0.1 && c.rng.next() < 0.5) sparks.spawn({ x: x - 20, y: y + 34, vx: -60 - c.rng.next() * 60, vy: -c.rng.next() * 60, life: 0.8, size: 5 + c.rng.next() * 4, seed: c.rng.next() });
      }
      // stars & hearts rain in the wake
      if (c.rng.next() < 0.5) sparks.spawn({ x: x - 60 - c.rng.next() * 80, y: y - 40 + c.rng.next() * 80, vx: -20, vy: 20 + c.rng.next() * 30, life: 1.4, size: 6 + c.rng.next() * 6, seed: c.rng.next() });

      sparks.update(c.dt, c.t, { drag: 0.6, gravity: 40 });
      sparks.each((pt) => star(ctx, pt.x, pt.y, pt.size * (1 - pt.age / pt.life * 0.5), withAlpha(RAINBOW[Math.floor(pt.seed * 6)]!, 1 - pt.age / pt.life)));
    },
  };
}

export const lisaFrankScenes: Scene[] = [makeRainbowDolphins(), makeStickerSlap(), makeUnicornDash()];
