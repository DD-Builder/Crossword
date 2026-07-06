/** Art Deco (gold on black geometry) victory scenes: sunburst-marquee,
 * champagne, gilded-fireworks. Gatsby-era glamour — hard gold geometry,
 * chasing marquee bulbs, and metallic bursts off the skin's gold accent. */

import type { Ctx2D, Palette, Scene } from '../types.ts';
import {
  ParticleSystem, TAU, clamp01, easeOutBack, easeOutCubic, lerp, mixColor,
  withAlpha, wobble,
} from '../particles.ts';

/* --- shared deco helpers --------------------------------------------------------- */

/** Three metallic golds off the skin accent: bright, true, and shadowed. */
function goldTones(p: Palette): [string, string, string] {
  return [
    mixColor(p.accent, '#ffffff', p.dark ? 0.55 : 0.35),
    mixColor(p.accent, p.surface, 0.08),
    mixColor(p.accent, p.ink, 0.35),
  ];
}

/** Four-point deco sparkle (concave star). */
function drawSparkle(ctx: Ctx2D, x: number, y: number, r: number, rot: number, color: string): void {
  if (r < 0.4) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r * 0.16, -r * 0.16, r, 0);
  ctx.quadraticCurveTo(r * 0.16, r * 0.16, 0, r);
  ctx.quadraticCurveTo(-r * 0.16, r * 0.16, -r, 0);
  ctx.quadraticCurveTo(-r * 0.16, -r * 0.16, 0, -r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* --- 1. sunburst-marquee -----------------------------------------------------------
 * Gold rays fan out from the hub with staggered easeOutCubic extension while
 * the whole burst rotates slowly; marquee bulbs chase outward along the ray
 * edges, and a deco medallion (segmented rings + chevrons + stepped diamond)
 * snaps in at the center. */

interface Ray {
  ang: number;
  t0: number;
  len: number;
}

function makeSunburstMarquee(): Scene {
  let rays: Ray[] = [];
  const RAYS = 24;

  return {
    id: 'art-deco/sunburst-marquee',
    skin: 'art-deco',
    duration: 7,
    init(c) {
      rays = [];
      const maxLen = Math.hypot(c.w, c.h) * 0.56;
      for (let i = 0; i < RAYS; i++) {
        rays.push({
          ang: (i / RAYS) * TAU,
          t0: 0.25 + c.rng.next() * 1.1,
          len: maxLen * (0.78 + c.rng.next() * 0.26),
        });
      }
    },
    frame(c) {
      const { ctx, palette: p } = c;
      const [bright, gold, shadow] = goldTones(p);
      const cx = c.gridRect ? c.gridRect.x + c.gridRect.w / 2 : c.w / 2;
      const cy = c.gridRect ? c.gridRect.y + c.gridRect.h / 2 : c.h * 0.44;
      const rot = c.t * 0.055;
      const R0 = 40;

      c.drawGlow(cx, cy, 170, gold, 0.3 * clamp01(c.t / 1.2));

      for (let i = 0; i < RAYS; i++) {
        const ray = rays[i]!;
        const k = easeOutCubic(clamp01((c.t - ray.t0) / 1.3));
        if (k <= 0) continue;
        const L = ray.len * k;
        const a = ray.ang + rot;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        const px = -dy;
        const py = dx;
        const tipW = 2.5 + L * 0.02;
        ctx.fillStyle = withAlpha(i % 2 ? shadow : gold, i % 2 ? 0.38 : 0.5);
        ctx.beginPath();
        ctx.moveTo(cx + dx * R0 + px * 1.2, cy + dy * R0 + py * 1.2);
        ctx.lineTo(cx + dx * (R0 + L) + px * tipW, cy + dy * (R0 + L) + py * tipW);
        ctx.lineTo(cx + dx * (R0 + L) - px * tipW, cy + dy * (R0 + L) - py * tipW);
        ctx.lineTo(cx + dx * R0 - px * 1.2, cy + dy * R0 - py * 1.2);
        ctx.closePath();
        ctx.fill();

        // Marquee bulbs chase outward along the ray's lit edge.
        for (let b = 0; b < 2; b++) {
          const fr = (c.t * 0.34 + b * 0.5 + ray.t0 * 0.7) % 1;
          if (fr * ray.len > L) continue;
          const br = R0 + fr * L;
          const bw = lerp(1.2, tipW, fr) + 2.5;
          const bx = cx + dx * br + px * bw;
          const by = cy + dy * br + py * bw;
          const ba = Math.sin(Math.PI * fr) * k;
          c.drawGlow(bx, by, 9, bright, 0.75 * ba);
          ctx.fillStyle = withAlpha(mixColor(bright, '#ffffff', 0.5), ba);
          ctx.beginPath();
          ctx.arc(bx, by, 1.8, 0, TAU);
          ctx.fill();
        }
      }

      // Deco medallion snaps in at the hub, counter-rotating slowly.
      const ms = easeOutBack(clamp01((c.t - 1) / 0.7));
      if (ms > 0) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-rot * 0.8);
        ctx.scale(ms, ms);
        ctx.lineCap = 'round';
        for (let ring = 0; ring < 3; ring++) {
          // Concentric segmented arcs, like a zodiac dial.
          const rr = 14 + ring * 10;
          const segs = 4 + ring * 4;
          ctx.strokeStyle = withAlpha(ring % 2 ? shadow : gold, 0.85);
          ctx.lineWidth = ring === 2 ? 1.6 : 2.4;
          for (let s = 0; s < segs; s++) {
            const a0 = (s / segs) * TAU + ring * 0.4;
            ctx.beginPath();
            ctx.arc(0, 0, rr, a0, a0 + (TAU / segs) * 0.7);
            ctx.stroke();
          }
        }
        ctx.strokeStyle = withAlpha(bright, 0.9);
        ctx.lineWidth = 2;
        for (let m = 0; m < 8; m++) {
          // Chevrons pointing outward around the rim.
          ctx.save();
          ctx.rotate((m / 8) * TAU + TAU / 16);
          ctx.beginPath();
          ctx.moveTo(38, -4);
          ctx.lineTo(44, 0);
          ctx.lineTo(38, 4);
          ctx.stroke();
          ctx.restore();
        }
        for (let d = 0; d < 3; d++) {
          // Stepped diamond core.
          const r = 9 - d * 3;
          ctx.fillStyle = withAlpha(d % 2 ? p.ink : gold, 0.95);
          ctx.beginPath();
          ctx.moveTo(0, -r);
          ctx.lineTo(r, 0);
          ctx.lineTo(0, r);
          ctx.lineTo(-r, 0);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
    },
  };
}

/* --- 2. champagne --------------------------------------------------------------------
 * A stroked coupe glass center-bottom; bubbles rise in five wobbling columns
 * and pop into four-point sparkles under a fizz mist — then the cork blows
 * with a burst of gold. */

function makeChampagne(): Scene {
  let bubbles: ParticleSystem;
  let sparks: ParticleSystem;
  let acc = 0;
  let popped = false;
  const DUR = 7.5;
  const POP = 5;

  return {
    id: 'art-deco/champagne',
    skin: 'art-deco',
    duration: DUR,
    init(c) {
      bubbles = new ParticleSystem(Math.max(60, Math.round(110 * c.quality)));
      sparks = new ParticleSystem(Math.max(80, Math.round(160 * c.quality)));
      acc = 0;
      popped = false;
    },
    frame(c) {
      const { ctx, palette: p } = c;
      const [bright, gold, shadow] = goldTones(p);
      const gx = c.w / 2;
      const R = Math.min(c.w, c.h) * 0.13;
      const rimY = c.h * 0.74;
      const entry = easeOutCubic(clamp01((c.t - 0.1) / 0.9));

      // Coupe glass silhouette: bowl arc, stem, foot arc.
      ctx.lineCap = 'round';
      ctx.strokeStyle = withAlpha(p.accent, 0.9 * entry);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(gx, rimY, R, R * 0.62, 0, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gx, rimY + R * 0.62);
      ctx.lineTo(gx, rimY + R * 1.34);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(gx, rimY + R * 1.34, R * 0.46, R * 0.08, 0, 0, Math.PI);
      ctx.stroke();
      ctx.strokeStyle = withAlpha(p.accent, 0.5 * entry);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(gx - R, rimY);
      ctx.lineTo(gx + R, rimY);
      ctx.stroke();
      // Champagne surface glinting inside the bowl.
      ctx.fillStyle = withAlpha(gold, 0.16 * entry);
      ctx.beginPath();
      ctx.ellipse(gx, rimY + R * 0.05, R * 0.9, R * 0.5, 0, 0, Math.PI);
      ctx.fill();

      // Fizz mist hanging above the glass.
      for (let i = 0; i < 3; i++) {
        c.drawGlow(
          gx + wobble(i * 9.7, c.t * 0.6) * R * 0.55,
          rimY - R * (0.5 + i * 0.4),
          R * (0.45 + i * 0.15),
          gold,
          (0.1 + 0.05 * Math.sin(c.t * 1.7 + i * 2.1)) * entry,
        );
      }

      // Bubbles rise in five columns off the champagne surface.
      if (c.t < DUR - 1.2) {
        acc += c.dt * 16 * c.quality;
        while (acc >= 1) {
          acc -= 1;
          const col = c.rng.int(5);
          bubbles.spawn({
            x: gx + (col - 2) * R * 0.42 + (c.rng.next() - 0.5) * 6,
            y: rimY - 2,
            vx: (col - 2) * 7,
            vy: -(55 + c.rng.next() * 75),
            life: 1.2 + c.rng.next() * 1.8,
            size: 1.3 + c.rng.next() * 2.6,
            seed: c.rng.next(),
          });
        }
      }
      bubbles.update(c.dt, c.t, {
        update(pt, dt) {
          pt.x += wobble(pt.seed * 43, c.t * 1.5) * 24 * dt;
          if (pt.age > pt.life * 0.94) {
            // Pop: the bubble becomes a brief four-point sparkle.
            pt.dead = true;
            sparks.spawn({
              x: pt.x,
              y: pt.y,
              vx: 0,
              vy: -8,
              life: 0.45,
              size: 2.5 + pt.size * 1.4,
              rot: pt.seed * TAU,
              vr: 3,
              color: bright,
            });
          }
        },
      });
      bubbles.each((pt) => {
        ctx.globalAlpha = clamp01(1.4 - pt.age / pt.life) * 0.75;
        ctx.strokeStyle = withAlpha(gold, 0.9);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = withAlpha(bright, 0.9);
        ctx.beginPath();
        ctx.arc(pt.x - pt.size * 0.35, pt.y - pt.size * 0.35, pt.size * 0.22, 0, TAU);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Finale: the cork blows and gold sparkles fountain out.
      if (!popped && c.t >= POP) {
        popped = true;
        const n = Math.round(46 * c.quality);
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + (c.rng.next() - 0.5) * 1.7;
          const v = 130 + c.rng.next() * 260;
          sparks.spawn({
            x: gx,
            y: rimY - R * 1.5,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            life: 0.8 + c.rng.next() * 0.8,
            size: 2.5 + c.rng.next() * 3.5,
            rot: c.rng.next() * TAU,
            vr: (c.rng.next() - 0.5) * 8,
            color: [bright, gold, shadow][c.rng.int(3)]!,
          });
        }
      }
      const popU = (c.t - POP) / 0.6;
      if (popU >= 0 && popU < 1) {
        c.drawGlow(gx, rimY - R * 1.5, 60 + popU * 90, bright, (1 - popU) * 0.9);
      }
      const cu = c.t - POP;
      if (cu >= 0 && cu < 1.4) {
        // The cork itself tumbles up and away.
        ctx.save();
        ctx.translate(gx + cu * 190, rimY - R * 1.5 - 320 * cu + 250 * cu * cu);
        ctx.rotate(cu * 7);
        ctx.fillStyle = withAlpha(p.ink, 0.9);
        ctx.fillRect(-4, -5, 8, 10);
        ctx.restore();
      }

      sparks.update(c.dt, c.t, { gravity: 140, drag: 1.1 });
      sparks.each((pt) => {
        const a = 1 - pt.age / pt.life;
        ctx.globalAlpha = a;
        drawSparkle(ctx, pt.x, pt.y, pt.size * (0.5 + a * 0.5), pt.rot, pt.color);
        if (pt.size > 4) c.drawGlow(pt.x, pt.y, pt.size * 3, gold, a * 0.5);
      });
      ctx.globalAlpha = 1;
    },
  };
}

/* --- 3. gilded-fireworks ---------------------------------------------------------------
 * Shells climb on visible tracers and burst into deco patterns in rotation:
 * radial fans of tapered rays, concentric chevron rings, and heavy-drooping
 * palm-frond arcs — all in metallic golds with glow-sprite heads. */

interface Shell {
  t0: number;
  x: number;
  apexY: number;
  kind: number;
  tint: number;
  burstT: number;
}

interface RingBurst {
  x: number;
  y: number;
  t0: number;
}

function makeGildedFireworks(): Scene {
  let shells: Shell[] = [];
  let rings: RingBurst[] = [];
  let sparks: ParticleSystem;
  let dust: ParticleSystem;
  const DUR = 8;
  const RISE = 1.05;

  return {
    id: 'art-deco/gilded-fireworks',
    skin: 'art-deco',
    duration: DUR,
    init(c) {
      sparks = new ParticleSystem(Math.max(90, Math.round(200 * c.quality)));
      dust = new ParticleSystem(Math.max(60, Math.round(150 * c.quality)));
      rings = [];
      shells = [];
      const times = [0.3, 1.2, 2.1, 3, 3.9, 4.9, 5.8];
      for (let i = 0; i < times.length; i++) {
        shells.push({
          t0: times[i]! + c.rng.next() * 0.25,
          x: c.w * (0.18 + c.rng.next() * 0.64),
          apexY: c.h * (0.14 + c.rng.next() * 0.3),
          kind: i % 3,
          tint: c.rng.int(3),
          burstT: -1,
        });
      }
    },
    frame(c) {
      const { ctx, palette: p } = c;
      const tones = goldTones(p);

      for (const sh of shells) {
        const u = (c.t - sh.t0) / RISE;
        if (u <= 0) continue;
        if (u < 1) {
          // Rising tracer: bright head, glow, sputtering dust behind.
          const ty = lerp(c.h + 24, sh.apexY, easeOutCubic(u));
          const tx = sh.x + wobble(sh.t0 * 7, c.t * 2) * 6;
          c.drawGlow(tx, ty, 12, tones[1], 0.85);
          ctx.fillStyle = withAlpha(tones[0], 0.95);
          ctx.beginPath();
          ctx.arc(tx, ty, 2.2, 0, TAU);
          ctx.fill();
          if (c.rng.next() < 0.7 * c.quality) {
            dust.spawn({
              x: tx + (c.rng.next() - 0.5) * 3,
              y: ty + 4,
              vx: (c.rng.next() - 0.5) * 26,
              vy: 20 + c.rng.next() * 40,
              life: 0.35 + c.rng.next() * 0.4,
              size: 0.8 + c.rng.next() * 1.4,
              color: withAlpha(tones[2], 0.9),
            });
          }
          continue;
        }
        if (sh.burstT < 0) {
          sh.burstT = c.t;
          const tint = tones[sh.tint]!;
          if (sh.kind === 1) {
            // Concentric chevron rings + a scatter of loose embers.
            rings.push({ x: sh.x, y: sh.apexY, t0: c.t });
            for (let i = 0; i < Math.round(8 * c.quality); i++) {
              const a = c.rng.next() * TAU;
              const v = 60 + c.rng.next() * 60;
              sparks.spawn({
                x: sh.x, y: sh.apexY,
                vx: Math.cos(a) * v,
                vy: Math.sin(a) * v,
                life: 0.6,
                size: 1.6,
                color: tones[0],
                seed: c.rng.next() * 0.9,
              });
            }
          } else if (sh.kind === 0) {
            // Radial fan of tapered rays.
            const n = Math.max(10, Math.round(16 * c.quality));
            for (let j = 0; j < n; j++) {
              const a = (j / n) * TAU + (c.rng.next() - 0.5) * 0.08;
              const v = 220 + c.rng.next() * 70;
              sparks.spawn({
                x: sh.x, y: sh.apexY,
                vx: Math.cos(a) * v,
                vy: Math.sin(a) * v,
                life: 1.1 + c.rng.next() * 0.4,
                size: 2.4 + c.rng.next() * 1.2,
                color: tint,
                seed: c.rng.next() * 0.9,
              });
            }
          } else {
            // Palm fronds: an upward fan that droops hard under gravity.
            const n = Math.max(6, Math.round(9 * c.quality));
            for (let j = 0; j < n; j++) {
              const a = -Math.PI * (0.16 + 0.68 * (j / (n - 1))) + (c.rng.next() - 0.5) * 0.12;
              const v = 180 + c.rng.next() * 70;
              sparks.spawn({
                x: sh.x, y: sh.apexY,
                vx: Math.cos(a) * v,
                vy: Math.sin(a) * v,
                life: 1.7 + c.rng.next() * 0.4,
                size: 2.8 + c.rng.next() * 0.8,
                color: tint,
                seed: 1 + c.rng.next() * 0.9,
              });
            }
          }
        }
        const fu = (c.t - sh.burstT) / 0.4;
        if (fu >= 0 && fu < 1) {
          c.drawGlow(sh.x, sh.apexY, 46 + fu * 110, tones[0], (1 - fu) * 0.9);
        }
      }

      // Spark physics: fans droop gently, fronds droop hard; both shed dust.
      sparks.update(c.dt, c.t, {
        drag: 0.9,
        update(pt, dt) {
          pt.vy += (Math.floor(pt.seed) === 0 ? 120 : 260) * dt;
          if (c.rng.next() < 0.12 * c.quality) {
            dust.spawn({
              x: pt.x,
              y: pt.y,
              vx: (c.rng.next() - 0.5) * 14,
              vy: 10 + c.rng.next() * 24,
              life: 0.3 + c.rng.next() * 0.35,
              size: 0.7 + c.rng.next(),
              color: withAlpha(tones[2], 0.85),
            });
          }
        },
      });

      dust.update(c.dt, c.t, { gravity: 90, drag: 0.8 });
      dust.each((pt) => {
        ctx.globalAlpha = (1 - pt.age / pt.life) * 0.8;
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      });
      ctx.globalAlpha = 1;

      // Sparks: tapered metallic tails + glowing heads.
      ctx.lineCap = 'round';
      sparks.each((pt) => {
        const a = 1 - pt.age / pt.life;
        const tail = Math.floor(pt.seed) === 1 ? 0.16 : 0.1;
        const SEGS = 5;
        for (let s = 0; s < SEGS; s++) {
          const q0 = (s / SEGS) * tail;
          const q1 = ((s + 1) / SEGS) * tail;
          ctx.strokeStyle = withAlpha(pt.color, a * 0.85 * (1 - s / SEGS));
          ctx.lineWidth = pt.size * (1 - (s / SEGS) * 0.75);
          ctx.beginPath();
          ctx.moveTo(pt.x - pt.vx * q0, pt.y - pt.vy * q0);
          ctx.lineTo(pt.x - pt.vx * q1, pt.y - pt.vy * q1);
          ctx.stroke();
        }
        c.drawGlow(pt.x, pt.y, pt.size * 5.5, pt.color, a * 0.7);
        ctx.fillStyle = withAlpha(mixColor(pt.color, '#ffffff', 0.4), a);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * 0.7, 0, TAU);
        ctx.fill();
      });

      // Chevron-ring bursts, drawn (not particled) for crisp deco geometry.
      for (const rb of rings) {
        for (let ring = 0; ring < 3; ring++) {
          const ru = (c.t - rb.t0 - ring * 0.16) / 0.9;
          if (ru <= 0 || ru >= 1) continue;
          const rad = easeOutCubic(ru) * (66 + ring * 44);
          const marks = 10 + ring * 4;
          ctx.strokeStyle = withAlpha(tones[ring % 3]!, (1 - ru) * 0.95);
          ctx.lineWidth = 2.2 - ring * 0.4;
          for (let m = 0; m < marks; m++) {
            const a = (m / marks) * TAU + ring * 0.3;
            ctx.save();
            ctx.translate(
              rb.x + Math.cos(a) * rad,
              rb.y + Math.sin(a) * rad + easeOutCubic(ru) * 14,
            );
            ctx.rotate(a);
            ctx.beginPath();
            ctx.moveTo(-5, -5);
            ctx.lineTo(4, 0);
            ctx.lineTo(-5, 5);
            ctx.stroke();
            ctx.restore();
          }
        }
        const cg = (c.t - rb.t0) / 1.2;
        if (cg < 1) c.drawGlow(rb.x, rb.y, 30 * (1 - cg) + 8, tones[0], (1 - cg) * 0.8);
      }
    },
  };
}

export const artDecoScenes: Scene[] = [makeSunburstMarquee(), makeChampagne(), makeGildedFireworks()];
