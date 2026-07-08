/** Botanical (sage & pressed-leaf) victory scenes: vine-bloom, petal-storm,
 * butterflies. Garden physics — everything grows along curves, gusts on the
 * wind, or flutters upward — keyed to the skin's sage accent with warm
 * blossom tones borrowed from warn/bad. */

import type { Ctx2D, Palette, Scene, SceneContext } from '../types.ts';
import {
  ParticleSystem, TAU, clamp01, easeInCubic, easeOutBack, easeOutCubic, flow,
  lerp, mixColor, withAlpha, wobble,
} from '../particles.ts';

/* --- shared botanical helpers -------------------------------------------------- */

interface Pt {
  x: number;
  y: number;
}

function bezierAt(p0: Pt, p1: Pt, p2: Pt, p3: Pt, f: number): Pt {
  const u = 1 - f;
  const a = u * u * u;
  const b = 3 * u * u * f;
  const d = 3 * u * f * f;
  const e = f * f * f;
  return {
    x: a * p0.x + b * p1.x + d * p2.x + e * p3.x,
    y: a * p0.y + b * p1.y + d * p2.y + e * p3.y,
  };
}

/** Petal tints: warm blossom colors softened toward the skin's surface. */
function bloomTones(p: Palette): [string, string, string] {
  return [
    mixColor(p.warn, p.surface, 0.3),
    mixColor(p.bad, p.surface, 0.42),
    mixColor(p.accent, p.surface, 0.2),
  ];
}

