/** Harvest victory scenes: a leaf gale, jack-o'-lanterns flickering alight,
 * and an overhead corn maze that solves itself. Autumn, dusk, cozy. */

import type { Ctx2D, Scene } from '../types.ts';
import {
  ParticleSystem, TAU, clamp01, easeOutCubic, flow, mixColor, withAlpha, wobble,
} from '../particles.ts';

/* --- 1. leaf-gale ------------------------------------------------------------
 * Maple/oak/birch leaves tumble through a gusting vortex, spiral into a
 * crescendo, then settle into a drift along the bottom. */

function leafPath(ctx: Ctx2D, kind: number, r: number): void {
  ctx.beginPath();
  if (kind === 0) {
    // maple-ish star
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      const a2 = a + TAU / 10;
      ctx.lineTo(Math.cos(a2) * r * 0.42, Math.sin(a2) * r * 0.42);
    }
  } else if (kind === 1) {
    // oak lobed oval
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r * 0.9, -r * 0.5, r * 0.7, r * 0.6, 0, r);
    ctx.bezierCurveTo(-r * 0.7, r * 0.6, -r * 0.9, -r * 0.5, 0, -r);
  } else {
    // birch teardrop
    ctx.ellipse(0, 0, r * 0.6, r, 0, 0, TAU);
  }
  ctx.closePath();
}

function makeLeafGale(): Scene {
  let leaves: ParticleSystem;
  return {
    id: 'harvest/leaf-gale',
    skin: 'harvest',
    duration: 6.5,
    init(c) {
      leaves = new ParticleSystem(Math.round(180 * c.quality));
      for (let i = 0; i < leaves.capacity; i++) {
        leaves.spawn({
          x: c.rng.next() * c.w, y: c.rng.next() * c.h - c.h,
          vx: 0, vy: 0, life: 12, size: 9 + c.rng.next() * 10,
          rot: c.rng.next() * TAU, vr: (c.rng.next() - 0.5) * 4, seed: c.rng.next(),
        });
      }
    },
    frame(c) {
      const { ctx, palette: p } = c;
      const drift = c.h * 0.86;
      const tones = [p.bad, p.warn, p.accent, mixColor(p.warn, p.bad, 0.5)];
      const gust = clamp01((c.t - 1.5) / 1.5) * (1 - clamp01((c.t - 4.5) / 1.5));
      leaves.update(c.dt, c.t, {
        update(pt, dt) {
          if (pt.y >= drift) { pt.vx *= 0.8; pt.vy = 0; pt.y = drift; pt.vr *= 0.85; return; }
          const [fx, fy] = flow(pt.x, pt.y, c.t, 0.006);
          pt.vx += (fx * 40 + 60 * gust - pt.vx * 0.5) * dt * 3;
          pt.vy += (60 + fy * 30 - pt.vy * 0.4) * dt * 3;
        },
      });
      leaves.each((pt) => {
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot + wobble(pt.seed * 20, c.t) * 0.5);
        ctx.fillStyle = withAlpha(tones[Math.floor(pt.seed * tones.length)]!, 0.92);
        leafPath(ctx, Math.floor(pt.seed * 3), pt.size);
        ctx.fill();
        ctx.restore();
      });
    },
  };
}

/* --- 2. lantern-glow ---------------------------------------------------------
 * Jack-o'-lanterns flicker alight one by one; interior glow through the
 * cutouts; embers rise as fireflies blink. */

