/** Hearth (winter holiday) victory scenes: snow-frost, ember-sparks,
 * string-lights. Firelight, frost ferns, and pine garlands — slow, warm
 * spectacles that let the season glow without shouting. */

import type { Scene, SceneContext } from '../types.ts';
import {
  ParticleSystem, TAU, clamp01, easeOutBack, easeOutBounce, easeOutCubic,
  flow, lerp, mixColor, withAlpha, wobble,
} from '../particles.ts';

/* --- shared snowfall ----------------------------------------------------------
 * Every flake is a pure function of (seed, t): three parallax layers of drift
 * with zero per-frame state, wrapped around the viewport. */

interface Flake {
  x0: number;
  y0: number;
  speed: number;
  size: number;
  sway: number;
  seed: number;
  alpha: number;
}

const LAYER_SPEED = [26, 46, 76] as const;
const LAYER_SIZE = [1.05, 1.7, 2.6] as const;
const LAYER_ALPHA = [0.3, 0.5, 0.8] as const;

function seedFlakes(c: SceneContext, n: number, layer: number): Flake[] {
  const flakes: Flake[] = [];
  for (let i = 0; i < n; i++) {
    flakes.push({
      x0: c.rng.next() * c.w,
      y0: c.rng.next() * c.h,
      speed: LAYER_SPEED[layer]! * (0.8 + c.rng.next() * 0.4),
      size: LAYER_SIZE[layer]! * (0.75 + c.rng.next() * 0.5),
      sway: 8 + layer * 9 + c.rng.next() * 8,
      seed: c.rng.next() * 100,
      alpha: LAYER_ALPHA[layer]!,
    });
  }
  return flakes;
}

