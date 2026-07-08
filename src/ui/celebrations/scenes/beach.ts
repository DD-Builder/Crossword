/** Beach victory scenes: bouncing beach balls, a kite with wheeling gulls,
 * and a sandcastle rising tier by tier. Sunny, breezy, summer. */

import type { Ctx2D, Scene } from '../types.ts';
import {
  ParticleSystem, TAU, clamp01, easeOutBack, easeOutBounce, easeOutCubic,
  lerp, mixColor, withAlpha, wobble,
} from '../particles.ts';

/* --- 1. beach-balls ----------------------------------------------------------
 * Striped balls drop, bounce with squash-and-stretch, and roll off; sand
 * puffs on each landing. One cheekily bounces off screen center late. */

interface Ball {
  x: number;
  y: number;
  vy: number;
  vx: number;
  r: number;
  spin: number;
  hue: number;
  landed: number;
}

function makeBeachBalls(): Scene {
  let balls: Ball[] = [];
  let puffs: ParticleSystem;

  const drawBall = (ctx: Ctx2D, b: Ball, cols: string[], ink: string, squash: number): void => {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.spin);
    ctx.scale(1 / squash, squash);
    for (let g = 0; g < 6; g++) {
      ctx.fillStyle = cols[g % cols.length]!;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, b.r, (g / 6) * TAU, ((g + 1) / 6) * TAU);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = withAlpha(ink, 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, b.r * 0.16, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  return {
    id: 'beach/beach-balls',
    skin: 'beach',
    duration: 6.5,
    init(c) {
      puffs = new ParticleSystem(Math.round(120 * c.quality));
      const n = Math.round(7 * c.quality) + 1;
      balls = Array.from({ length: n }, (_, i) => ({
        x: c.w * (0.12 + 0.76 * (i / Math.max(1, n - 1))) + (c.rng.next() - 0.5) * 40,
        y: -60 - c.rng.next() * 300,
        vy: 0,
        vx: (c.rng.next() - 0.5) * 40,
        r: (36 + c.rng.next() * 30) * c.unit,
        spin: c.rng.next() * TAU,
        hue: c.rng.next(),
        landed: 0,
      }));
    },
    frame(c) {
      const { ctx, palette: p } = c;
      const floor = c.h * 0.82;
      const cols = [p.accent, p.warn, p.good, p.surface];

      puffs.update(c.dt, c.t, { gravity: -30, drag: 2 });
      puffs.each((pt) => {
        ctx.globalAlpha = (1 - pt.age / pt.life) * 0.5;
        ctx.fillStyle = mixColor(p.surface, p.warn, 0.3);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      for (const b of balls) {
        b.vy += 900 * c.dt;
        b.y += b.vy * c.dt;
        b.x += b.vx * c.dt;
        b.spin += b.vx * 0.01 * c.dt * 60;
        let squash = 1;
        if (b.y > floor - b.r) {
          b.y = floor - b.r;
          if (b.vy > 120) {
            // bounce
            for (let i = 0; i < 6 * c.quality; i++) {
              puffs.spawn({
                x: b.x + (c.rng.next() - 0.5) * b.r, y: floor,
                vx: (c.rng.next() - 0.5) * 120, vy: -c.rng.next() * 40,
                life: 0.5, size: 3 + c.rng.next() * 4,
              });
            }
          }
          b.vy *= -0.72;
          b.landed++;
          if (Math.abs(b.vy) < 60) { b.vy = 0; b.vx += 30 * c.dt; } // roll away
          squash = 1 + clamp01(0.4 - (b.landed * 0.05));
        }
        drawBall(ctx, b, cols, p.ink, squash);
      }
    },
  };
}

/* --- 2. kite-and-gulls -------------------------------------------------------
 * A diamond kite loops figure-eights on a physics tail while gulls wheel past
 * drifting clouds; a sun glint sparkles. */

function makeKiteAndGulls(): Scene {
  const tail: { x: number; y: number }[] = [];
  let gulls: { phase: number; y: number; sp: number; depth: number }[] = [];

  return {
    id: 'beach/kite-and-gulls',
    skin: 'beach',
    duration: 6.5,
    init(c) {
      tail.length = 0;
      gulls = Array.from({ length: 4 }, () => ({
        phase: c.rng.next() * TAU, y: c.h * (0.1 + c.rng.next() * 0.3),
        sp: 0.3 + c.rng.next() * 0.4, depth: 0.5 + c.rng.next() * 0.5,
      }));
    },
    frame(c) {
      const { ctx, palette: p } = c;
      // drifting clouds
      for (let i = 0; i < 4; i++) {
        const cx = ((c.t * 12 + i * c.w * 0.3) % (c.w + 200)) - 100;
        const cy = c.h * (0.15 + i * 0.09);
        ctx.fillStyle = withAlpha(p.surface, p.dark ? 0.12 : 0.55);
        for (const [dx, dy, r] of [[0, 0, 34], [30, 6, 26], [-28, 8, 24], [6, -12, 22]] as const) {
          ctx.beginPath();
          ctx.arc(cx + dx, cy + dy, r, 0, TAU);
          ctx.fill();
        }
      }
      // kite in a figure-eight
      const kx = c.w * 0.5 + Math.sin(c.t * 1.1) * c.w * 0.28;
      const ky = c.h * 0.4 + Math.sin(c.t * 2.2) * c.h * 0.16;
      tail.unshift({ x: kx, y: ky });
      if (tail.length > 26) tail.pop();
      // tail
      ctx.strokeStyle = withAlpha(p.warn, 0.8);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      tail.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y + Math.sin(c.t * 6 + i) * 6) : ctx.moveTo(pt.x, pt.y)));
      ctx.stroke();
      tail.forEach((pt, i) => {
        if (i % 5 === 2) {
          ctx.fillStyle = withAlpha(i % 10 === 2 ? p.accent : p.bad, 0.85);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4, 0, TAU);
          ctx.fill();
        }
      });
      // kite body (diamond) with a slight bow at the end
      const ang = Math.atan2(ky - (tail[3]?.y ?? ky), kx - (tail[3]?.x ?? kx));
      ctx.save();
      ctx.translate(kx, ky);
      ctx.rotate(ang + Math.PI / 2 + (c.t > 5.5 ? Math.sin((c.t - 5.5) * 6) * 0.3 : 0));
      const k = 40 * c.unit;
      ctx.fillStyle = p.accent;
      ctx.beginPath(); ctx.moveTo(0, -k); ctx.lineTo(k * 0.7, 0); ctx.lineTo(0, k); ctx.lineTo(-k * 0.7, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = withAlpha(p.ink, 0.5); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -k); ctx.lineTo(0, k); ctx.moveTo(-k * 0.7, 0); ctx.lineTo(k * 0.7, 0); ctx.stroke();
      ctx.restore();
      // gulls
      ctx.strokeStyle = withAlpha(p.ink, 0.7);
      ctx.lineWidth = 2;
      for (const g of gulls) {
        const gx = ((c.t * 40 * g.sp + g.phase * 100) % (c.w + 80)) - 40;
        const flap = Math.sin(c.t * 7 + g.phase) * 6;
        ctx.beginPath();
        ctx.moveTo(gx - 10, g.y);
        ctx.quadraticCurveTo(gx - 4, g.y - 6 - flap, gx, g.y);
        ctx.quadraticCurveTo(gx + 4, g.y - 6 - flap, gx + 10, g.y);
        ctx.stroke();
      }
      // sun glint
      c.drawGlow(c.w * 0.86, c.h * 0.16, 40 + Math.sin(c.t * 2) * 8, p.warn, 0.5);
    },
  };
}

