/** Classic (newsprint) victory scenes: letterpress, typewriter, origami.
 * Ink on paper, set in the skin's own display serif. */

import type { Ctx2D, Scene } from '../types.ts';
import {
  ParticleSystem, TAU, clamp01, easeInCubic, easeOutBack, easeOutCubic,
  easeOutQuint, lerp, withAlpha, wobble,
} from '../particles.ts';

/* --- 1. headline-press ------------------------------------------------------
 * Letterpress slugs rain from above and slam into a giant SOLVED headline;
 * each impact bursts ink. A dateline rule and the solve time stamp beneath. */

interface Slug {
  ch: string;
  x: number;
  landT: number;
  burst: boolean;
}

function makeHeadlinePress(): Scene {
  let slugs: Slug[] = [];
  let ink: ParticleSystem;
  let word = 'SOLVED!';
  let fontPx = 96;

  return {
    id: 'classic/headline-press',
    skin: 'classic',
    duration: 6.5,
    init(c) {
      ink = new ParticleSystem(240);
      word = 'SOLVED!';
      fontPx = Math.min(140, (c.w * 0.82) / (word.length * 0.62));
      const totalW = word.length * fontPx * 0.62;
      slugs = [...word].map((ch, i) => ({
        ch,
        x: c.w / 2 - totalW / 2 + (i + 0.5) * fontPx * 0.62,
        landT: 0.35 + i * 0.16 + c.rng.next() * 0.06,
        burst: false,
      }));
    },
    frame(c) {
      const { ctx, palette: p } = c;
      const baseline = c.h * 0.42;

      // Ink bursts first (behind the type).
      ink.update(c.dt, c.t, { gravity: 340, drag: 1.6 });
      ink.each((pt) => {
        ctx.globalAlpha = (1 - pt.age / pt.life) * pt.alpha;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size * (0.6 + 0.4 * (pt.age / pt.life)), 0, TAU);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      for (const s of slugs) {
        const k = clamp01((c.t - s.landT + 0.5) / 0.5); // 0.5s fall
        if (k <= 0) continue;
        const drop = easeInCubic(k);
        const y = lerp(-fontPx, baseline, drop);
        const settled = k >= 1;
        if (settled && !s.burst) {
          s.burst = true;
          const n = Math.round(16 * c.quality);
          for (let i = 0; i < n; i++) {
            const a = c.rng.next() * TAU;
            const v = 40 + c.rng.next() * 220;
            ink.spawn({
              x: s.x + (c.rng.next() - 0.5) * fontPx * 0.4,
              y: baseline + 6,
              vx: Math.cos(a) * v,
              vy: -Math.abs(Math.sin(a)) * v * 0.9,
              life: 0.5 + c.rng.next() * 0.5,
              size: 1.5 + c.rng.next() * 3.5,
              color: withAlpha(p.ink, 0.8),
            });
          }
        }
        // Squash on landing.
        const squash = settled ? 1 + 0.12 * Math.max(0, 1 - (c.t - s.landT) * 6) : 1;
        ctx.save();
        ctx.translate(s.x, y);
        ctx.scale(1 / squash, squash);
        ctx.font = `900 ${fontPx}px ${p.fontDisplay}`;
        ctx.fillStyle = withAlpha(p.ink, 0.18);
        ctx.fillText(s.ch, 3, 4); // letterpress offset impression
        ctx.fillStyle = p.ink;
        ctx.fillText(s.ch, 0, 0);
        ctx.restore();
      }

      // Dateline rule + time roll in once the headline is set.
      const lastLand = slugs[slugs.length - 1]?.landT ?? 1;
      const after = clamp01((c.t - lastLand - 0.2) / 0.6);
      if (after > 0) {
        const ruleW = c.w * 0.5 * easeOutQuint(after);
        ctx.strokeStyle = withAlpha(p.ink, 0.75);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(c.w / 2 - ruleW / 2, baseline + fontPx * 0.34);
        ctx.lineTo(c.w / 2 + ruleW / 2, baseline + fontPx * 0.34);
        ctx.stroke();
        ctx.globalAlpha = after;
        ctx.font = `400 ${Math.round(fontPx * 0.22)}px ${p.fontDisplay}`;
        ctx.fillStyle = withAlpha(p.ink, 0.85);
        ctx.fillText(
          `★  ${c.title || 'THE DAILY'}  ·  ${c.timeText}  ★`.toUpperCase(),
          c.w / 2,
          baseline + fontPx * 0.62,
        );
        ctx.globalAlpha = 1;
      }
    },
  };
}

/* --- 2. typewriter -----------------------------------------------------------
 * The solve time hammered out key by key, type-bar flashes, ink specks, then
 * the carriage-return sweep underlines it with a satisfying ding-line. */

function makeTypewriter(): Scene {
  let text = '';
  let ink: ParticleSystem;
  const KEY_S = 0.14; // seconds per keystroke

  const drawChar = (ctx: Ctx2D, ch: string, x: number, y: number, fontPx: number, font: string, inkColor: string, punch: number): void => {
    ctx.save();
    ctx.translate(x, y + punch * 3);
    ctx.font = `700 ${fontPx}px "Courier New", ${font}`;
    ctx.fillStyle = withAlpha(inkColor, 0.92 - punch * 0.2);
    ctx.textAlign = 'center';
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  };

  return {
    id: 'classic/typewriter',
    skin: 'classic',
    duration: 6,
    init(c) {
      ink = new ParticleSystem(160);
      text = `SOLVED IN ${c.timeText}`;
    },
    frame(c) {
      const { ctx, palette: p } = c;
      const fontPx = Math.min(64, (c.w * 0.86) / (text.length * 0.62));
      const cw = fontPx * 0.62;
      const x0 = c.w / 2 - (text.length * cw) / 2 + cw / 2;
      const y = c.h * 0.44;
      const typed = Math.min(text.length, Math.floor((c.t - 0.4) / KEY_S));

      ink.update(c.dt, c.t, { gravity: 60, drag: 2 });
      ink.each((pt) => {
        ctx.globalAlpha = 1 - pt.age / pt.life;
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
      });
      ctx.globalAlpha = 1;

      for (let i = 0; i < typed; i++) {
        const ch = text[i]!;
        if (ch === ' ') continue;
        const sinceKey = c.t - 0.4 - i * KEY_S;
        const punch = Math.max(0, 1 - sinceKey * 8);
        drawChar(ctx, ch, x0 + i * cw, y, fontPx, p.fontDisplay, p.ink, punch);
        if (punch > 0.95) {
          // fresh strike: type-bar flash + ink specks
          ctx.strokeStyle = withAlpha(p.ink, 0.35 * punch);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x0 + i * cw, c.h);
          ctx.lineTo(x0 + i * cw, y + 8);
          ctx.stroke();
          for (let s = 0; s < 3; s++) {
            ink.spawn({
              x: x0 + i * cw + (c.rng.next() - 0.5) * fontPx * 0.5,
              y: y - c.rng.next() * fontPx * 0.6,
              vx: (c.rng.next() - 0.5) * 50,
              vy: -c.rng.next() * 30,
              life: 0.4 + c.rng.next() * 0.4,
              size: 1 + c.rng.next() * 2,
              color: withAlpha(p.ink, 0.7),
            });
          }
        }
      }

      // Blinking cursor while typing.
      if (typed < text.length && Math.sin(c.t * 12) > 0) {
        ctx.fillStyle = withAlpha(p.accent, 0.9);
        ctx.fillRect(x0 + typed * cw - cw * 0.3, y - fontPx * 0.75, 3, fontPx * 0.85);
      }

      // Carriage return: sweeping rule + ding once the line is done.
      const doneAt = 0.4 + text.length * KEY_S + 0.25;
      const sweep = clamp01((c.t - doneAt) / 0.45);
      if (sweep > 0) {
        const sx = lerp(c.w * 0.92, c.w * 0.08, easeOutCubic(sweep));
        ctx.strokeStyle = withAlpha(p.accent, 0.85);
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(c.w * 0.92, y + fontPx * 0.5);
        ctx.lineTo(sx, y + fontPx * 0.5);
        ctx.stroke();
        c.drawGlow(sx, y + fontPx * 0.5, 26, p.accent, 1 - sweep * 0.5);
      }
      // Ribbon curls drifting in the lower third for texture.
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const phase = wobble(i * 7.3, c.t * 0.6);
        const rx = c.w * (0.15 + i * 0.17);
        const ry = c.h * 0.78 + phase * 24;
        ctx.strokeStyle = withAlpha(i % 2 ? p.bad : p.ink, 0.25);
        ctx.beginPath();
        ctx.moveTo(rx - 40, ry);
        ctx.bezierCurveTo(rx - 10, ry - 30 - phase * 10, rx + 10, ry + 30 + phase * 10, rx + 40, ry);
        ctx.stroke();
      }
    },
  };
}

