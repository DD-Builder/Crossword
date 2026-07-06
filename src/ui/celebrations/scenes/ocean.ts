/** Ocean (sea glass & deep water) victory scenes: bioluminescence,
 * fish-school, tide-letters. Everything moves like slow water — sine swells,
 * steering currents, and foam that leaves marks in the sand. */

import type { Ctx2D, Scene, SceneContext } from '../types.ts';
import {
  ParticleSystem, TAU, clamp01, easeInOutSine, easeOutCubic, flow, lerp,
  mixColor, withAlpha, wobble,
} from '../particles.ts';

/* --- 1. bioluminescence --------------------------------------------------------
 * A dark translucent swell sweeps the screen and everything it touches blooms
 * glowing plankton; a brighter counter-swell follows and re-excites them, then
 * stragglers keep twinkling out. Subtle wash on light mode, luminous on dark. */

interface Plankton {
  x: number;
  y: number;
  size: number;
  phase: number;
  tint: number;
  /** Last excitation time, or -1 while still dark. */
  lit: number;
  hit1: boolean;
  hit2: boolean;
}

function makeBioluminescence(): Scene {
  let dots: Plankton[] = [];

  // Sine-edged front: the swell's leading edge meanders with depth.
  const edge = (y: number, t: number, dir: number): number =>
    Math.sin(y * 0.011 + t * 1.4 * dir) * 55 + Math.sin(y * 0.031 - t * 0.9) * 22;

  const drawSwell = (c: SceneContext, frontX: number, dir: number, color: string, alpha: number): void => {
    const { ctx } = c;
    const band = c.w * 0.22;
    ctx.fillStyle = withAlpha(color, alpha);
    ctx.beginPath();
    ctx.moveTo(frontX + edge(-20, c.t, dir), -20);
    for (let y = 0; y <= c.h + 28; y += 28) ctx.lineTo(frontX + edge(y, c.t, dir), y);
    for (let y = c.h + 28; y >= -20; y -= 28) {
      ctx.lineTo(frontX - dir * band + edge(y, c.t + 2.2, dir) * 0.7, y);
    }
    ctx.closePath();
    ctx.fill();
  };

  return {
    id: 'ocean/bioluminescence',
    skin: 'ocean',
    duration: 7,
    init(c) {
      dots = [];
      const n = Math.round(150 * c.quality);
      for (let i = 0; i < n; i++) {
        dots.push({
          x: c.rng.next() * c.w,
          y: c.rng.next() * c.h,
          size: 1.2 + c.rng.next() * 2.4,
          phase: c.rng.next() * 100,
          tint: c.rng.next(),
          lit: -1,
          hit1: false,
          hit2: false,
        });
      }
    },
    frame(c) {
      const { ctx, palette: p } = c;

      // Swell 1: a dark push, left → right.
      const k1 = clamp01(c.t / 3.4);
      const f1 = lerp(-c.w * 0.3, c.w * 1.35, easeInOutSine(k1));
      if (k1 < 1) drawSwell(c, f1, 1, mixColor(p.accent, p.cellBlock, 0.55), p.dark ? 0.2 : 0.08);

      // Swell 2: brighter counter-swell, right → left.
      const k2 = clamp01((c.t - 2.4) / 3.4);
      const f2 = lerp(c.w * 1.35, -c.w * 0.35, easeInOutSine(k2));
      if (k2 > 0 && k2 < 1) {
        drawSwell(c, f2, -1, mixColor(p.accent, p.good, 0.45), p.dark ? 0.24 : 0.1);
      }

      for (const d of dots) {
        if (!d.hit1 && k1 > 0 && f1 + edge(d.y, c.t, 1) >= d.x) {
          d.hit1 = true;
          d.lit = c.t;
        }
        if (!d.hit2 && k2 > 0 && f2 + edge(d.y, c.t, -1) <= d.x) {
          d.hit2 = true;
          d.lit = c.t;
        }
        if (d.lit < 0) continue;
        const age = c.t - d.lit;
        const tw = 0.5 + 0.5 * wobble(d.phase, c.t * 1.8);
        // Bright pulse on excitation, decaying to a faint twinkle floor.
        const a = clamp01(Math.exp(-age * 0.75) * (0.5 + 0.5 * tw) + 0.14 * tw);
        const [fx, fy] = flow(d.x, d.y, c.t, 0.006);
        const x = d.x + fx * 9;
        const y = d.y + fy * 9;
        const col = mixColor(p.accent, p.good, d.tint * 0.7);
        c.drawGlow(x, y, d.size * (5 + tw * 2.5), col, a * (p.dark ? 1 : 0.55));
        ctx.fillStyle = withAlpha(mixColor(col, p.ink, 0.35), a);
        ctx.beginPath();
        ctx.arc(x, y, d.size * (0.8 + 0.35 * tw), 0, TAU);
        ctx.fill();
      }
    },
  };
}

