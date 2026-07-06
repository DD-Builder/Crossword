/** Terracotta (sun-baked clay & adobe) victory scenes: desert-dusk,
 * talavera-cascade, marigold-burst. Warm banded light, hand-painted tile
 * motifs, and fiesta petals — everything glows like late-afternoon adobe. */

import type { Ctx2D, Scene } from '../types.ts';
import {
  ParticleSystem, TAU, clamp, clamp01, easeInOutSine, easeOutBack,
  easeOutCubic, lerp, mixColor, withAlpha, wobble,
} from '../particles.ts';

/* --- 1. desert-dusk ----------------------------------------------------------
 * A banded sunset wash deepens over the scene while saguaro shadows stretch
 * east; stars fade in top-down over a mesa horizon, and once the sun is gone
 * a single shooting star closes the show. */

interface Star {
  x: number;
  y: number;
  size: number;
  phase: number;
  depth: number;
}

interface Arm {
  side: number;
  at: number;
  len: number;
  up: number;
}

interface Cactus {
  x: number;
  base: number;
  hgt: number;
  arms: Arm[];
}

interface Pt {
  x: number;
  y: number;
}

function makeDesertDusk(): Scene {
  let stars: Star[] = [];
  let cacti: Cactus[] = [];
  let mesa: Pt[] = [];

  return {
    id: 'terracotta/desert-dusk',
    skin: 'terracotta',
    duration: 8,
    init(c) {
      stars = [];
      const n = Math.round(90 * c.quality);
      for (let i = 0; i < n; i++) {
        stars.push({
          x: c.rng.next(),
          y: c.rng.next() * 0.62,
          size: 0.8 + c.rng.next() * 1.6,
          phase: c.rng.next() * 100,
          depth: c.rng.next(),
        });
      }
      cacti = [];
      const xs = [0.12, 0.32, 0.63, 0.87];
      for (let i = 0; i < 4; i++) {
        const arms: Arm[] = [];
        const nArms = 1 + c.rng.int(2);
        for (let a = 0; a < nArms; a++) {
          arms.push({
            side: (a + i) % 2 === 0 ? 1 : -1,
            at: 0.42 + c.rng.next() * 0.3,
            len: 0.24 + c.rng.next() * 0.14,
            up: 0.3 + c.rng.next() * 0.22,
          });
        }
        cacti.push({
          x: xs[i]! + (c.rng.next() - 0.5) * 0.05,
          base: 0.8 + c.rng.next() * 0.1,
          hgt: 0.13 + c.rng.next() * 0.09,
          arms,
        });
      }
      // Two flat-topped mesas on the horizon (y offsets in h fractions).
      const dip = 0.045 + c.rng.next() * 0.02;
      mesa = [
        { x: 0, y: 0 }, { x: 0.07, y: 0 }, { x: 0.11, y: -dip }, { x: 0.27, y: -dip },
        { x: 0.31, y: 0 }, { x: 0.52, y: 0 }, { x: 0.55, y: -dip * 0.6 },
        { x: 0.68, y: -dip * 0.6 }, { x: 0.71, y: 0 }, { x: 1, y: 0 },
      ];
    },
    frame(c) {
      const { ctx, palette: p } = c;
      const horizon = c.h * 0.7;
      const dusk = easeInOutSine(clamp01(c.t / 6.2));

      // Sunset bands deepen as dusk falls — translucent washes, never opaque.
      const BANDS = 5;
      const bandH = horizon / BANDS;
      for (let i = 0; i < BANDS; i++) {
        const f = i / (BANDS - 1);
        const col = f < 0.5
          ? mixColor(p.accent, p.bad, f * 2)
          : mixColor(p.bad, p.warn, (f - 0.5) * 2);
        ctx.fillStyle = withAlpha(col, (0.05 + 0.16 * dusk) * (0.65 + 0.35 * f));
        ctx.fillRect(0, i * bandH - 1, c.w, bandH + 2);
      }

      // The sun sinks behind the mesa (the ground fill swallows it).
      const sunK = clamp01(c.t / 5.4);
      const sunX = c.w * 0.68;
      const sunY = lerp(horizon - c.h * 0.11, horizon + c.h * 0.04, easeInOutSine(sunK));
      const sunA = 0.5 * (1 - dusk * 0.55);
      c.drawGlow(sunX, sunY, c.h * 0.14, p.warn, sunA);
      ctx.fillStyle = withAlpha(mixColor(p.warn, p.cellSelected, 0.55), sunA + 0.15);
      ctx.beginPath();
      ctx.arc(sunX, sunY, c.h * 0.035, 0, TAU);
      ctx.fill();

      // Stars wink on top-down as the sky darkens.
      for (const s of stars) {
        const th = s.y / 0.62;
        const appear = clamp01((dusk - th * 0.7 - 0.12) / 0.2);
        if (appear <= 0) continue;
        const tw = 0.55 + 0.45 * wobble(s.phase, c.t * 1.6);
        const a = appear * tw * (p.dark ? 0.95 : 0.7);
        ctx.fillStyle = withAlpha(mixColor(p.ink, p.cellSelected, 0.3 + s.depth * 0.4), a);
        ctx.beginPath();
        ctx.arc(s.x * c.w, s.y * c.h, s.size * (0.7 + 0.3 * tw), 0, TAU);
        ctx.fill();
        if (s.depth > 0.85) c.drawGlow(s.x * c.w, s.y * c.h, s.size * 6, p.cellSelected, a * 0.4);
      }

      // Mesa horizon + desert floor.
      ctx.fillStyle = withAlpha(mixColor(p.ink, p.bad, 0.22), 0.14 + 0.14 * dusk);
      ctx.beginPath();
      ctx.moveTo(-4, horizon);
      for (const m of mesa) ctx.lineTo(m.x * c.w, horizon + m.y * c.h);
      ctx.lineTo(c.w + 4, horizon);
      ctx.lineTo(c.w + 4, c.h + 4);
      ctx.lineTo(-4, c.h + 4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = withAlpha(p.ink, 0.28);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, horizon + mesa[0]!.y * c.h);
      for (const m of mesa) ctx.lineTo(m.x * c.w, horizon + m.y * c.h);
      ctx.stroke();

      // Saguaros: round-capped strokes; shadows stretch east as the sun sinks.
      for (const k of cacti) {
        const bx = k.x * c.w;
        const by = k.base * c.h;
        const hgt = k.hgt * c.h;
        const lw = Math.max(6, hgt * 0.17);
        const shLen = hgt * (0.35 + 1.5 * dusk);
        ctx.fillStyle = withAlpha(p.ink, 0.2 - 0.09 * dusk);
        ctx.beginPath();
        ctx.ellipse(bx + shLen * 0.5, by + 2, shLen * 0.55, lw * 0.42, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = withAlpha(mixColor(p.ink, p.cellBlock, 0.5), 0.8 + 0.2 * dusk);
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx, by - hgt);
        ctx.stroke();
        for (const a of k.arms) {
          const ay = by - hgt * a.at;
          const ax = bx + a.side * hgt * a.len;
          ctx.lineWidth = lw * 0.78;
          ctx.beginPath();
          ctx.moveTo(bx, ay);
          ctx.quadraticCurveTo(ax, ay + lw * 0.3, ax, ay - hgt * a.up);
          ctx.stroke();
        }
      }

      // Finale: one shooting star across the settled night.
      const sk = (c.t - 6.5) / 0.85;
      if (sk > 0 && sk < 1) {
        const x0 = c.w * 0.14;
        const y0 = c.h * 0.1;
        const dx = c.w * 0.64;
        const dy = c.h * 0.2;
        const hx = x0 + dx * easeOutCubic(sk);
        const hy = y0 + dy * easeOutCubic(sk);
        const dl = Math.hypot(dx, dy) || 1;
        const fade = 1 - sk;
        const tail = 110 * (0.35 + 0.65 * fade);
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const f = 1 - i / 3;
          ctx.strokeStyle = withAlpha(mixColor(p.cellSelected, p.warn, i / 3), 0.55 * fade * f);
          ctx.lineWidth = 1 + i * 1.4;
          ctx.beginPath();
          ctx.moveTo(hx, hy);
          ctx.lineTo(hx - (dx / dl) * tail * f, hy - (dy / dl) * tail * f);
          ctx.stroke();
        }
        c.drawGlow(hx, hy, 22, p.cellSelected, 0.9 * fade);
      }
    },
  };
}

