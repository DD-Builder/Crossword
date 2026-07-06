/** Mono (brutalist black & white) victory scenes: domino-run, ink-bloom,
 * ascii-fireworks. Strict grayscale — every mark is the skin's ink at some
 * alpha, so light mode reads as ink on paper and dark mode as chalk on slate. */

import type { Scene } from '../types.ts';
import {
  ParticleSystem, TAU, clamp01, easeInCubic, easeOutCubic, lerp,
  withAlpha, wobble,
} from '../particles.ts';

/* --- shared: Catmull-Rom path sampling ---------------------------------------- */

interface Pt {
  x: number;
  y: number;
}

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

/* --- 1. domino-run --------------------------------------------------------------
 * A serpentine chain of standing dominoes topples in sequence (plan view: each
 * slab lays out along the travel direction), forks into two racing branches,
 * slows for drama, and converges on an oversized tile that slams down to
 * reveal a check mark. Every impact rings a faint shockwave. */

interface Domino {
  x: number;
  y: number;
  ang: number;
  trig: number;
  hit: boolean;
}

const MAIN_PATH: Pt[] = [
  { x: 0.10, y: 0.14 }, { x: 0.38, y: 0.09 }, { x: 0.72, y: 0.13 },
  { x: 0.88, y: 0.26 }, { x: 0.74, y: 0.40 }, { x: 0.40, y: 0.42 },
  { x: 0.15, y: 0.50 }, { x: 0.13, y: 0.66 }, { x: 0.30, y: 0.74 },
];
const LEFT_PATH: Pt[] = [
  { x: 0.30, y: 0.74 }, { x: 0.40, y: 0.88 }, { x: 0.55, y: 0.91 }, { x: 0.62, y: 0.84 },
];
const RIGHT_PATH: Pt[] = [
  { x: 0.30, y: 0.74 }, { x: 0.42, y: 0.63 }, { x: 0.56, y: 0.61 }, { x: 0.63, y: 0.70 },
];
const FINAL_AT: Pt = { x: 0.64, y: 0.77 };