/* --- 3. paper-crane -----------------------------------------------------------
 * The grid's squares lift off, swirl like caught newsprint, and fold into an
 * origami crane that flaps away trailing scraps. */

function makePaperCrane(): Scene {
  let scraps: ParticleSystem;
  let trail: ParticleSystem;

  const craneAt = (ctx: Ctx2D, x: number, y: number, s: number, flap: number, inkColor: string, accent: string): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // body: two folded triangles + neck/beak + tail
    ctx.fillStyle = accent;
    ctx.beginPath(); // wing (flapping)
    ctx.moveTo(-8, 0);
    ctx.lineTo(6, 0);
    ctx.lineTo(-2, -14 * flap - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = inkColor;
    ctx.beginPath(); // body
    ctx.moveTo(-14, 2);
    ctx.lineTo(10, 2);
    ctx.lineTo(2, 10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath(); // neck + head
    ctx.moveTo(10, 2);
    ctx.lineTo(18, -8);
    ctx.lineTo(20, -6);
    ctx.lineTo(13, 4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath(); // tail
    ctx.moveTo(-14, 2);
    ctx.lineTo(-22, -6);
    ctx.lineTo(-16, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  return {
    id: 'classic/paper-crane',
    skin: 'classic',
    duration: 7,
    init(c) {
      scraps = new ParticleSystem(Math.round(90 * c.quality));
      trail = new ParticleSystem(80);
      const r = c.gridRect ?? { x: c.w * 0.25, y: c.h * 0.25, w: c.w * 0.5, h: c.h * 0.5 };
      for (let i = 0; i < scraps.capacity; i++) {
        scraps.spawn({
          x: r.x + c.rng.next() * r.w,
          y: r.y + c.rng.next() * r.h,
          vx: 0,
          vy: 0,
          life: 9,
          size: 6 + c.rng.next() * 10,
          rot: c.rng.next() * TAU,
          vr: (c.rng.next() - 0.5) * 4,
        });
      }
    },
    frame(c) {
      const { ctx, palette: p } = c;
      // Convergence point rises across the screen; crane emerges from it.
      const prog = clamp01((c.t - 1.6) / 4.4);
      const cx = lerp(c.w * 0.5, c.w * 0.82, easeOutCubic(prog));
      const cy = lerp(c.h * 0.45, c.h * 0.16, easeOutCubic(prog));

      // Scraps: first lift and swirl (flow field), then get pulled into the fold.
      scraps.update(c.dt, c.t, {
        update(pt, dt) {
          const lift = clamp01((c.t - pt.seed * 0.8) / 1.2);
          pt.vy -= 60 * lift * dt;
          const pull = clamp01((c.t - 1.2) / 1.4);
          pt.vx += ((cx - pt.x) * 1.4 * pull - pt.vx * 0.9) * dt * 3;
          pt.vy += ((cy - pt.y) * 1.4 * pull - pt.vy * 0.9) * dt * 3;
          pt.vx += wobble(pt.seed * 31, c.t) * 30 * dt * (1 - pull);
        },
      });
      scraps.each((pt) => {
        const near = Math.hypot(pt.x - cx, pt.y - cy);
        const merged = prog > 0 && near < 26;
        if (merged) {
          pt.dead = true; // absorbed into the crane
          return;
        }
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        ctx.fillStyle = withAlpha(pt.seed > 0.5 ? p.surface : p.ink, p.dark ? 0.55 : 0.8);
        ctx.strokeStyle = withAlpha(p.ink, 0.4);
        ctx.lineWidth = 1;
        ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size * 0.72);
        ctx.strokeRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size * 0.72);
        ctx.restore();
      });

      // The crane: grows in, flaps, and banks off; trailing scraps.
      if (prog > 0) {
        const scale = 2.2 + easeOutBack(clamp01(prog * 1.6)) * 2.4;
        const flap = Math.sin(c.t * 9) * 0.9 + 0.3;
        const bank = Math.sin(c.t * 2.2) * 0.12;
        if (trail.alive < 60 && c.rng.next() < 0.5) {
          trail.spawn({
            x: cx - 18 * scale * 0.4,
            y: cy + 6,
            vx: -30 - c.rng.next() * 40,
            vy: (c.rng.next() - 0.5) * 24,
            life: 1.2,
            size: 2 + c.rng.next() * 3,
            color: withAlpha(p.inkMuted, 0.6),
          });
        }
        trail.update(c.dt, c.t, { drag: 0.6 });
        trail.each((pt) => {
          ctx.globalAlpha = 1 - pt.age / pt.life;
          ctx.fillStyle = pt.color;
          ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
        });
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(bank);
        ctx.translate(-cx, -cy);
        c.drawGlow(cx, cy, 60 * clamp01(prog * 2), p.accentSoft, 0.5);
        craneAt(ctx, cx, cy, scale, flap, p.ink, p.accent);
        ctx.restore();
      }
    },
  };
}

export const classicScenes: Scene[] = [makeHeadlinePress(), makeTypewriter(), makePaperCrane()];