/* --- 2. talavera-cascade ------------------------------------------------------
 * Hand-painted tiles flip-cascade in a domino wave around the screen border,
 * building a decorative frame; a center medallion scales in big, then a
 * highlight shimmers once around the finished frame. */

interface Tile {
  x: number;
  y: number;
  start: number;
  motif: number;
  jitter: number;
}

function makeTalaveraCascade(): Scene {
  let tiles: Tile[] = [];
  let size = 48;

  const roundedTile = (ctx: Ctx2D, s: number, r: number): void => {
    const h = s / 2;
    ctx.beginPath();
    ctx.moveTo(-h + r, -h);
    ctx.lineTo(h - r, -h);
    ctx.quadraticCurveTo(h, -h, h, -h + r);
    ctx.lineTo(h, h - r);
    ctx.quadraticCurveTo(h, h, h - r, h);
    ctx.lineTo(-h + r, h);
    ctx.quadraticCurveTo(-h, h, -h, h - r);
    ctx.lineTo(-h, -h + r);
    ctx.quadraticCurveTo(-h, -h, -h + r, -h);
    ctx.closePath();
  };

  const motifs: ((ctx: Ctx2D, s: number, col: string, ink: string) => void)[] = [
    (ctx, s, col, ink) => { // quatrefoil dots
      ctx.fillStyle = col;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + TAU / 8;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * s * 0.24, Math.sin(a) * s * 0.24, s * 0.1, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.07, 0, TAU);
      ctx.fill();
    },
    (ctx, s, col, ink) => { // cross
      ctx.fillStyle = col;
      ctx.fillRect(-s * 0.3, -s * 0.09, s * 0.6, s * 0.18);
      ctx.fillRect(-s * 0.09, -s * 0.3, s * 0.18, s * 0.6);
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.06, 0, TAU);
      ctx.fill();
    },
    (ctx, s, col, ink) => { // ring + kernel
      ctx.strokeStyle = col;
      ctx.lineWidth = s * 0.09;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.24, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.08, 0, TAU);
      ctx.fill();
    },
  ];

  return {
    id: 'terracotta/talavera-cascade',
    skin: 'terracotta',
    duration: 7.5,
    init(c) {
      size = clamp(Math.min(c.w, c.h) / 9, 30, 62);
      const m = size * 0.72;
      const nx = Math.max(3, Math.round((c.w - 2 * m) / (size * 1.16)) + 1);
      const ny = Math.max(3, Math.round((c.h - 2 * m) / (size * 1.16)) + 1);
      const sx = (c.w - 2 * m) / (nx - 1);
      const sy = (c.h - 2 * m) / (ny - 1);
      const pos: Pt[] = [];
      for (let i = 0; i < nx; i++) pos.push({ x: m + i * sx, y: m });
      for (let j = 1; j < ny; j++) pos.push({ x: c.w - m, y: m + j * sy });
      for (let i = nx - 2; i >= 0; i--) pos.push({ x: m + i * sx, y: c.h - m });
      for (let j = ny - 2; j >= 1; j--) pos.push({ x: m, y: m + j * sy });
      const stagger = 3.3 / pos.length;
      tiles = pos.map((pt, i) => ({
        x: pt.x,
        y: pt.y,
        start: 0.3 + i * stagger,
        motif: i % 3,
        jitter: (c.rng.next() - 0.5) * 0.09,
      }));
    },
    frame(c) {
      const { ctx, palette: p } = c;
      const motifCols = [p.accent, p.good, p.bad];
      const inkCol = withAlpha(p.ink, 0.75);
      const n = tiles.length;
      const shimK = (c.t - 5.4) / 1.5;

      for (let i = 0; i < n; i++) {
        const tl = tiles[i]!;
        const k = clamp01((c.t - tl.start) / 0.5);
        if (k <= 0) continue;
        // 3D flip via x-scale, with easeOutBack overshoot as it lands.
        const flip = Math.max(0.02, easeOutBack(k));
        ctx.save();
        ctx.translate(tl.x, tl.y);
        ctx.rotate(tl.jitter);
        ctx.scale(flip, 1);
        ctx.save();
        ctx.translate(2.5, 3.5); // offset shadow — hand-set relief
        roundedTile(ctx, size, size * 0.16);
        ctx.fillStyle = withAlpha(p.ink, 0.16);
        ctx.fill();
        ctx.restore();
        roundedTile(ctx, size, size * 0.16);
        ctx.fillStyle = withAlpha(p.surface, 0.96);
        ctx.fill();
        ctx.strokeStyle = withAlpha(p.accent, 0.5);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        motifs[tl.motif]!(ctx, size, motifCols[tl.motif]!, inkCol);
        // Shimmer: a highlight sweeps once around the finished frame.
        if (shimK > 0 && shimK < 1) {
          const d = Math.abs(i / n - shimK);
          const hi = clamp01(1 - Math.min(d, 1 - d) * 16);
          if (hi > 0.02) {
            roundedTile(ctx, size, size * 0.16);
            ctx.fillStyle = withAlpha(p.cellSelected, 0.4 * hi);
            ctx.fill();
          }
        }
        ctx.restore();
        const settle = 1 - clamp01((c.t - tl.start - 0.5) * 2.2);
        if (k >= 1 && settle > 0) c.drawGlow(tl.x, tl.y, size * 0.9, p.cellSelected, 0.35 * settle);
      }

      // Center medallion tile scales in big once the frame is laid.
      const mk = clamp01((c.t - 4.3) / 0.8);
      if (mk > 0) {
        const S = Math.min(c.w, c.h) * 0.3;
        const sc = Math.max(0.02, easeOutBack(mk));
        const cx = c.w / 2;
        const cy = c.h / 2;
        c.drawGlow(cx, cy, S * 0.9 * sc, p.warn, 0.35 * mk);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.sin(c.t * 0.7) * 0.02);
        ctx.scale(sc, sc);
        ctx.save();
        ctx.translate(4, 6);
        roundedTile(ctx, S, S * 0.14);
        ctx.fillStyle = withAlpha(p.ink, 0.2);
        ctx.fill();
        ctx.restore();
        roundedTile(ctx, S, S * 0.14);
        ctx.fillStyle = withAlpha(p.surface, 0.97);
        ctx.fill();
        ctx.strokeStyle = withAlpha(p.accent, 0.85);
        ctx.lineWidth = 3;
        ctx.stroke();
        // Medallion motif: petal ring around a quatrefoil heart.
        ctx.strokeStyle = withAlpha(p.accent, 0.9);
        ctx.lineWidth = S * 0.035;
        ctx.beginPath();
        ctx.arc(0, 0, S * 0.34, 0, TAU);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          ctx.fillStyle = withAlpha(i % 2 ? p.good : p.bad, 0.85);
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * S * 0.34, Math.sin(a) * S * 0.34, S * 0.07, S * 0.045, a, 0, TAU);
          ctx.fill();
        }
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + TAU / 8;
          ctx.fillStyle = withAlpha(p.accent, 0.9);
          ctx.beginPath();
          ctx.arc(Math.cos(a) * S * 0.16, Math.sin(a) * S * 0.16, S * 0.055, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = withAlpha(p.bad, 0.9);
        ctx.beginPath();
        ctx.arc(0, 0, S * 0.06, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    },
  };
}