/* --- 2. fish-school --------------------------------------------------------------
 * A boids-lite school streams in from one side, visibly parts around the
 * circle where the celebration modal rises, re-forms, loops back once and
 * exits. Steering = moving attractor on a curved path + per-fish wobble +
 * radial avoidance of the center circle — no O(n²) neighbor checks. */

interface Fish {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Fixed slot in the school, relative to the attractor. */
  ox: number;
  oy: number;
  seed: number;
  size: number;
  bright: boolean;
}

interface Pt {
  x: number;
  y: number;
}

/** In → around the middle → swing back low → out the same side (fractions). */
const SCHOOL_PATH: Pt[] = [
  { x: -0.18, y: 0.64 }, { x: 0.22, y: 0.5 }, { x: 0.52, y: 0.3 },
  { x: 0.85, y: 0.3 }, { x: 0.95, y: 0.55 }, { x: 0.72, y: 0.72 },
  { x: 0.42, y: 0.74 }, { x: 0.16, y: 0.62 }, { x: -0.25, y: 0.42 },
];

/** Catmull-Rom through the waypoints, u in [0, 1]. */
function pathPoint(pts: Pt[], u: number): Pt {
  const n = pts.length - 1;
  const f = clamp01(u) * n;
  const i = Math.min(n - 1, Math.floor(f));
  const k = f - i;
  const p0 = pts[Math.max(0, i - 1)]!;
  const p1 = pts[i]!;
  const p2 = pts[i + 1]!;
  const p3 = pts[Math.min(n, i + 2)]!;
  const cr = (a: number, b: number, cc: number, d: number): number =>
    0.5 * (2 * b + (-a + cc) * k + (2 * a - 5 * b + 4 * cc - d) * k * k +
      (-a + 3 * b - 3 * cc + d) * k * k * k);
  return { x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y) };
}

function makeFishSchool(): Scene {
  let school: Fish[] = [];
  let bubbles: ParticleSystem;

  return {
    id: 'ocean/fish-school',
    skin: 'ocean',
    duration: 7.5,
    init(c) {
      bubbles = new ParticleSystem(Math.round(110 * c.quality));
      school = [];
      const n = Math.round(80 * c.quality);
      const start = pathPoint(SCHOOL_PATH, 0);
      const spread = Math.min(c.w, c.h) * 0.11;
      for (let i = 0; i < n; i++) {
        const ang = c.rng.next() * TAU;
        const rad = Math.sqrt(c.rng.next()) * spread;
        school.push({
          x: start.x * c.w + (c.rng.next() - 0.5) * spread * 3,
          y: start.y * c.h + (c.rng.next() - 0.5) * spread * 2,
          vx: 60,
          vy: 0,
          ox: Math.cos(ang) * rad * 1.7,
          oy: Math.sin(ang) * rad,
          seed: c.rng.next(),
          size: 5 + c.rng.next() * 4,
          bright: c.rng.next() > 0.87,
        });
      }
    },
    frame(c) {
      const { ctx, palette: p } = c;
      const a0 = pathPoint(SCHOOL_PATH, c.t / 7.1);
      const ax = a0.x * c.w;
      const ay = a0.y * c.h;
      // Invisible obstacle where the modal rises (fully firm by ~1.4s).
      const cx = c.w / 2;
      const cy = c.h * 0.5;
      const r = Math.min(c.w, c.h) * 0.24;
      const avoid = 900 * clamp01(c.t / 1.2);

      // Bubble trails first, behind the bodies.
      bubbles.update(c.dt, c.t, {
        gravity: -50,
        update(pt, dt) {
          pt.x += wobble(pt.seed * 43, c.t * 2) * 14 * dt;
        },
      });
      bubbles.each((pt) => {
        ctx.strokeStyle = withAlpha(p.accent, 0.3 * (1 - pt.age / pt.life));
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
        ctx.stroke();
      });

      for (const f of school) {
        // Seek the slot, damped; wobble stands in for neighbor jostle.
        let sx = (ax + f.ox - f.x) * 3.4 - f.vx * 1.7 + wobble(f.seed * 17, c.t) * 60;
        let sy = (ay + f.oy - f.y) * 3.4 - f.vy * 1.7 + wobble(f.seed * 29, c.t * 1.1) * 60;
        const dx = f.x - cx;
        const dy = f.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < r) {
          const push = ((r - dist) / r) * avoid;
          sx += (dx / dist) * push;
          sy += (dy / dist) * push;
        }
        f.vx += sx * c.dt;
        f.vy += sy * c.dt;
        const sp = Math.hypot(f.vx, f.vy) || 1;
        if (sp > 460) {
          f.vx *= 460 / sp;
          f.vy *= 460 / sp;
        }
        f.x += f.vx * c.dt;
        f.y += f.vy * c.dt;

        if (c.rng.next() < 0.01 && bubbles.alive < 90) {
          bubbles.spawn({
            x: f.x, y: f.y, vy: -20, life: 1 + c.rng.next(),
            size: 1 + c.rng.next() * 1.8, seed: c.rng.next(),
          });
        }

        // Tapered triangle body with a sin tail-flick.
        const s = f.size;
        const flick = Math.sin(c.t * 9 + f.seed * 40) * s * 0.5;
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(Math.atan2(f.vy, f.vx));
        ctx.fillStyle = f.bright
          ? withAlpha(p.accent, 0.95)
          : withAlpha(mixColor(p.ink, p.accent, 0.2 + f.seed * 0.35), 0.8);
        ctx.beginPath();
        ctx.moveTo(s * 1.4, 0);
        ctx.quadraticCurveTo(-s * 0.1, -s * 0.55, -s * 1.2, flick - s * 0.25);
        ctx.lineTo(-s * 0.7, flick * 0.5);
        ctx.lineTo(-s * 1.2, flick + s * 0.25);
        ctx.quadraticCurveTo(-s * 0.1, s * 0.55, s * 1.4, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        if (f.bright) c.drawGlow(f.x, f.y, s * 4, p.accent, 0.25);
      }
    },
  };
}