function makeLanternGlow(): Scene {
  let embers: ParticleSystem;
  let lit: number[] = [];

  return {
    id: 'harvest/lantern-glow',
    skin: 'harvest',
    duration: 6.5,
    init(c) {
      embers = new ParticleSystem(Math.round(80 * c.quality));
      lit = [0.4, 1.0, 1.6, 2.2, 2.8];
    },
    frame(c) {
      const { ctx, palette: p } = c;
      const baseY = c.h * 0.78;
      const n = 5;
      for (let i = 0; i < n; i++) {
        const x = c.w * (0.16 + 0.68 * (i / (n - 1)));
        const on = c.t > lit[i]!;
        const flick = on ? 0.7 + Math.sin(c.t * 12 + i) * 0.12 + wobble(i, c.t * 2) * 0.15 : 0;
        const r = 58 * c.unit;
        // glow through the face
        if (on) c.drawGlow(x, baseY - r * 0.3, r * 1.4, p.warn, flick * 0.6);
        // pumpkin body
        ctx.fillStyle = mixColor(p.warn, p.bad, 0.35);
        for (const [dx, rx] of [[-14, 20], [14, 20], [0, 26]] as const) {
          ctx.beginPath();
          ctx.ellipse(x + dx, baseY - r * 0.3, rx, r * 0.8, 0, 0, TAU);
          ctx.fill();
        }
        // stem
        ctx.fillStyle = p.good;
        ctx.fillRect(x - 4, baseY - r * 1.1, 8, 14);
        // face (glowing cutouts)
        ctx.fillStyle = on ? withAlpha(mixColor(p.warn, p.surface, 0.5), flick) : withAlpha(p.ink, 0.6);
        // eyes
        ctx.beginPath(); ctx.moveTo(x - 16, baseY - 18); ctx.lineTo(x - 6, baseY - 22); ctx.lineTo(x - 6, baseY - 12); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 16, baseY - 18); ctx.lineTo(x + 6, baseY - 22); ctx.lineTo(x + 6, baseY - 12); ctx.closePath(); ctx.fill();
        // grin — a tiny crossword-ish notched row on the middle pumpkin
        if (i === 2) {
          for (let g = -3; g <= 3; g++) if (g % 2 === 0) ctx.fillRect(x + g * 6 - 2, baseY - 4, 4, 8);
        } else {
          ctx.beginPath(); ctx.moveTo(x - 20, baseY - 2); ctx.quadraticCurveTo(x, baseY + 12, x + 20, baseY - 2); ctx.lineTo(x + 14, baseY - 2); ctx.quadraticCurveTo(x, baseY + 4, x - 14, baseY - 2); ctx.closePath(); ctx.fill();
        }
        if (on && c.rng.next() < 0.2) {
          embers.spawn({ x: x + (c.rng.next() - 0.5) * 20, y: baseY - r, vx: (c.rng.next() - 0.5) * 20, vy: -30 - c.rng.next() * 30, life: 1.6, size: 2 + c.rng.next() * 2 });
        }
      }
      // embers / fireflies
      embers.update(c.dt, c.t, { drag: 0.5 });
      embers.each((pt) => {
        const blink = 0.5 + 0.5 * Math.sin(c.t * 10 + pt.seed * 20);
        c.drawGlow(pt.x, pt.y - (pt.age * 20), 6, p.warn, (1 - pt.age / pt.life) * blink);
      });
    },
  };
}

/* --- 3. corn-maze ------------------------------------------------------------
 * An overhead maze draws itself, a glowing tracer runs it (with a couple of
 * comedic backtracks), and the solved path lights up as a check mark. */

function makeCornMaze(): Scene {
  // A hand-laid spiral-ish path (normalized 0..1 points).
  const PATH: [number, number][] = [
    [0.15, 0.85], [0.15, 0.2], [0.85, 0.2], [0.85, 0.8], [0.3, 0.8],
    [0.3, 0.35], [0.7, 0.35], [0.7, 0.65], [0.45, 0.65], [0.45, 0.5], [0.5, 0.5],
  ];
  return {
    id: 'harvest/corn-maze',
    skin: 'harvest',
    duration: 7,
    init() {},
    frame(c) {
      const { ctx, palette: p } = c;
      const R = c.gridRect ?? { x: c.w * 0.2, y: c.h * 0.12, w: c.w * 0.6, h: c.h * 0.7 };
      const P = (i: number): [number, number] => [R.x + PATH[i]![0] * R.w, R.y + PATH[i]![1] * R.h];
      // hedge walls: draw the whole path faint (the maze), progressively
      const draw = clamp01(c.t / 2.2);
      const segTotal = PATH.length - 1;
      ctx.strokeStyle = withAlpha(mixColor(p.good, p.ink, 0.35), 0.85);
      ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      const shown = draw * segTotal;
      for (let i = 0; i <= Math.floor(shown); i++) {
        const [x, y] = P(i);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();

      // tracer runs the path after it's drawn, with a backtrack wobble
      const run = clamp01((c.t - 2.4) / 3.8);
      if (run > 0) {
        const wob = run < 0.9 ? Math.max(0, Math.sin(run * 22)) * 0.04 : 0; // hesitation
        const pos = clamp01(run - wob) * segTotal;
        const seg = Math.min(segTotal - 1, Math.floor(pos));
        const f = pos - seg;
        const [ax, ay] = P(seg); const [bx, by] = P(seg + 1);
        const tx = lerp(ax, bx, f); const ty = lerp(ay, by, f);
        // traveled path lights gold
        ctx.strokeStyle = withAlpha(p.warn, 0.95);
        ctx.lineWidth = 7;
        ctx.beginPath();
        for (let i = 0; i <= seg; i++) { const [x, y] = P(i); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
        ctx.lineTo(tx, ty);
        ctx.stroke();
        c.drawGlow(tx, ty, 16, p.warn, 1);
      }

      // finale: a big check mark blooms
      const done = clamp01((c.t - 6) / 0.8);
      if (done > 0) {
        ctx.strokeStyle = withAlpha(p.good, done);
        ctx.lineWidth = 14; ctx.lineCap = 'round';
        const cx = c.w / 2; const cy = c.h / 2;
        const k = easeOutCubic(done);
        ctx.beginPath();
        ctx.moveTo(cx - 70, cy);
        ctx.lineTo(cx - 20, cy + 50 * Math.min(1, k * 2));
        if (k > 0.5) ctx.lineTo(cx + 80 * ((k - 0.5) * 2), cy - 60 * ((k - 0.5) * 2));
        ctx.stroke();
      }
    },
  };
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

export const harvestScenes: Scene[] = [makeLeafGale(), makeLanternGlow(), makeCornMaze()];