/* --- 3. marigold-burst ----------------------------------------------------------
 * Concentric rings of marigold petals burst from the center ring by ring into
 * a huge layered bloom; papel-picado banners flutter on two strings across
 * the top, and loose petals spiral down. */

interface Banner {
  u: number;
  line: number;
  col: number;
  seed: number;
}

const RINGS = 5;

function makeMarigoldBurst(): Scene {
  let petals: ParticleSystem;
  let ringSeeds: number[] = [];
  let banners: Banner[] = [];

  const petalPath = (ctx: Ctx2D, len: number, half: number): void => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.45, -half, len, 0);
    ctx.quadraticCurveTo(len * 0.45, half, 0, 0);
    ctx.closePath();
  };

  return {
    id: 'terracotta/marigold-burst',
    skin: 'terracotta',
    duration: 7.5,
    init(c) {
      petals = new ParticleSystem(Math.round(70 * c.quality));
      banners = [];
      for (let line = 0; line < 2; line++) {
        const n = line === 0 ? 8 : 7;
        for (let j = 0; j < n; j++) {
          banners.push({ u: (j + 0.5) / n, line, col: (j + line) % 4, seed: c.rng.next() * 100 });
        }
      }
      ringSeeds = [];
      for (let i = 0; i < RINGS; i++) ringSeeds.push(c.rng.next() * 100);
    },
    frame(c) {
      const { ctx, palette: p } = c;
      const R = Math.min(c.w, c.h);
      const cx = c.w / 2;
      const cy = c.h * 0.54;

      // Papel-picado: two catenary strings drop in across the top.
      const drop = (easeOutCubic(clamp01((c.t - 0.2) / 0.8)) - 1) * c.h * 0.22;
      const bannerCols = [p.accent, p.good, p.bad, p.warn];
      for (let line = 0; line < 2; line++) {
        const y0 = c.h * (line === 0 ? 0.06 : 0.17) + drop;
        const y1 = c.h * (line === 0 ? 0.12 : 0.09) + drop;
        const sag = c.h * (line === 0 ? 0.05 : 0.06) + Math.sin(c.t * 1.3 + line * 2) * 4;
        const py = (u: number): number => lerp(y0, y1, u) + sag * 4 * u * (1 - u);
        ctx.strokeStyle = withAlpha(p.ink, 0.5);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, py(0));
        for (let u = 0.05; u <= 1.001; u += 0.05) ctx.lineTo(u * c.w, py(u));
        ctx.stroke();
        for (const b of banners) {
          if (b.line !== line) continue;
          const bw = clamp(c.w * 0.055, 26, 54);
          const bh = bw * 0.78;
          const slope = (py(b.u + 0.02) - py(b.u - 0.02)) / (c.w * 0.04);
          const rot = Math.atan(slope) + wobble(b.seed, c.t * 1.4) * 0.16;
          ctx.save();
          ctx.translate(b.u * c.w, py(b.u));
          ctx.rotate(rot);
          // Scalloped banner…
          ctx.fillStyle = withAlpha(bannerCols[b.col]!, 0.85);
          ctx.beginPath();
          ctx.moveTo(-bw / 2, 0);
          ctx.lineTo(bw / 2, 0);
          ctx.lineTo(bw / 2, bh * 0.72);
          const r = bw / 6;
          for (let i = 0; i < 3; i++) ctx.arc(bw / 2 - r - i * 2 * r, bh * 0.72, r, 0, Math.PI);
          ctx.closePath();
          ctx.fill();
          // …with punched holes showing the page through.
          ctx.fillStyle = withAlpha(p.bg, 0.9);
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc((i - 1) * bw * 0.26, bh * 0.3, bw * 0.07, 0, TAU);
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(0, bh * 0.54, bw * 0.09, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }

      // The bloom: outer rings drawn first so inner rings layer on top.
      c.drawGlow(cx, cy, R * 0.3 * clamp01(c.t / 2.5), p.warn, p.dark ? 0.35 : 0.2);
      const spin = c.t * 0.1;
      for (let i = RINGS - 1; i >= 0; i--) {
        const k = easeOutBack(clamp01((c.t - (0.5 + i * 0.32)) / 0.7));
        if (k <= 0) continue;
        const count = 8 + i * 4;
        const rad = R * 0.045 * (1.1 + i * 1.02);
        const len = R * (0.075 + i * 0.02);
        const col = mixColor(mixColor(p.warn, p.bad, 0.35 - i * 0.07), p.accent, i / RINGS);
        const hi = mixColor(col, p.cellSelected, 0.45);
        const dir = i % 2 === 0 ? 1 : -1;
        for (let j = 0; j < count; j++) {
          const a = (j / count) * TAU + spin * dir + ringSeeds[i]!;
          const breathe = 1 + 0.05 * wobble(ringSeeds[i]! + j, c.t * 1.2);
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(a);
          ctx.translate(rad * k, 0);
          petalPath(ctx, len * k * breathe, len * 0.34);
          ctx.fillStyle = withAlpha(col, 0.88);
          ctx.fill();
          petalPath(ctx, len * k * 0.6, len * 0.2);
          ctx.fillStyle = withAlpha(hi, 0.5);
          ctx.fill();
          ctx.restore();
        }
      }
      // Dense center disc with a dotted crown.
      const ck = clamp01((c.t - 0.5) / 0.5);
      if (ck > 0) {
        ctx.fillStyle = withAlpha(mixColor(p.bad, p.ink, 0.35), 0.92);
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.035 * easeOutBack(ck), 0, TAU);
        ctx.fill();
        ctx.fillStyle = withAlpha(p.cellSelected, 0.8);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + spin;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * R * 0.018 * ck, cy + Math.sin(a) * R * 0.018 * ck, R * 0.004, 0, TAU);
          ctx.fill();
        }
      }

      // Loose petals shed off the outer ring and spiral down.
      if (c.t > 2.2 && petals.alive < petals.capacity - 2 && c.rng.next() < 0.5) {
        const a = c.rng.next() * TAU;
        const rad = R * 0.045 * (1.1 + (RINGS - 1) * 1.02);
        petals.spawn({
          x: cx + Math.cos(a) * rad,
          y: cy + Math.sin(a) * rad,
          vx: Math.cos(a) * (20 + c.rng.next() * 40),
          vy: -10 + c.rng.next() * 20,
          life: 2.5 + c.rng.next() * 2,
          size: R * (0.02 + c.rng.next() * 0.014),
          rot: c.rng.next() * TAU,
          vr: (c.rng.next() - 0.5) * 5,
          seed: c.rng.next(),
        });
      }
      petals.update(c.dt, c.t, {
        gravity: 32,
        drag: 0.4,
        update(pt, dt) {
          pt.vx += wobble(pt.seed * 21, c.t * 1.1) * 60 * dt;
        },
      });
      petals.each((pt) => {
        const fade = 1 - pt.age / pt.life;
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        petalPath(ctx, pt.size, pt.size * 0.32);
        ctx.fillStyle = withAlpha(mixColor(p.warn, p.accent, pt.seed), 0.8 * fade);
        ctx.fill();
        ctx.restore();
      });
    },
  };
}

export const terracottaScenes: Scene[] = [makeDesertDusk(), makeTalaveraCascade(), makeMarigoldBurst()];