/* --- 3. tide-letters ---------------------------------------------------------------
 * A foam line washes up from the bottom to ~55% height and recedes, leaving
 * SOLVED written in the wet sand — glistening imprints with sparkle glints.
 * A second smaller wave adds the solve time; gulls cross the top. */

interface Glint {
  u: number;
  v: number;
  phase: number;
  line: 0 | 1;
}

interface Gull {
  y0: number;
  s: number;
  delay: number;
  dir: number;
  phase: number;
}

function makeTideLetters(): Scene {
  let spray: ParticleSystem;
  let glints: Glint[] = [];
  let gulls: Gull[] = [];

  const drawGull = (ctx: Ctx2D, x: number, y: number, s: number, t: number, phase: number, color: string): void => {
    const f = 0.35 + 0.65 * Math.abs(Math.sin(t * 5 + phase));
    const dy = s * 0.3 * (1 - f);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, s * 0.16);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - s, y + dy);
    ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.55 * f, x, y);
    ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.55 * f, x + s, y + dy);
    ctx.stroke();
  };

  return {
    id: 'ocean/tide-letters',
    skin: 'ocean',
    duration: 8,
    init(c) {
      spray = new ParticleSystem(Math.round(140 * c.quality));
      glints = [];
      for (let i = 0; i < 30; i++) {
        glints.push({
          u: c.rng.next(),
          v: c.rng.next(),
          phase: c.rng.next() * 100,
          line: c.rng.next() > 0.3 ? 0 : 1,
        });
      }
      gulls = [];
      for (let i = 0; i < 3; i++) {
        gulls.push({
          y0: 0.07 + c.rng.next() * 0.13,
          s: 11 + c.rng.next() * 8,
          delay: i * 1.6 + c.rng.next() * 0.8,
          dir: i % 2 === 0 ? 1 : -1,
          phase: c.rng.next() * 10,
        });
      }
    },
    frame(c) {
      const { ctx, palette: p } = c;
      const foamCol = p.dark ? p.ink : p.surface;

      // Two washes: big one to 55%, small one to 70%, both receding fully.
      const up1 = easeOutCubic(clamp01((c.t - 0.2) / 1.5));
      const dn1 = easeInOutSine(clamp01((c.t - 2.1) / 1.4));
      const lvl1 = lerp(lerp(1.1, 0.55, up1), 1.1, dn1);
      const up2 = easeOutCubic(clamp01((c.t - 4.3) / 1.1));
      const dn2 = easeInOutSine(clamp01((c.t - 5.7) / 1.2));
      const lvl2 = lerp(lerp(1.1, 0.7, up2), 1.1, dn2);
      const lvl = Math.min(lvl1, lvl2);
      const edgeY = (x: number): number =>
        lvl * c.h + Math.sin(x * 0.02 + c.t * 2.6) * 8 + wobble(x * 0.017, c.t * 0.8) * 6;

      if (lvl < 1.06) {
        // Wet sheet below the foam line.
        ctx.fillStyle = withAlpha(p.accent, p.dark ? 0.16 : 0.1);
        ctx.beginPath();
        ctx.moveTo(-10, edgeY(-10));
        for (let x = 0; x <= c.w + 24; x += 24) ctx.lineTo(x, edgeY(x));
        ctx.lineTo(c.w + 10, c.h + 10);
        ctx.lineTo(-10, c.h + 10);
        ctx.closePath();
        ctx.fill();
        // Foam: overlapping white-capped arcs along the irregular edge.
        for (let x = -10; x <= c.w + 20; x += 20) {
          const y = edgeY(x);
          const rr = 7 + 4 * Math.sin(x * 0.09 + c.t * 3.1);
          ctx.fillStyle = withAlpha(foamCol, 0.5 + 0.2 * Math.sin(x * 0.05 - c.t * 2));
          ctx.beginPath();
          ctx.arc(x, y, Math.max(2, rr), 0, TAU);
          ctx.fill();
        }
        // Spray while a wave is actively climbing.
        const climbing = (up1 > 0 && up1 < 1 && dn1 === 0) || (up2 > 0 && up2 < 1 && dn2 === 0);
        if (climbing && spray.alive < 110) {
          for (let i = 0; i < Math.round(4 * c.quality); i++) {
            const x = c.rng.next() * c.w;
            spray.spawn({
              x, y: edgeY(x), vx: (c.rng.next() - 0.5) * 60, vy: -60 - c.rng.next() * 120,
              life: 0.4 + c.rng.next() * 0.5, size: 1 + c.rng.next() * 2.2,
            });
          }
        }
      }
      spray.update(c.dt, c.t, { gravity: 300, drag: 0.8 });
      spray.each((pt) => {
        ctx.fillStyle = withAlpha(foamCol, 0.7 * (1 - pt.age / pt.life));
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
        ctx.fill();
      });

      // Wet-sand imprints revealed as each wave pulls back.
      const word = 'SOLVED';
      const fontPx = Math.min(120, (c.w * 0.8) / (word.length * 0.62));
      const textW = word.length * fontPx * 0.62;
      const y1 = c.h * 0.6;
      const y2 = c.h * 0.72;
      const reveal1 = clamp01((c.t - 2.5) / 1.2);
      const reveal2 = c.timeText ? clamp01((c.t - 5.9) / 1) : 0;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      if (reveal1 > 0) {
        const shimmer = 0.3 + 0.07 * wobble(3.7, c.t * 1.3);
        ctx.font = `900 ${Math.round(fontPx)}px ${p.fontDisplay}`;
        ctx.fillStyle = withAlpha(foamCol, 0.22 * reveal1); // glisten highlight
        ctx.fillText(word, c.w / 2, y1 - 2);
        ctx.fillStyle = withAlpha(p.ink, shimmer * reveal1);
        ctx.fillText(word, c.w / 2, y1);
      }
      if (reveal2 > 0) {
        ctx.font = `700 ${Math.round(fontPx * 0.36)}px ${p.fontDisplay}`;
        ctx.fillStyle = withAlpha(p.ink, 0.32 * reveal2);
        ctx.fillText(c.timeText, c.w / 2, y2);
      }
      // Sparkle glints scattered over the drying imprints.
      const glintCol = mixColor(p.cellSelected, foamCol, 0.4);
      for (const g of glints) {
        const rev = g.line === 0 ? reveal1 : reveal2;
        if (rev <= 0) continue;
        const blink = Math.max(0, wobble(g.phase, c.t * 2.2)) ** 3;
        if (blink < 0.05) continue;
        const gw = g.line === 0 ? textW : textW * 0.4;
        const gy = g.line === 0 ? y1 - fontPx * 0.35 : y2 - fontPx * 0.14;
        const gh = g.line === 0 ? fontPx * 0.7 : fontPx * 0.3;
        c.drawGlow(
          c.w / 2 + (g.u - 0.5) * gw,
          gy + (g.v - 0.5) * gh,
          4 + 9 * blink,
          glintCol,
          blink * rev,
        );
      }

      // Gulls: two-arc silhouettes crossing the top.
      for (const g of gulls) {
        const gk = clamp01((c.t - g.delay) / 6.5);
        if (gk <= 0 || gk >= 1) continue;
        const x = g.dir > 0 ? lerp(-0.12 * c.w, 1.12 * c.w, gk) : lerp(1.12 * c.w, -0.12 * c.w, gk);
        const y = g.y0 * c.h + wobble(g.phase, c.t * 0.5) * 12;
        drawGull(ctx, x, y, g.s, c.t, g.phase, withAlpha(p.ink, 0.55));
      }
    },
  };
}

export const oceanScenes: Scene[] = [makeBioluminescence(), makeFishSchool(), makeTideLetters()];