/* --- 3. sandcastle -----------------------------------------------------------
 * A castle rises tier by tier with thumps and sand-spray; a flag unfurls;
 * glitter drifts; waves lap the base. */

function makeSandcastle(): Scene {
  let glitter: ParticleSystem;

  return {
    id: 'beach/sandcastle',
    skin: 'beach',
    duration: 6.5,
    init(c) { glitter = new ParticleSystem(Math.round(90 * c.quality)); },
    frame(c) {
      const { ctx, palette: p } = c;
      const baseY = c.h * 0.8;
      const cx = c.w * 0.5;
      const sand = mixColor(p.warn, p.surface, 0.35);
      const sandDk = mixColor(p.warn, p.ink, 0.2);

      // three tiers rise in sequence (scaled to fill larger screens)
      const u = c.unit;
      const tiers = [
        { w: 260 * u, h: 70 * u, at: 0.2 },
        { w: 190 * u, h: 64 * u, at: 1.1 },
        { w: 120 * u, h: 58 * u, at: 2.0 },
      ];
      let topY = baseY;
      tiers.forEach((tr, i) => {
        const k = easeOutBack(clamp01((c.t - tr.at) / 0.7));
        if (k <= 0) return;
        const h = tr.h * k;
        const y = baseY - tiers.slice(0, i).reduce((a, t) => a + t.h, 0) - h;
        topY = Math.min(topY, y);
        ctx.fillStyle = sand;
        ctx.fillRect(cx - (tr.w * k) / 2, y, tr.w * k, h);
        // crenellations
        ctx.fillStyle = sandDk;
        const merlons = 5;
        for (let m = 0; m < merlons; m++) {
          if (m % 2 === 0) ctx.fillRect(cx - (tr.w * k) / 2 + (m / merlons) * tr.w * k, y - 10 * k, (tr.w * k) / merlons, 10 * k);
        }
        // spray on landing
        if (Math.abs(c.t - (tr.at + 0.7)) < 0.05) {
          for (let s = 0; s < 14 * c.quality; s++) {
            glitter.spawn({
              x: cx + (c.rng.next() - 0.5) * tr.w, y,
              vx: (c.rng.next() - 0.5) * 160, vy: -c.rng.next() * 160,
              life: 0.8, size: 2 + c.rng.next() * 3, color: sand,
            });
          }
        }
      });

      // flag on top once the last tier is up
      const flagK = clamp01((c.t - 2.7) / 0.5);
      if (flagK > 0) {
        ctx.strokeStyle = p.ink; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(cx, topY); ctx.lineTo(cx, topY - 36); ctx.stroke();
        ctx.fillStyle = p.bad;
        ctx.beginPath();
        ctx.moveTo(cx, topY - 36);
        ctx.lineTo(cx + 30 * flagK, topY - 30 + Math.sin(c.t * 8) * 3);
        ctx.lineTo(cx, topY - 22);
        ctx.closePath(); ctx.fill();
      }

      // drifting glitter
      glitter.update(c.dt, c.t, { gravity: 260, drag: 0.4 });
      glitter.each((pt) => {
        ctx.globalAlpha = 1 - pt.age / pt.life;
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      });
      ctx.globalAlpha = 1;
      if (c.rng.next() < 0.3) {
        glitter.spawn({ x: cx + (c.rng.next() - 0.5) * 200, y: topY, vx: 0, vy: 20, life: 1.5, size: 2, color: withAlpha(p.warn, 0.9) });
      }

      // waves lap the base
      ctx.strokeStyle = withAlpha(p.accent, 0.5);
      ctx.lineWidth = 3;
      for (let l = 0; l < 3; l++) {
        ctx.beginPath();
        for (let x = 0; x <= c.w; x += 12) {
          const yy = baseY + 14 + l * 12 + Math.sin(x * 0.03 + c.t * 2 + l) * 4;
          x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
    },
  };
}

export const beachScenes: Scene[] = [makeBeachBalls(), makeKiteAndGulls(), makeSandcastle()];