function makeDominoRun(): Scene {
  let chain: Domino[] = [];
  let rings: ParticleSystem;
  let finalT = 6;
  let unit = 20;
  let slammed = false;

  const layChain = (
    path: Pt[], n: number, t0: number, gap: (i: number) => number, w: number, h: number,
  ): { tiles: Domino[]; end: number } => {
    const tiles: Domino[] = [];
    let t = t0;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const a = pathPoint(path, u);
      const b = pathPoint(path, Math.min(1, u + 0.01));
      tiles.push({
        x: a.x * w,
        y: a.y * h,
        ang: Math.atan2((b.y - a.y) * h, (b.x - a.x) * w),
        trig: t,
        hit: false,
      });
      t += gap(i);
    }
    return { tiles, end: t };
  };

  return {
    id: 'mono/domino-run',
    skin: 'mono',
    duration: 8,
    init(c) {
      rings = new ParticleSystem(Math.round(70 * c.quality));
      slammed = false;
      unit = Math.min(c.w, c.h) / 24;
      const main = layChain(MAIN_PATH, 36, 0.4, () => 0.075, c.w, c.h);
      // The run forks: two branches race around opposite sides, and both
      // brake over their last few tiles for the pre-finale hush.
      const brake = (n: number, base: number) => (i: number): number =>
        i >= n - 6 ? lerp(base, base * 2.3, (i - (n - 6)) / 5) : base;
      const left = layChain(LEFT_PATH, 12, main.end + 0.05, brake(12, 0.085), c.w, c.h);
      const right = layChain(RIGHT_PATH, 12, main.end + 0.05, brake(12, 0.098), c.w, c.h);
      chain = [...main.tiles, ...left.tiles, ...right.tiles];
      finalT = Math.max(left.end, right.end) + 0.35;
    },
    frame(c) {
      const { ctx, palette: p } = c;

      // Impact shockwaves, behind the tiles.
      rings.update(c.dt, c.t);
      rings.each((pt) => {
        const k = pt.age / pt.life;
        ctx.strokeStyle = withAlpha(p.ink, 0.3 * (1 - k));
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * easeOutCubic(k), 0, TAU);
        ctx.stroke();
      });

      const tileL = unit * 1.35;
      const thick = unit * 0.34;
      const tw = unit * 0.95;
      for (const d of chain) {
        const k = clamp01((c.t - d.trig) / 0.38);
        const fall = easeInCubic(k);
        if (k >= 1 && !d.hit) {
          d.hit = true;
          rings.spawn({ x: d.x, y: d.y, life: 0.5, size: unit * 2.4 });
        }
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.ang);
        // Standing = a thin slab across the path; toppled = laid out along it.
        // The face lightens as it turns up toward the viewer.
        const len = thick + (tileL - thick) * fall;
        ctx.fillStyle = withAlpha(p.ink, 0.92 - 0.5 * fall);
        ctx.fillRect(-thick / 2, -tw / 2, len, tw);
        ctx.strokeStyle = withAlpha(p.ink, 0.85);
        ctx.lineWidth = 1;
        ctx.strokeRect(-thick / 2, -tw / 2, len, tw);
        if (fall > 0.6) { // pip line across the fallen face
          ctx.fillStyle = withAlpha(p.ink, 0.8);
          ctx.fillRect(-thick / 2 + len * 0.5 - 0.75, -tw / 2 + 2, 1.5, tw - 4);
        }
        ctx.restore();
      }

      // Finale: the oversized tile slams down and reveals a check mark.
      const fx = FINAL_AT.x * c.w;
      const fy = FINAL_AT.y * c.h;
      const fk = clamp01((c.t - finalT) / 0.45);
      if (fk > 0) {
        const S = Math.min(c.w, c.h) * 0.17;
        if (fk >= 1 && !slammed) {
          slammed = true;
          rings.spawn({ x: fx, y: fy, life: 0.7, size: S * 2.2 });
          rings.spawn({ x: fx, y: fy, life: 0.9, size: S * 3.2 });
        }
        const sc = lerp(2.6, 1, easeInCubic(fk));
        ctx.save();
        ctx.translate(fx, fy);
        ctx.scale(sc, sc);
        ctx.globalAlpha = 0.25 + 0.75 * fk;
        ctx.fillStyle = withAlpha(p.ink, 0.95);
        ctx.fillRect(-S / 2, -S / 2, S, S);
        ctx.strokeStyle = withAlpha(p.bg, 0.9);
        ctx.lineWidth = Math.max(2, S * 0.04);
        ctx.strokeRect(-S / 2 + S * 0.07, -S / 2 + S * 0.07, S * 0.86, S * 0.86);
        const ck = clamp01((c.t - finalT - 0.6) / 0.5);
        if (ck > 0) {
          const a0 = { x: -S * 0.26, y: S * 0.02 };
          const a1 = { x: -S * 0.06, y: S * 0.22 };
          const a2 = { x: S * 0.3, y: -S * 0.22 };
          ctx.strokeStyle = withAlpha(p.bg, 0.95);
          ctx.lineWidth = S * 0.11;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(a0.x, a0.y);
          const seg1 = clamp01(ck / 0.45);
          ctx.lineTo(lerp(a0.x, a1.x, seg1), lerp(a0.y, a1.y, seg1));
          if (ck > 0.45) {
            const seg2 = clamp01((ck - 0.45) / 0.55);
            ctx.lineTo(lerp(a1.x, a2.x, seg2), lerp(a1.y, a2.y, seg2));
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        if (fk >= 1) {
          c.drawGlow(fx, fy, S * 1.4, p.ink, 0.25 * clamp01(1 - (c.t - finalT - 0.45) * 0.8));
        }
      }
    },
  };
}

/* --- 2. ink-bloom -----------------------------------------------------------------
 * Ink drops plummet, squash on impact, and bloom into feathery blots — dozens
 * of radial spikes creeping outward with per-spike wobble, layered alpha so
 * overlaps deepen. A final large center drop blooms through the others. */

interface Blot {
  x: number;
  y: number;
  at: number;
  maxR: number;
  big: boolean;
  spikes: number[];
  sat: { a: number; d: number; r: number }[];
}