/** 5–7 petal rosette: rotated ellipses around a golden core dot. */
function drawBlossom(
  ctx: Ctx2D, x: number, y: number, r: number, petals: number, rot: number,
  petalColor: string, coreColor: string,
): void {
  if (r < 0.5) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = petalColor;
  for (let i = 0; i < petals; i++) {
    ctx.save();
    ctx.rotate((i / petals) * TAU);
    ctx.beginPath();
    ctx.ellipse(r * 0.55, 0, r * 0.5, r * 0.24, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = coreColor;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* --- 1. vine-bloom --------------------------------------------------------------
 * Bezier vines grow in from all four screen edges, unfurling leaves as the
 * tip passes; blossoms pop open (easeOutBack rosettes) in warm tones along
 * the way, and loosened petals drift down for the finale. */

interface VineLeaf {
  f: number;
  side: number;
  size: number;
}

interface VineBloom {
  f: number;
  px: number;
  py: number;
  petals: number;
  size: number;
  colorIdx: number;
  rot: number;
}

interface Vine {
  p0: Pt;
  p1: Pt;
  p2: Pt;
  p3: Pt;
  t0: number;
  grow: number;
  leaves: VineLeaf[];
  blooms: VineBloom[];
}

function makeVineBloom(): Scene {
  let vines: Vine[] = [];
  let drift: ParticleSystem;
  const DRIFT_AT = 4.6;

  return {
    id: 'botanical/vine-bloom',
    skin: 'botanical',
    duration: 7.5,
    init(c) {
      drift = new ParticleSystem(Math.max(40, Math.round(90 * c.quality)));
      vines = [];
      for (let e = 0; e < 4; e++) {
        for (let v = 0; v < 2; v++) {
          const f = 0.2 + c.rng.next() * 0.6;
          const p0: Pt =
            e === 0 ? { x: -12, y: c.h * f } :
            e === 1 ? { x: c.w + 12, y: c.h * f } :
            e === 2 ? { x: c.w * f, y: -12 } :
            { x: c.w * f, y: c.h + 12 };
          const p3: Pt = {
            x: c.w * (0.28 + c.rng.next() * 0.44),
            y: c.h * (0.26 + c.rng.next() * 0.46),
          };
          const dx = p3.x - p0.x;
          const dy = p3.y - p0.y;
          const len = Math.hypot(dx, dy) || 1;
          const amp = len * (0.25 + c.rng.next() * 0.3) * (c.rng.next() < 0.5 ? -1 : 1);
          const p1: Pt = { x: p0.x + dx * 0.33 - (dy / len) * amp, y: p0.y + dy * 0.33 + (dx / len) * amp };
          const p2: Pt = { x: p0.x + dx * 0.66 + (dy / len) * amp * 0.7, y: p0.y + dy * 0.66 - (dx / len) * amp * 0.7 };
          const leaves: VineLeaf[] = [];
          for (let l = 0; l < 5; l++) {
            leaves.push({
              f: 0.12 + (l / 5) * 0.68 + c.rng.next() * 0.06,
              side: l % 2 ? 1 : -1,
              size: 7 + c.rng.next() * 6,
            });
          }
          const blooms: VineBloom[] = [];
          for (const bf of [0.5 + c.rng.next() * 0.12, 0.92]) {
            const bp = bezierAt(p0, p1, p2, p3, bf);
            blooms.push({
              f: bf,
              px: bp.x,
              py: bp.y,
              petals: 5 + c.rng.int(3),
              size: 11 + c.rng.next() * 7,
              colorIdx: c.rng.int(3),
              rot: c.rng.next() * TAU,
            });
          }
          vines.push({
            p0, p1, p2, p3,
            t0: 0.15 + e * 0.22 + v * 0.35 + c.rng.next() * 0.2,
            grow: 2.4 + c.rng.next() * 0.8,
            leaves,
            blooms,
          });
        }
      }
    },
    frame(c) {
      const { ctx, palette: p } = c;
      const tones = bloomTones(p);
      const stem = mixColor(p.accent, p.ink, 0.3);
      const leafFill = mixColor(p.accent, p.surface, p.dark ? 0.12 : 0.06);
      ctx.lineCap = 'round';

      for (const vn of vines) {
        const k = easeOutCubic(clamp01((c.t - vn.t0) / vn.grow));
        if (k <= 0) continue;

        // Progressive stem: sampled bezier polyline, tapering toward the tip.
        const STEPS = 24;
        let prev = vn.p0;
        for (let s = 1; s <= STEPS; s++) {
          const f = (s / STEPS) * k;
          const pt = bezierAt(vn.p0, vn.p1, vn.p2, vn.p3, f);
          ctx.strokeStyle = withAlpha(stem, 0.9);
          ctx.lineWidth = lerp(3.6, 1.3, f);
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(pt.x, pt.y);
          ctx.stroke();
          prev = pt;
        }
        if (k < 1) c.drawGlow(prev.x, prev.y, 10, p.accent, 0.35);

        // Leaves unfurl (easeOutBack) as the growing tip passes them.
        for (const lf of vn.leaves) {
          const u = easeOutBack(clamp01((k - lf.f) * 5));
          if (u <= 0) continue;
          const at = bezierAt(vn.p0, vn.p1, vn.p2, vn.p3, lf.f);
          const ahead = bezierAt(vn.p0, vn.p1, vn.p2, vn.p3, Math.min(1, lf.f + 0.02));
          const ang = Math.atan2(ahead.y - at.y, ahead.x - at.x) + lf.side * 0.95;
          ctx.save();
          ctx.translate(at.x, at.y);
          ctx.rotate(ang + wobble(lf.f * 40, c.t * 0.7) * 0.06);
          ctx.scale(u, u);
          ctx.fillStyle = withAlpha(leafFill, 0.9);
          ctx.beginPath();
          ctx.ellipse(lf.size * 0.7, 0, lf.size * 0.7, lf.size * 0.32, 0, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = withAlpha(p.ink, 0.25);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(lf.size * 1.3, 0);
          ctx.stroke();
          ctx.restore();
        }

        // Blossoms pop open once the vine reaches them, swaying gently after.
        for (const bl of vn.blooms) {
          const u = easeOutBack(clamp01((k - bl.f) * 3.5));
          if (u <= 0) continue;
          const sway = wobble(bl.rot, c.t * 0.6) * 0.08;
          c.drawGlow(bl.px, bl.py, bl.size * 2.2, p.accentSoft, 0.3 * clamp01(u));
          drawBlossom(
            ctx, bl.px, bl.py, bl.size * u, bl.petals, bl.rot + sway,
            withAlpha(tones[bl.colorIdx]!, 0.95), withAlpha(p.cellSelected, 0.95),
          );
        }
      }

      // Finale: petals loosen from the blossoms and drift down.
      if (c.t > DRIFT_AT && drift.alive < drift.capacity && c.rng.next() < 0.5 * c.quality) {
        const vn = c.rng.pick(vines);
        const bl = vn && c.rng.pick(vn.blooms);
        if (bl) {
          drift.spawn({
            x: bl.px,
            y: bl.py,
            vx: (c.rng.next() - 0.5) * 30,
            vy: 12 + c.rng.next() * 30,
            life: 2 + c.rng.next() * 1.5,
            size: 3 + c.rng.next() * 2.5,
            rot: c.rng.next() * TAU,
            vr: (c.rng.next() - 0.5) * 3,
            color: tones[bl.colorIdx]!,
          });
        }
      }
      drift.update(c.dt, c.t, {
        gravity: 26,
        update(pt, dt) {
          pt.vx += wobble(pt.seed * 51, c.t) * 40 * dt;
        },
      });
      drift.each((pt) => {
        ctx.globalAlpha = clamp01(1 - pt.age / pt.life) * 0.9;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, pt.size, pt.size * 0.55, pt.rot, 0, TAU);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    },
  };
}

/* --- 2. petal-storm --------------------------------------------------------------
 * Hundreds of petals gust through curl noise plus two migrating vortices;
 * petals face their travel direction and catch the light on sharp turns.
 * The storm tapers and everything settles into a drift along the bottom. */

function makePetalStorm(): Scene {
  let petals: ParticleSystem;
  const DUR = 7;
  const SETTLE = 4.4;

  const vortexAt = (i: number, c: SceneContext): Pt => ({
    x: c.w * (0.32 + i * 0.36) + Math.sin(c.t * (0.22 + i * 0.09) + i * 2.6) * c.w * 0.17,
    y: c.h * (0.36 + i * 0.14) + Math.cos(c.t * (0.16 + i * 0.07) + i * 1.4) * c.h * 0.15,
  });

  return {
    id: 'botanical/petal-storm',
    skin: 'botanical',
    duration: DUR,
    init(c) {
      petals = new ParticleSystem(Math.max(120, Math.round(300 * c.quality)));
      const tones = bloomTones(c.palette);
      for (let i = 0; i < petals.capacity; i++) {
        petals.spawn({
          x: c.rng.next() * c.w,
          y: c.rng.next() * c.h - c.h * 0.15,
          vx: (c.rng.next() - 0.5) * 120,
          vy: (c.rng.next() - 0.5) * 60,
          life: DUR + 4,
          size: 2.6 + c.rng.next() * 3.4,
          rot: c.rng.next() * TAU,
          alpha: 0.75,
          color: tones[c.rng.int(3)]!,
          seed: c.rng.next(),
        });
      }
    },
    frame(c) {
      const { ctx, palette: p } = c;
      const storm = clamp01(1 - (c.t - SETTLE) / 1.8);
      const v0 = vortexAt(0, c);
      const v1 = vortexAt(1, c);

      // The two gust centers read as soft eddies of light.
      if (storm > 0) {
        c.drawGlow(v0.x, v0.y, 90, p.accentSoft, 0.18 * storm);
        c.drawGlow(v1.x, v1.y, 70, p.accentSoft, 0.14 * storm);
      }

      petals.update(c.dt, c.t, {
        drag: 0.7,
        update(pt, dt) {
          // Curl-noise wind plus two migrating swirl centers.
          const [fx, fy] = flow(pt.x, pt.y, c.t, 0.005);
          pt.vx += fx * 90 * storm * dt;
          pt.vy += fy * 90 * storm * dt;
          for (const v of [v0, v1]) {
            const dx = pt.x - v.x;
            const dy = pt.y - v.y;
            const d = Math.hypot(dx, dy) + 26;
            const swirl = 300 * clamp01(340 / d) * storm;
            pt.vx += (-dy / d) * swirl * dt - (dx / d) * 26 * storm * dt;
            pt.vy += (dx / d) * swirl * dt - (dy / d) * 26 * storm * dt;
          }
          pt.vy += (1 - storm) * 150 * dt; // gusts die → petals fall

          // Petals face their travel direction; a sharp turn catches the light.
          const heading = Math.atan2(pt.vy, pt.vx);
          let dh = heading - pt.rot;
          while (dh > Math.PI) dh -= TAU;
          while (dh < -Math.PI) dh += TAU;
          pt.rot += dh * Math.min(1, dt * 9);
          pt.alpha = Math.min(1, Math.max(0.72, pt.alpha - dt * 1.4) + Math.abs(dh) * 0.5);

          // Keep the flock on screen while the storm blows.
          if (storm > 0.4) {
            if (pt.x < -20) pt.x = c.w + 18;
            if (pt.x > c.w + 20) pt.x = -18;
            if (pt.y < -26) {
              pt.y = -26;
              pt.vy = Math.abs(pt.vy) * 0.4;
            }
          }
          // Settle along the bottom as the storm tapers.
          const floor = c.h - 3 - pt.seed * 30;
          if (storm < 0.6 && pt.y >= floor) {
            pt.y = floor;
            pt.vy = 0;
            pt.vx *= 0.9;
            pt.rot = lerp(pt.rot, 0, Math.min(1, dt * 3));
          }
        },
      });

      const fade = clamp01((DUR + 0.6 - c.t) / 1.2);
      petals.each((pt) => {
        ctx.globalAlpha = pt.alpha * fade * 0.92;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, pt.size, pt.size * 0.52, pt.rot, 0, TAU);
        ctx.fill();
        if (pt.alpha > 0.88) {
          // Glint: a brief lighter sheen while the petal turns.
          ctx.globalAlpha = Math.min(1, (pt.alpha - 0.88) * 6) * fade;
          ctx.fillStyle = mixColor(pt.color, '#ffffff', 0.65);
          ctx.beginPath();
          ctx.ellipse(pt.x, pt.y, pt.size * 0.7, pt.size * 0.36, pt.rot, 0, TAU);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
    },
  };
}

/* --- 3. butterflies ----------------------------------------------------------------
 * 8–12 butterflies spiral up from the solved grid on wobble paths, wings
 * flapping via sin x-scale, trailing golden sparkle dust — then scatter to
 * the four corners at the end. */

interface Fly {
  t0: number;
  x0: number;
  y0: number;
  topY: number;
  phase: number;
  flapW: number;
  spiralR: number;
  spiralW: number;
  size: number;
  colorIdx: number;
  corner: number;
  seed: number;
}

function makeButterflies(): Scene {
  let flies: Fly[] = [];
  let dust: ParticleSystem;
  const DUR = 7;

  const flyPos = (f: Fly, c: SceneContext): Pt => {
    const rise = easeOutCubic(clamp01((c.t - f.t0) / 4.6));
    const ang = c.t * f.spiralW + f.phase;
    let x = f.x0 + wobble(f.seed * 17, c.t * 0.55) * c.w * 0.09 +
      Math.cos(ang) * f.spiralR * (0.35 + 0.65 * rise);
    let y = lerp(f.y0, f.topY, rise) + Math.sin(ang) * f.spiralR * 0.38;
    const u = easeInCubic(clamp01((c.t - (DUR - 1.7)) / 1.5));
    if (u > 0) {
      // Scatter: each butterfly darts off toward its own corner.
      x = lerp(x, f.corner % 2 ? c.w + 90 : -90, u);
      y = lerp(y, f.corner < 2 ? -90 : c.h + 90, u);
    }
    return { x, y };
  };

  return {
    id: 'botanical/butterflies',
    skin: 'botanical',
    duration: DUR,
    init(c) {
      dust = new ParticleSystem(150);
      const r = c.gridRect ?? { x: c.w * 0.18, y: c.h * 0.62, w: c.w * 0.64, h: c.h * 0.3 };
      const n = 8 + Math.round(4 * c.quality);
      flies = [];
      for (let i = 0; i < n; i++) {
        flies.push({
          t0: 0.2 + c.rng.next() * 1.2,
          x0: r.x + c.rng.next() * r.w,
          y0: r.y + c.rng.next() * r.h,
          topY: c.h * (0.1 + c.rng.next() * 0.24),
          phase: c.rng.next() * TAU,
          flapW: 10 + c.rng.next() * 5,
          spiralR: 34 + c.rng.next() * 52,
          spiralW: (1.4 + c.rng.next() * 1.2) * (i % 2 ? 1 : -1),
          size: 0.85 + c.rng.next() * 0.55,
          colorIdx: i % 2,
          corner: i % 4,
          seed: c.rng.next(),
        });
      }
    },
    frame(c) {
      const { ctx, palette: p } = c;

      // Sparkle dust settles behind the flock.
      dust.update(c.dt, c.t, { gravity: 30, drag: 1 });
      dust.each((pt) => {
        const a = 1 - pt.age / pt.life;
        ctx.globalAlpha = a * 0.85;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
        ctx.fill();
        if (pt.size > 2) c.drawGlow(pt.x, pt.y, pt.size * 4, p.cellSelected, a * 0.3);
      });
      ctx.globalAlpha = 1;

      for (const f of flies) {
        const sc = f.size * 2.2 * c.unit * easeOutBack(clamp01((c.t - f.t0) / 0.5));
        if (sc <= 0) continue;
        const pos = flyPos(f, c);
        if (c.rng.next() < 0.4 * c.quality) {
          dust.spawn({
            x: pos.x + (c.rng.next() - 0.5) * 8,
            y: pos.y + 5,
            vx: (c.rng.next() - 0.5) * 22,
            vy: 6 + c.rng.next() * 16,
            life: 0.5 + c.rng.next() * 0.6,
            size: 1 + c.rng.next() * 1.6,
            color: withAlpha(p.cellSelected, 0.9),
          });
        }

        const flap = Math.abs(Math.sin(c.t * f.flapW + f.phase));
        const wingX = 0.25 + 0.75 * flap;
        const tilt = Math.cos(c.t * f.spiralW + f.phase) * (f.spiralW > 0 ? 0.28 : -0.28);
        const wing = f.colorIdx
          ? mixColor(p.warn, p.surface, 0.15)
          : mixColor(p.accent, p.surface, 0.12);
        const hind = mixColor(wing, p.ink, 0.22);

        c.drawGlow(pos.x, pos.y, 16 * sc, p.accentSoft, 0.25);
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(tilt);
        ctx.scale(sc, sc);
        for (const side of [-1, 1]) {
          ctx.save();
          ctx.scale(side * wingX, 1);
          ctx.fillStyle = withAlpha(wing, 0.95);
          ctx.beginPath();
          ctx.ellipse(6.2, -3, 6.4, 4.4, -0.5, 0, TAU); // forewing
          ctx.fill();
          ctx.fillStyle = withAlpha(hind, 0.95);
          ctx.beginPath();
          ctx.ellipse(4.6, 3.4, 4.4, 3.1, 0.55, 0, TAU); // hindwing
          ctx.fill();
          ctx.fillStyle = withAlpha(p.surface, 0.8);
          ctx.beginPath();
          ctx.arc(7.5, -3.5, 1.4, 0, TAU); // wing spot
          ctx.fill();
          ctx.restore();
        }
        ctx.fillStyle = withAlpha(p.ink, 0.95);
        ctx.beginPath();
        ctx.ellipse(0, 0.5, 1.3, 5.2, 0, 0, TAU); // body
        ctx.fill();
        ctx.strokeStyle = withAlpha(p.ink, 0.8);
        ctx.lineWidth = 0.8;
        ctx.beginPath(); // antennae
        ctx.moveTo(0, -4.5);
        ctx.quadraticCurveTo(-2.5, -8, -3.5, -8.5);
        ctx.moveTo(0, -4.5);
        ctx.quadraticCurveTo(2.5, -8, 3.5, -8.5);
        ctx.stroke();
        ctx.restore();
      }
    },
  };
}

export const botanicalScenes: Scene[] = [makeVineBloom(), makePetalStorm(), makeButterflies()];
