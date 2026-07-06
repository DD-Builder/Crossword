/** Midnight victory scenes: aurora, constellation, meteor-shower.
 * Hushed deep-sky light shows keyed to the skin's indigo accent; every
 * scene floats over its own twinkling starfield. */

import type { Scene, SceneContext } from '../types.ts';
import {
  ParticleSystem, TAU, clamp01, easeOutCubic, easeOutQuint, lerp, mixColor,
  withAlpha, wobble,
} from '../particles.ts';

/* --- shared starfield --------------------------------------------------------
 * Static positions, staggered alpha pulses. Ink-dot stars on light mode so
 * the night sky still reads on moonlit paper. */

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

function seedStars(c: SceneContext, n: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < n; i++) {
    stars.push({
      x: c.rng.next() * c.w,
      y: c.rng.next() * c.h,
      r: 0.5 + c.rng.next() * 1.5,
      phase: c.rng.next() * TAU,
      speed: 0.5 + c.rng.next() * 2.5,
    });
  }
  return stars;
}

function drawStars(c: SceneContext, stars: Star[], base: number): void {
  const { ctx, palette: p } = c;
  ctx.fillStyle = p.dark ? '#ffffff' : p.ink;
  const fade = clamp01(c.t * 0.8);
  for (const s of stars) {
    const tw = 0.5 + 0.5 * Math.sin(c.t * s.speed + s.phase);
    ctx.globalAlpha = fade * base * (0.25 + 0.75 * tw);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* --- 1. aurora ----------------------------------------------------------------
 * Layered borealis curtains: warped gradient ribbons that breathe and sway,
 * hue drifting between the skin's indigo and green, with a bright shimmer
 * running the length of one curtain every few seconds. */

interface Curtain {
  yTop: number;
  height: number;
  amp: number;
  freq: number;
  speed: number;
  phase: number;
  hueSpeed: number;
}

function curtainTop(cu: Curtain, fx: number, t: number): number {
  return cu.yTop +
    Math.sin(fx * cu.freq + t * cu.speed + cu.phase) * cu.amp +
    wobble(cu.phase + fx * 3.1, t * 0.4) * cu.amp * 0.4;
}

function makeAurora(): Scene {
  let stars: Star[] = [];
  let curtains: Curtain[] = [];

  return {
    id: 'midnight/aurora',
    skin: 'midnight',
    duration: 8,
    init(c) {
      stars = seedStars(c, Math.round(170 * c.quality));
      curtains = [];
      for (let i = 0; i < 4; i++) {
        curtains.push({
          yTop: c.h * (0.08 + i * 0.09 + c.rng.next() * 0.05),
          height: c.h * (0.22 + c.rng.next() * 0.16),
          amp: c.h * (0.03 + c.rng.next() * 0.05),
          freq: 2.5 + c.rng.next() * 3.5,
          speed: 0.25 + c.rng.next() * 0.35,
          phase: c.rng.next() * TAU,
          hueSpeed: 0.18 + c.rng.next() * 0.2,
        });
      }
    },
    frame(c) {
      const { ctx, palette: p } = c;
      // Whisper of a night wash — the app stays visible beneath.
      ctx.fillStyle = withAlpha(p.accent, p.dark ? 0.07 : 0.04);
      ctx.fillRect(0, 0, c.w, c.h);

      drawStars(c, stars, p.dark ? 0.9 : 0.55);

      const entry = clamp01(c.t / 1.4);
      if (p.dark) ctx.globalCompositeOperation = 'lighter';
      const SAMP = 44;
      for (const cu of curtains) {
        const breathe = 0.8 + 0.2 * Math.sin(c.t * 0.45 + cu.phase * 2);
        const col = mixColor(p.accent, p.good, 0.5 + 0.5 * Math.sin(c.t * cu.hueSpeed + cu.phase));
        const peak = (p.dark ? 0.38 : 0.2) * entry * breathe;
        const grad = ctx.createLinearGradient(0, cu.yTop - cu.amp, 0, cu.yTop + cu.height + cu.amp);
        grad.addColorStop(0, withAlpha(col, peak));
        grad.addColorStop(0.55, withAlpha(col, peak * 0.35));
        grad.addColorStop(1, withAlpha(col, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        for (let s = 0; s <= SAMP; s++) {
          const fx = s / SAMP;
          const y = curtainTop(cu, fx, c.t);
          if (s === 0) ctx.moveTo(0, y);
          else ctx.lineTo(fx * c.w, y);
        }
        for (let s = SAMP; s >= 0; s--) {
          const fx = s / SAMP;
          const y = curtainTop(cu, fx, c.t) +
            cu.height * (0.72 + 0.28 * Math.sin(fx * cu.freq * 0.6 - c.t * cu.speed * 0.8 + cu.phase * 2));
          ctx.lineTo(fx * c.w, y);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // A bright shimmer runs along one curtain every few seconds.
      const CYCLE = 3.1;
      const f = (c.t % CYCLE) / CYCLE;
      if (f < 0.6 && c.t > 1.2) {
        const cu = curtains[Math.floor(c.t / CYCLE) % curtains.length]!;
        const fx = f / 0.6;
        c.drawGlow(
          fx * c.w,
          curtainTop(cu, fx, c.t) + cu.height * 0.16,
          64,
          mixColor(p.accent, '#ffffff', 0.6),
          0.55 * Math.sin(Math.PI * fx),
        );
      }
    },
  };
}

/* --- 2. constellation -----------------------------------------------------------
 * Nine stars streak in from the screen edges, settle into a 3×3 lattice, then
 * glowing lines join them one by one into a crossword-grid constellation with
 * a star-burst at each landing and a slow zodiac ring around the whole. */

const GRID_LINKS: ReadonlyArray<readonly [number, number]> = [
  [3, 4], [4, 5], [1, 4], [4, 7], [0, 1], [1, 2],
  [6, 7], [7, 8], [0, 3], [3, 6], [2, 5], [5, 8],
];

interface CStar {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t0: number;
}

function makeConstellation(): Scene {
  let stars: Star[] = [];
  let lattice: CStar[] = [];
  let sp = 0;
  const FLY = 1.1;
  const LINK0 = 2.6;
  const STAGGER = 0.18;
  const DRAW = 0.3;

  return {
    id: 'midnight/constellation',
    skin: 'midnight',
    duration: 7.5,
    init(c) {
      stars = seedStars(c, Math.round(80 * c.quality));
      const cx = c.gridRect ? c.gridRect.x + c.gridRect.w / 2 : c.w / 2;
      const cy = c.gridRect ? c.gridRect.y + c.gridRect.h / 2 : c.h * 0.45;
      sp = Math.min(c.w, c.h) * 0.11;
      const order = c.rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]);
      lattice = [];
      for (let i = 0; i < 9; i++) {
        const edge = c.rng.int(4);
        const f = c.rng.next();
        lattice.push({
          sx: edge === 0 ? -30 : edge === 1 ? c.w + 30 : f * c.w,
          sy: edge === 2 ? -30 : edge === 3 ? c.h + 30 : f * c.h,
          tx: cx + ((i % 3) - 1) * sp,
          ty: cy + (Math.floor(i / 3) - 1) * sp,
          t0: 0.3 + order.indexOf(i) * 0.13,
        });
      }
    },
    frame(c) {
      const { ctx, palette: p } = c;
      drawStars(c, stars, p.dark ? 0.7 : 0.45);
      const bright = p.dark ? '#ffffff' : p.ink;
      ctx.lineCap = 'round';

      // Stars streak in (easeOutQuint deceleration), then twinkle in place.
      for (let i = 0; i < lattice.length; i++) {
        const s = lattice[i]!;
        const k = clamp01((c.t - s.t0) / FLY);
        if (k <= 0) continue;
        const e = easeOutQuint(k);
        const x = lerp(s.sx, s.tx, e);
        const y = lerp(s.sy, s.ty, e);
        if (k < 1) {
          const et = easeOutQuint(clamp01(k - 0.08));
          ctx.strokeStyle = withAlpha(p.accent, 0.7 * (1 - k * 0.5));
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(lerp(s.sx, s.tx, et), lerp(s.sy, s.ty, et));
          ctx.lineTo(x, y);
          ctx.stroke();
          c.drawGlow(x, y, 16, p.accent, 0.9);
        } else {
          const tw = 0.65 + 0.35 * Math.sin(c.t * 2.6 + i * 1.7);
          c.drawGlow(x, y, 13, p.accent, 0.55 * tw);
          ctx.fillStyle = withAlpha(bright, 0.95 * tw);
          ctx.beginPath();
          ctx.arc(x, y, 2.4, 0, TAU);
          ctx.fill();
        }
      }

      // Connect the lattice one glowing line at a time.
      for (let li = 0; li < GRID_LINKS.length; li++) {
        const [ai, bi] = GRID_LINKS[li]!;
        const a = lattice[ai]!;
        const b = lattice[bi]!;
        const t0 = LINK0 + li * STAGGER;
        const k = clamp01((c.t - t0) / DRAW);
        if (k <= 0) continue;
        const e = easeOutCubic(k);
        const ex = lerp(a.tx, b.tx, e);
        const ey = lerp(a.ty, b.ty, e);
        ctx.strokeStyle = withAlpha(p.accent, 0.22);
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(a.tx, a.ty);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.strokeStyle = withAlpha(bright, 0.6);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(a.tx, a.ty);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        if (k < 1) {
          c.drawGlow(ex, ey, 18, p.accent, 0.9);
        } else {
          // Star-burst where the line lands.
          const u = clamp01((c.t - t0 - DRAW) / 0.5);
          if (u < 1) {
            const fs = (1 - u) * 11;
            ctx.strokeStyle = withAlpha(bright, (1 - u) * 0.9);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(b.tx - fs, b.ty);
            ctx.lineTo(b.tx + fs, b.ty);
            ctx.moveTo(b.tx, b.ty - fs);
            ctx.lineTo(b.tx, b.ty + fs);
            ctx.stroke();
            c.drawGlow(b.tx, b.ty, 22 * (1 - u) + 6, p.accent, 1 - u);
          }
        }
      }

      // Faint zodiac ring rotating around the finished constellation.
      const hub = lattice[4]!;
      const rk = clamp01((c.t - (LINK0 + GRID_LINKS.length * STAGGER + DRAW)) / 1);
      if (rk > 0) {
        const R = sp * 2.35;
        const alpha = 0.3 * easeOutCubic(rk) * (0.75 + 0.25 * Math.sin(c.t * 1.3));
        ctx.strokeStyle = withAlpha(p.accent, alpha);
        ctx.lineWidth = 1.2;
        const SEG = 24;
        for (let s = 0; s < SEG; s++) {
          const a0 = (s / SEG) * TAU + c.t * 0.12;
          ctx.beginPath();
          ctx.arc(hub.tx, hub.ty, R, a0, a0 + (TAU / SEG) * 0.55);
          ctx.stroke();
        }
        // Four counter-rotating diamond marks.
        ctx.fillStyle = withAlpha(p.accent, alpha * 1.4);
        for (let d = 0; d < 4; d++) {
          const a = -c.t * 0.1 + (d / 4) * TAU;
          ctx.save();
          ctx.translate(hub.tx + Math.cos(a) * R * 1.12, hub.ty + Math.sin(a) * R * 1.12);
          ctx.rotate(a);
          ctx.beginPath();
          ctx.moveTo(0, -4);
          ctx.lineTo(3, 0);
          ctx.lineTo(0, 4);
          ctx.lineTo(-3, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
    },
  };
}

/* --- 3. meteor-shower -------------------------------------------------------------
 * Diagonal meteors on three parallax layers (slow/dim/small behind, fast/
 * bright/large in front), long glowing tails, stardust bursts where they
 * strike the lower third — and one huge finale meteor across the whole sky. */

function makeMeteorShower(): Scene {
  let stars: Star[] = [];
  let meteors: ParticleSystem;
  let dust: ParticleSystem;
  let acc0 = 0;
  let acc1 = 0;
  let acc2 = 0;
  let finaleFired = false;
  let flashT = -1;
  let flashX = 0;
  let flashY = 0;
  const DUR = 7;
  const L_SPEED = [190, 330, 560] as const;
  const L_SIZE = [1.1, 1.9, 3] as const;
  const L_ALPHA = [0.4, 0.65, 1] as const;

  const spawnMeteor = (c: SceneContext, layer: number, big = false): void => {
    const sp = big
      ? Math.hypot(c.w, c.h) * 0.55
      : L_SPEED[layer]! * (0.85 + c.rng.next() * 0.3);
    const ang = 0.95 + (c.rng.next() - 0.5) * 0.2; // below horizontal, leftward
    meteors.spawn({
      x: big ? c.w * 1.02 : c.w * (0.15 + c.rng.next() * 1.1),
      y: -30,
      vx: -Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      life: 30, // dies on impact, never of old age
      size: big ? 5 : L_SIZE[layer]!,
      alpha: big ? 1 : L_ALPHA[layer]!,
      seed: layer + (big ? 0.4 : 0.15 + c.rng.next() * 0.8),
    });
  };

  return {
    id: 'midnight/meteor-shower',
    skin: 'midnight',
    duration: DUR,
    init(c) {
      stars = seedStars(c, Math.round(120 * c.quality));
      meteors = new ParticleSystem(30);
      dust = new ParticleSystem(Math.max(80, Math.round(220 * c.quality)));
      acc0 = acc1 = acc2 = 0;
      finaleFired = false;
      flashT = -1;
    },
    frame(c) {
      const { ctx, palette: p } = c;
      drawStars(c, stars, p.dark ? 0.75 : 0.5);
      const head = mixColor(p.accent, p.dark ? '#ffffff' : p.ink, 0.45);

      if (c.t < DUR - 1.6) {
        acc0 += c.dt * 1.7 * c.quality;
        acc1 += c.dt * 1.15 * c.quality;
        acc2 += c.dt * 0.65 * c.quality;
        while (acc0 >= 1) { acc0 -= 1; spawnMeteor(c, 0); }
        while (acc1 >= 1) { acc1 -= 1; spawnMeteor(c, 1); }
        while (acc2 >= 1) { acc2 -= 1; spawnMeteor(c, 2); }
      }
      if (!finaleFired && c.t >= DUR * 0.6) {
        finaleFired = true;
        spawnMeteor(c, 2, true);
      }

      // Impacts near the lower third burst into stardust.
      meteors.update(c.dt, c.t, {
        update(pt) {
          const frac = pt.seed - Math.floor(pt.seed);
          const iy = c.h * (0.6 + frac * 0.35);
          if (pt.y < iy) return;
          pt.dead = true;
          const big = pt.size > 4;
          if (big) {
            flashT = c.t;
            flashX = pt.x;
            flashY = iy;
          }
          const n = Math.round((big ? 26 : 5 + pt.size * 3) * c.quality);
          for (let i = 0; i < n; i++) {
            const a = c.rng.next() * TAU;
            const v = 30 + c.rng.next() * (big ? 260 : 130);
            dust.spawn({
              x: pt.x,
              y: iy,
              vx: Math.cos(a) * v,
              vy: -Math.abs(Math.sin(a)) * v,
              life: 0.5 + c.rng.next() * 0.7,
              size: 0.8 + c.rng.next() * 1.8,
              color: mixColor(p.accent, '#ffffff', c.rng.next() * 0.7),
              seed: c.rng.next(),
            });
          }
        },
      });

      dust.update(c.dt, c.t, { gravity: 60, drag: 1.4 });
      dust.each((pt) => {
        ctx.globalAlpha = (1 - pt.age / pt.life) * 0.9;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Meteors: fading straight tail segments + glow-sprite head.
      ctx.lineCap = 'round';
      meteors.each((pt) => {
        const tail = 0.09 + Math.floor(pt.seed) * 0.05; // deeper layers trail longer
        const SEGS = 6;
        for (let s = 0; s < SEGS; s++) {
          const q0 = (s / SEGS) * tail;
          const q1 = ((s + 1) / SEGS) * tail;
          ctx.strokeStyle = withAlpha(head, pt.alpha * 0.75 * (1 - s / SEGS));
          ctx.lineWidth = pt.size * (1 - (s / SEGS) * 0.7);
          ctx.beginPath();
          ctx.moveTo(pt.x - pt.vx * q0, pt.y - pt.vy * q0);
          ctx.lineTo(pt.x - pt.vx * q1, pt.y - pt.vy * q1);
          ctx.stroke();
        }
        c.drawGlow(pt.x, pt.y, pt.size * 9, p.accent, pt.alpha * 0.8);
        ctx.fillStyle = withAlpha(head, pt.alpha);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * 0.9, 0, TAU);
        ctx.fill();
      });

      // Screen-wide flash where the finale meteor strikes.
      if (flashT >= 0) {
        const u = (c.t - flashT) / 0.7;
        if (u >= 0 && u < 1) {
          c.drawGlow(flashX, flashY, 120 + u * 160, mixColor(p.accent, '#ffffff', 0.5), (1 - u) * 0.9);
        }
      }
    },
  };
}

export const midnightScenes: Scene[] = [makeAurora(), makeConstellation(), makeMeteorShower()];