function makeInkBloom(): Scene {
  let blots: Blot[] = [];

  return {
    id: 'mono/ink-bloom',
    skin: 'mono',
    duration: 7.5,
    init(c) {
      blots = [];
      const R = Math.min(c.w, c.h);
      const n = Math.max(4, Math.round(6 * c.quality));
      for (let i = 0; i <= n; i++) {
        const big = i === n;
        const spikes: number[] = [];
        const ns = 30 + c.rng.int(21);
        for (let s = 0; s < ns; s++) spikes.push(0.5 + c.rng.next() * 0.5);
        const sat: Blot['sat'] = [];
        const nSat = 3 + c.rng.int(3);
        for (let s = 0; s < nSat; s++) {
          sat.push({ a: c.rng.next() * TAU, d: 1.1 + c.rng.next() * 0.5, r: 0.02 + c.rng.next() * 0.03 });
        }
        blots.push({
          x: big ? c.w / 2 : c.w * (0.15 + c.rng.next() * 0.7),
          y: big ? c.h * 0.5 : c.h * (0.2 + c.rng.next() * 0.55),
          at: big ? 4.2 : 0.25 + i * 0.62 + c.rng.next() * 0.2,
          maxR: big ? R * 0.3 : R * (0.09 + c.rng.next() * 0.06),
          big,
          spikes,
          sat,
        });
      }
    },
    frame(c) {
      const { ctx, palette: p } = c;
      // p.ink is black on paper, white on slate — the palette does the flip.
      const FALL = 0.45;
      for (const b of blots) {
        const since = c.t - b.at;
        if (since < 0) continue;
        if (since < FALL) {
          // Plummet: a droplet stretching with speed.
          const fk = since / FALL;
          ctx.fillStyle = withAlpha(p.ink, 0.85);
          ctx.beginPath();
          ctx.ellipse(b.x, lerp(-30, b.y, easeInCubic(fk)), 3.5, 7 + 9 * fk, 0, 0, TAU);
          ctx.fill();
          continue;
        }
        const land = since - FALL;
        if (land < 0.14) { // impact squash, a beat before the bloom takes over
          const q = 1 - land / 0.14;
          ctx.fillStyle = withAlpha(p.ink, 0.85);
          ctx.beginPath();
          ctx.ellipse(b.x, b.y, 6 + 12 * (1 - q), 3 + 4 * q, 0, 0, TAU);
          ctx.fill();
        }
        // Feathered blot: radial spikes wobble as the ink creeps outward.
        const bk = easeOutCubic(clamp01(land / (b.big ? 2.8 : 2.4)));
        if (bk <= 0) continue;
        const R = b.maxR * bk;
        const ns = b.spikes.length;
        ctx.fillStyle = withAlpha(p.ink, b.big ? 0.42 : 0.3);
        ctx.beginPath();
        for (let i = 0; i <= ns; i++) {
          const j = i % ns;
          const a = (j / ns) * TAU;
          const feather = j % 2 === 0 ? 1 : 0.7;
          const r = R * b.spikes[j]! * feather * (1 + 0.12 * wobble(b.x + j * 7.1, c.t * 0.8));
          const px = b.x + Math.cos(a) * r;
          const py = b.y + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        // Dense core.
        ctx.fillStyle = withAlpha(p.ink, 0.5);
        ctx.beginPath();
        ctx.arc(b.x, b.y, R * 0.42, 0, TAU);
        ctx.fill();
        // Satellite droplets flung on impact.
        for (const s of b.sat) {
          const sr = Math.min(1, bk * 1.6);
          ctx.fillStyle = withAlpha(p.ink, 0.55 * sr);
          ctx.beginPath();
          ctx.arc(
            b.x + Math.cos(s.a) * b.maxR * s.d * sr,
            b.y + Math.sin(s.a) * b.maxR * s.d * sr,
            b.maxR * s.r * (2 + sr) * 0.4,
            0, TAU,
          );
          ctx.fill();
        }
      }
    },
  };
}

/* --- 3. ascii-fireworks -------------------------------------------------------------
 * Fireworks whose particles are glyphs: shells rise as ':' columns and burst
 * into expanding rings of characters that decay to '.' with age. Grayscale
 * only — brightness is alpha. A faint '> solved.' types out bottom-left. */

interface Shell {
  x: number;
  apex: number;
  launch: number;
  rise: number;
  big: boolean;
  burst: boolean;
}

interface Glyph {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  ch: string;
  size: number;
}

const BURST_CHARS = ['#', '@', 'X', '*', '+'];

function makeAsciiFireworks(): Scene {
  let shells: Shell[] = [];
  let glyphs: Glyph[] = [];

  return {
    id: 'mono/ascii-fireworks',
    skin: 'mono',
    duration: 8,
    init(c) {
      glyphs = [];
      shells = [];
      const xs = [0.22, 0.72, 0.42, 0.85, 0.14];
      for (let i = 0; i < 5; i++) {
        shells.push({
          x: (xs[i]! + (c.rng.next() - 0.5) * 0.06) * c.w,
          apex: c.h * (0.2 + c.rng.next() * 0.18),
          launch: 0.3 + i * 0.85 + c.rng.next() * 0.2,
          rise: 0.85 + c.rng.next() * 0.2,
          big: false,
          burst: false,
        });
      }
      shells.push({ x: c.w * 0.5, apex: c.h * 0.3, launch: 4.7, rise: 1, big: true, burst: false });
    },
    frame(c) {
      const { ctx, palette: p } = c;
      const mono = '"Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (const s of shells) {
        const rk = (c.t - s.launch) / s.rise;
        if (rk <= 0) continue;
        if (rk < 1) {
          // Rising shell: a column of ':' climbing, tail fading out.
          const head = lerp(c.h + 16, s.apex, easeOutCubic(rk));
          ctx.font = `13px ${mono}`;
          for (let i = 0; i < 7; i++) {
            const gy = head + i * 15;
            if (gy > c.h) break;
            ctx.fillStyle = withAlpha(p.ink, 0.75 * (1 - i / 7) * (0.4 + 0.6 * rk));
            ctx.fillText(':', s.x + wobble(s.x + i, c.t * 3) * 1.5, gy);
          }
        } else if (!s.burst) {
          s.burst = true;
          if (glyphs.length > 300) glyphs = glyphs.filter((g) => g.age < g.life);
          const budget = Math.round((s.big ? 64 : 34) * c.quality);
          const ringDefs = s.big
            ? [
                { n: Math.round(budget * 0.45), v: 150 },
                { n: Math.round(budget * 0.33), v: 100 },
                { n: Math.round(budget * 0.22), v: 55 },
              ]
            : [
                { n: Math.round(budget * 0.6), v: 120 },
                { n: Math.round(budget * 0.4), v: 70 },
              ];
          for (const ring of ringDefs) {
            for (let i = 0; i < ring.n; i++) {
              if (glyphs.length >= 380) break;
              const a = (i / ring.n) * TAU + c.rng.next() * 0.15;
              const v = ring.v * (0.9 + c.rng.next() * 0.25) * (s.big ? 1.25 : 1);
              glyphs.push({
                x: s.x,
                y: s.apex,
                vx: Math.cos(a) * v,
                vy: Math.sin(a) * v,
                age: 0,
                life: 1.5 + c.rng.next() * 0.7,
                ch: BURST_CHARS[c.rng.int(BURST_CHARS.length)]!,
                size: (s.big ? 15 : 13) + c.rng.int(6),
              });
            }
          }
        }
        // Brief flash right after the pop.
        if (s.burst) {
          const fl = 1 - clamp01((c.t - s.launch - s.rise) * 3);
          if (fl > 0) c.drawGlow(s.x, s.apex, s.big ? 90 : 60, p.ink, 0.4 * fl);
        }
      }

      // Burst glyphs drift, sag, and decay to '.' — brightness is alpha.
      for (const g of glyphs) {
        if (g.age >= g.life) continue;
        g.age += c.dt;
        const drag = Math.max(0, 1 - 0.9 * c.dt);
        g.vx *= drag;
        g.vy = g.vy * drag + 26 * c.dt;
        g.x += g.vx * c.dt;
        g.y += g.vy * c.dt;
        const k = g.age / g.life;
        const ch = k > 0.8 ? '.' : k > 0.55 ? '+' : g.ch;
        ctx.font = `${g.size}px ${mono}`;
        ctx.fillStyle = withAlpha(p.ink, 0.95 * (1 - k) ** 1.3);
        ctx.fillText(ch, g.x, g.y);
      }

      // A faint terminal line types out over the finale.
      const t0 = 5.8;
      if (c.t > t0) {
        const msg = c.timeText ? `> solved. ${c.timeText}` : '> solved.';
        const typed = Math.min(msg.length, Math.floor((c.t - t0) / 0.085));
        ctx.textAlign = 'left';
        ctx.font = `15px ${mono}`;
        ctx.fillStyle = withAlpha(p.ink, 0.6);
        ctx.fillText(msg.slice(0, typed), 22, c.h - 26);
        if (Math.sin(c.t * 10) > 0) {
          ctx.fillStyle = withAlpha(p.ink, 0.55);
          ctx.fillRect(22 + typed * 9, c.h - 33, 8, 15);
        }
        ctx.textAlign = 'center';
      }
    },
  };
}

export const monoScenes: Scene[] = [makeDominoRun(), makeInkBloom(), makeAsciiFireworks()];