function drawFlakes(c: SceneContext, flakes: Flake[], dim = 1): void {
  const { ctx, palette: p } = c;
  const tint = p.dark ? '#ffffff' : p.inkMuted;
  const fade = clamp01(c.t * 0.7) * dim;
  const wrapW = c.w + 24;
  const wrapH = c.h + 24;
  for (const f of flakes) {
    const y = ((f.y0 + c.t * f.speed) % wrapH) - 12;
    const drift = f.x0 + c.t * 8 + wobble(f.seed, c.t * 0.5) * f.sway;
    const x = (((drift % wrapW) + wrapW) % wrapW) - 12;
    ctx.globalAlpha = fade * f.alpha;
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.arc(x, y, f.size, 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* --- 1. snow-frost -------------------------------------------------------------
 * Gentle three-layer snowfall while frost ferns crystallize inward from the
 * four corners — recursive branching strokes growing tip by tip with sparkle
 * glints — over a softly pulsing window glow; snow banks up in a sill line. */

interface FernSeg {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t0: number;
  dur: number;
  w: number;
  seed: number;
}

function growFern(
  c: SceneContext, out: FernSeg[], cap: number,
  x: number, y: number, ang: number, len: number,
  depth: number, t0: number, w: number,
): void {
  if (depth <= 0 || len < 3 || out.length >= cap) return;
  let px = x;
  let py = y;
  let pa = ang;
  let pt = t0;
  for (let s = 0; s < 3 && out.length < cap; s++) {
    const dur = 0.2 + c.rng.next() * 0.14;
    const nx = px + Math.cos(pa) * len;
    const ny = py + Math.sin(pa) * len;
    out.push({ x0: px, y0: py, x1: nx, y1: ny, t0: pt, dur, w, seed: c.rng.next() });
    pt += dur * 0.8;
    // Side branchlets sprout as the stem passes each node.
    growFern(c, out, cap, nx, ny, pa + 0.6 + c.rng.next() * 0.3, len * 0.52, depth - 1, pt, w * 0.72);
    growFern(c, out, cap, nx, ny, pa - 0.6 - c.rng.next() * 0.3, len * 0.52, depth - 1, pt + 0.07, w * 0.72);
    px = nx;
    py = ny;
    pa += (c.rng.next() - 0.5) * 0.36;
    len *= 0.8;
  }
}

function makeSnowFrost(): Scene {
  let layers: Flake[][] = [];
  let ferns: FernSeg[] = [];

  return {
    id: 'hearth/snow-frost',
    skin: 'hearth',
    duration: 8,
    init(c) {
      layers = [0, 1, 2].map((l) => seedFlakes(c, Math.round([40, 56, 72][l]! * c.quality), l));
      ferns = [];
      const len = Math.min(c.w, c.h) * 0.14;
      const corners = [
        { x: 0, y: 0, a: 0.9 },
        { x: c.w, y: 0, a: Math.PI - 0.9 },
        { x: c.w, y: c.h, a: Math.PI + 0.9 },
        { x: 0, y: c.h, a: -0.9 },
      ];
      for (let i = 0; i < corners.length; i++) {
        const k = corners[i]!;
        const cap = (i + 1) * 110;
        const t0 = 0.3 + i * 0.35;
        growFern(c, ferns, cap, k.x, k.y, k.a + (c.rng.next() - 0.5) * 0.2, len, 3, t0, 2.2);
        growFern(c, ferns, cap, k.x, k.y, k.a + (c.rng.next() < 0.5 ? 0.55 : -0.55), len * 0.72, 3, t0 + 0.25, 1.8);
      }
    },
    frame(c) {
      const { ctx, palette: p } = c;

      // Warm window glow pulsing from center-bottom, behind everything.
      const pulse = 0.85 + 0.15 * Math.sin(c.t * 0.9) + wobble(3, c.t) * 0.04;
      const warm = mixColor(p.warn, p.accent, 0.4);
      const entry = clamp01(c.t / 1.5);
      const wash = ctx.createLinearGradient(0, c.h * 0.5, 0, c.h);
      wash.addColorStop(0, withAlpha(warm, 0));
      wash.addColorStop(1, withAlpha(warm, (p.dark ? 0.18 : 0.1) * pulse * entry));
      ctx.fillStyle = wash;
      ctx.fillRect(0, c.h * 0.5, c.w, c.h * 0.5);
      c.drawGlow(c.w / 2, c.h * 1.02, Math.min(c.w, c.h) * 0.6, warm, (p.dark ? 0.5 : 0.3) * pulse * entry);

      // Far snow behind the frost, near layers in front for depth.
      drawFlakes(c, layers[0]!);
      drawFlakes(c, layers[1]!);

      // Frost ferns crystallize tip by tip.
      const frost = mixColor(p.ink, '#ffffff', p.dark ? 0.9 : 0.25);
      const glint = p.dark ? '#ffffff' : p.inkMuted;
      const aBase = p.dark ? 0.8 : 0.55;
      ctx.lineCap = 'round';
      for (const s of ferns) {
        const k = clamp01((c.t - s.t0) / s.dur);
        if (k <= 0) continue;
        const ex = lerp(s.x0, s.x1, k);
        const ey = lerp(s.y0, s.y1, k);
        ctx.strokeStyle = withAlpha(frost, aBase * (0.55 + 0.45 * s.seed));
        ctx.lineWidth = s.w;
        ctx.beginPath();
        ctx.moveTo(s.x0, s.y0);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        if (k < 1) {
          // The growing tip carries a cold spark.
          c.drawGlow(ex, ey, 7, glint, 0.7);
        } else {
          const tw = wobble(s.seed * 53, c.t);
          if (tw > 0.82) {
            const a = (tw - 0.82) / 0.18;
            const fs = 3.5;
            ctx.strokeStyle = withAlpha(glint, a * 0.9);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(s.x1 - fs, s.y1);
            ctx.lineTo(s.x1 + fs, s.y1);
            ctx.moveTo(s.x1, s.y1 - fs);
            ctx.lineTo(s.x1, s.y1 + fs);
            ctx.stroke();
            c.drawGlow(s.x1, s.y1, 10, glint, a * 0.5);
          }
        }
      }

      drawFlakes(c, layers[2]!);

      // Snow banks up along the sill.
      const sk = easeOutCubic(clamp01((c.t - 1.2) / 5.5));
      if (sk > 0) {
        const hMax = c.h * 0.05 * sk;
        const snowFill = p.dark ? mixColor(p.ink, '#ffffff', 0.75) : '#ffffff';
        const N = 28;
        ctx.fillStyle = withAlpha(snowFill, 0.92);
        ctx.beginPath();
        ctx.moveTo(0, c.h);
        for (let i = 0; i <= N; i++) {
          const fx = i / N;
          ctx.lineTo(fx * c.w, c.h - hMax * (0.72 + 0.28 * wobble(fx * 9.7, 1.3)));
        }
        ctx.lineTo(c.w, c.h);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = withAlpha(p.inkMuted, 0.3 * sk);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const fx = i / N;
          const y = c.h - hMax * (0.72 + 0.28 * wobble(fx * 9.7, 1.3));
          if (i === 0) ctx.moveTo(0, y);
          else ctx.lineTo(fx * c.w, y);
        }
        ctx.stroke();
      }
    },
  };
}

/* --- 2. ember-sparks -------------------------------------------------------------
 * A hearth glow at bottom center breathes while embers ride convection curls
 * upward, each one cooling warn → bad → ink as it climbs; occasional crackle
 * bursts scatter quick sparks, and a garland silhouette across the top
 * catches faint firelight. Cozy, slow pacing. */

function makeEmberSparks(): Scene {
  let embers: ParticleSystem;
  let sparks: ParticleSystem;
  let acc = 0;
  let crackleAt = 0;
  let lastCrackle = -10;
  const DUR = 8;

  const drawGarland = (c: SceneContext, pulse: number, warm: string): void => {
    const { ctx, palette: p } = c;
    const entry = easeOutCubic(clamp01((c.t - 0.3) / 1.2));
    if (entry <= 0) return;
    const gcol = mixColor(p.good, p.ink, p.dark ? 0.35 : 0.2);
    const swags: ReadonlyArray<readonly [number, number]> = [
      [-c.w * 0.02, c.w * 0.52],
      [c.w * 0.48, c.w * 1.02],
    ];
    ctx.lineCap = 'round';
    for (const [x0, x1] of swags) {
      const dip = (f: number): number =>
        c.h * 0.015 + c.h * 0.11 * 4 * f * (1 - f) + wobble(f * 5 + x0, c.t * 0.3) * 2.5;
      for (let s = 0; s < 3; s++) {
        ctx.strokeStyle = withAlpha(gcol, (0.45 + s * 0.15) * entry);
        ctx.lineWidth = 7 - s * 2;
        ctx.beginPath();
        for (let i = 0; i <= 20; i++) {
          const f = i / 20;
          const x = lerp(x0, x1, f);
          const y = dip(f) + s * 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // Berries catching the fire's light from below.
      for (let f = 0.12; f < 0.95; f += 0.155) {
        const x = lerp(x0, x1, f);
        const y = dip(f) + 5;
        ctx.fillStyle = withAlpha(p.accent, 0.9 * entry);
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, TAU);
        ctx.fill();
        c.drawGlow(x, y, 10, warm, 0.14 * pulse * entry);
      }
    }
  };

  return {
    id: 'hearth/ember-sparks',
    skin: 'hearth',
    duration: DUR,
    init(c) {
      embers = new ParticleSystem(Math.round(160 * c.quality));
      sparks = new ParticleSystem(48);
      acc = 0;
      crackleAt = 1.2 + c.rng.next();
      lastCrackle = -10;
    },
    frame(c) {
      const { ctx, palette: p } = c;
      const pulse = 0.82 + 0.18 * Math.sin(c.t * 0.8) + wobble(7, c.t * 1.3) * 0.06;
      const crackleGlow = Math.max(0, 1 - (c.t - lastCrackle) * 2.5);
      const warm = mixColor(p.warn, p.accent, 0.35);
      const hot = mixColor(p.warn, '#ffffff', 0.3);
      const hx = c.w / 2;
      const hy = c.h * 0.99;

      // Hearth wash + layered glow at bottom center.
      const wash = ctx.createLinearGradient(0, c.h * 0.55, 0, c.h);
      wash.addColorStop(0, withAlpha(warm, 0));
      wash.addColorStop(1, withAlpha(warm, (p.dark ? 0.2 : 0.12) * pulse));
      ctx.fillStyle = wash;
      ctx.fillRect(0, c.h * 0.55, c.w, c.h * 0.45);
      c.drawGlow(hx, hy, Math.min(c.w, c.h) * 0.55, warm, (p.dark ? 0.55 : 0.32) * pulse + crackleGlow * 0.2);
      c.drawGlow(hx, hy, Math.min(c.w, c.h) * 0.24, hot, (p.dark ? 0.5 : 0.3) * pulse + crackleGlow * 0.3);

      drawGarland(c, pulse, warm);

      // Steady convection of embers while the scene runs.
      if (c.t < DUR - 1.2) {
        acc += c.dt * 15 * c.quality;
        while (acc >= 1) {
          acc -= 1;
          embers.spawn({
            x: hx + (c.rng.next() + c.rng.next() - 1) * c.w * 0.16,
            y: c.h * (0.99 + c.rng.next() * 0.03),
            vx: (c.rng.next() - 0.5) * 30,
            vy: -20 - c.rng.next() * 45,
            life: 2.2 + c.rng.next() * 2.2,
            size: 1.2 + c.rng.next() * 2,
            seed: c.rng.next(),
          });
        }
      }

      // Crackle! A few sparks scatter fast and die young.
      if (c.t >= crackleAt) {
        lastCrackle = c.t;
        crackleAt = c.t + 0.7 + c.rng.next() * 1.1;
        const n = 3 + c.rng.int(3);
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (c.rng.next() - 0.5) * 1.8;
          const v = 180 + c.rng.next() * 260;
          sparks.spawn({
            x: hx + (c.rng.next() - 0.5) * c.w * 0.1,
            y: hy - 8,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            life: 0.35 + c.rng.next() * 0.35,
            size: 1 + c.rng.next() * 1.5,
            seed: c.rng.next(),
          });
        }
      }

      embers.update(c.dt, c.t, {
        drag: 0.35,
        update(pt, dt) {
          const [fx, fy] = flow(pt.x, pt.y, c.t, 0.005);
          pt.vx += fx * 26 * dt;
          pt.vy += (fy * 10 - 42) * dt; // convection curl + buoyancy
        },
      });
      embers.each((pt) => {
        const u = pt.age / pt.life;
        const col = u < 0.45
          ? mixColor(hot, p.bad, u / 0.45)
          : mixColor(p.bad, p.ink, (u - 0.45) / 0.55);
        const flick = 0.7 + 0.3 * Math.sin(c.t * 9 + pt.seed * 40);
        const a = (1 - u) * flick;
        c.drawGlow(pt.x, pt.y, pt.size * 5, col, a * 0.7);
        ctx.fillStyle = withAlpha(col, a);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * (1 - u * 0.5), 0, TAU);
        ctx.fill();
      });

      sparks.update(c.dt, c.t, { gravity: 320, drag: 1.2 });
      ctx.lineCap = 'round';
      sparks.each((pt) => {
        const a = 1 - pt.age / pt.life;
        ctx.strokeStyle = withAlpha(hot, a);
        ctx.lineWidth = pt.size;
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineTo(pt.x - pt.vx * 0.03, pt.y - pt.vy * 0.03);
        ctx.stroke();
      });
    },
  };
}

/* --- 3. string-lights -------------------------------------------------------------
 * Two sagging strings of teardrop bulbs bounce in from above, twinkle alight
 * left to right with warm bokeh halos — one bulb flickers comically before
 * joining — then everything settles into a synchronized breathing glow while
 * snow dusts down. */

interface Bulb {
  f: number;
  onT: number;
  color: string;
  flicker: boolean;
  seed: number;
}

interface LString {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  sag: number;
  delay: number;
  bulbs: Bulb[];
}

function makeStringLights(): Scene {
  let strings: LString[] = [];
  let dust: Flake[] = [];
  let allLit = 5;
  const DUR = 8;

  const stringPoint = (c: SceneContext, s: LString, f: number): [number, number] => {
    const drop = easeOutBounce(clamp01((c.t - s.delay) / 1.3));
    const dy = lerp(-c.h * 0.45, 0, drop);
    const sway = Math.sin(c.t * 0.8 + s.delay * 7) * 6 * (1 - 0.7 * clamp01((c.t - 2) / 3));
    return [
      lerp(s.ax, s.bx, f),
      lerp(s.ay, s.by, f) + s.sag * 4 * f * (1 - f) + dy + sway * Math.sin(f * Math.PI),
    ];
  };

  return {
    id: 'hearth/string-lights',
    skin: 'hearth',
    duration: DUR,
    init(c) {
      dust = seedFlakes(c, Math.round(48 * c.quality), 1);
      const colorAt = (i: number): string =>
        [c.palette.accent, c.palette.good, c.palette.warn, c.palette.bad][i % 4]!;
      const flickerIdx = 3 + c.rng.int(5);
      const main: LString = {
        ax: -c.w * 0.02, ay: c.h * 0.15, bx: c.w * 1.02, by: c.h * 0.23,
        sag: c.h * 0.13, delay: 0.15, bulbs: [],
      };
      for (let i = 0; i < 11; i++) {
        main.bulbs.push({
          f: (i + 0.5) / 11,
          onT: 1.5 + i * 0.2,
          color: colorAt(i),
          flicker: i === flickerIdx,
          seed: c.rng.next() * 100,
        });
      }
      const lower: LString = {
        ax: c.w * 0.34, ay: c.h * 0.35, bx: c.w * 1.02, by: c.h * 0.43,
        sag: c.h * 0.09, delay: 0.55, bulbs: [],
      };
      for (let i = 0; i < 7; i++) {
        lower.bulbs.push({
          f: (i + 0.5) / 7,
          onT: 3.8 + i * 0.18,
          color: colorAt(i + 2),
          flicker: false,
          seed: c.rng.next() * 100,
        });
      }
      strings = [main, lower];
      allLit = 5.1;
    },
    frame(c) {
      const { ctx, palette: p } = c;
      drawFlakes(c, dust, 0.7);
      const breathe = c.t > allLit ? 0.78 + 0.22 * Math.sin((c.t - allLit) * 2) : 1;
      const rBase = Math.min(c.w, c.h) * 0.016;

      for (const s of strings) {
        // The wire.
        ctx.strokeStyle = withAlpha(p.ink, p.dark ? 0.6 : 0.5);
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= 32; i++) {
          const [x, y] = stringPoint(c, s, i / 32);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        for (const b of s.bulbs) {
          const [bx, by] = stringPoint(c, s, b.f);
          const ang = wobble(b.seed, c.t * 0.9) * 0.14;
          const litK = clamp01((c.t - b.onT) / 0.3);
          let lit = litK;
          if (b.flicker && litK > 0 && c.t < b.onT + 1.7) {
            // The comic one: sputters on, off, half-on… then commits.
            const pat = wobble(b.seed * 7, c.t * 4);
            lit = pat > 0.25 ? 1 : pat > -0.2 ? 0.35 : 0;
          }
          lit *= breathe;
          const pop = b.flicker ? 1 : easeOutBack(litK);
          const r = rBase * lerp(0.85, 1, pop);
          const gx = bx - Math.sin(ang) * r * 1.5;
          const gy = by + Math.cos(ang) * r * 1.5;
          if (lit > 0.01) c.drawGlow(gx, gy, r * 4.5, b.color, (p.dark ? 0.85 : 0.55) * lit);

          ctx.save();
          ctx.translate(bx, by);
          ctx.rotate(ang);
          ctx.fillStyle = withAlpha(p.ink, 0.75);
          ctx.fillRect(-r * 0.28, 0, r * 0.56, r * 0.5);
          ctx.fillStyle = lit > 0.01
            ? mixColor(b.color, '#ffffff', 0.15 * lit)
            : withAlpha(b.color, 0.28);
          ctx.beginPath();
          ctx.moveTo(-r * 0.28, r * 0.45);
          ctx.lineTo(r * 0.28, r * 0.45);
          ctx.lineTo(r * 0.62, r * 1.05);
          ctx.lineTo(-r * 0.62, r * 1.05);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.arc(0, r * 1.5, r, 0, TAU);
          ctx.fill();
          if (lit > 0.01) {
            ctx.fillStyle = withAlpha('#ffffff', 0.65 * lit);
            ctx.beginPath();
            ctx.arc(-r * 0.3, r * 1.25, r * 0.32, 0, TAU);
            ctx.fill();
          } else {
            ctx.strokeStyle = withAlpha(p.ink, 0.35);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, r * 1.5, r, 0, TAU);
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    },
  };
}

export const hearthScenes: Scene[] = [makeSnowFrost(), makeEmberSparks(), makeStringLights()];
