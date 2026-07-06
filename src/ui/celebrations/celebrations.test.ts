/** Celebration engine + scene contract tests. Scenes must run their whole
 * lifecycle against a stub 2D context with no DOM — that's what keeps 33
 * hand-crafted scenes honest. */

import { describe, expect, it } from 'vitest';
import type { Ctx2D, Palette, Scene, SceneContext } from './types.ts';
import {
  ParticleSystem, clamp01, easeInOutSine, easeOutBack, easeOutBounce,
  easeOutCubic, easeOutQuint, mixColor, parseColor, withAlpha,
} from './particles.ts';
import { SCENE_SKINS, pickScene, sceneById, scenesFor } from './registry.ts';
import { rngFrom } from '../../core/rng.ts';

/* --- Stub context ------------------------------------------------------------ */

function stubCtx(): Ctx2D {
  const gradient = { addColorStop: () => {} } as unknown as CanvasGradient;
  const noop = (): void => {};
  return {
    save: noop, restore: noop, translate: noop, rotate: noop, scale: noop,
    setTransform: noop,
    globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: 'butt', lineJoin: 'miter',
    font: '', textAlign: 'left', textBaseline: 'alphabetic',
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    quadraticCurveTo: noop, bezierCurveTo: noop, arc: noop, ellipse: noop,
    rect: noop, fill: noop, stroke: noop, fillRect: noop, strokeRect: noop,
    clearRect: noop, fillText: noop, strokeText: noop,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
}

const PALETTE: Palette = {
  bg: '#faf7f0', surface: '#ffffff', ink: '#1c1b18', inkMuted: '#6b6659',
  accent: '#2f6fde', accentSoft: '#dbe7fb', cellSelected: '#ffd83d',
  cellBlock: '#1c1b18', good: '#2e9e44', warn: '#d9822b', bad: '#d1383d',
  fontDisplay: 'serif', dark: false,
};

function makeContext(): SceneContext {
  return {
    ctx: stubCtx(),
    w: 1024, h: 768, t: 0, dt: 1 / 60, quality: 1,
    palette: PALETTE,
    rng: rngFrom('test'),
    gridRect: { x: 200, y: 150, w: 500, h: 400 },
    title: 'Test Puzzle',
    timeText: '3:21',
    drawGlow: () => {},
  };
}

function runScene(scene: Scene, seconds: number): void {
  const c = makeContext();
  scene.init(c);
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    c.t = t;
    c.dt = dt;
    scene.frame(c);
  }
}

/* --- Registry contract --------------------------------------------------------- */

describe('scene registry', () => {
  it('every registered skin has exactly 3 scenes with well-formed unique ids', () => {
    const seen = new Set<string>();
    for (const skin of SCENE_SKINS) {
      const scenes = scenesFor(skin);
      expect(scenes, skin).toHaveLength(3);
      for (const s of scenes) {
        expect(s.skin).toBe(skin);
        expect(s.id).toMatch(new RegExp(`^${skin}/[a-z0-9-]+$`));
        expect(seen.has(s.id), `duplicate id ${s.id}`).toBe(false);
        seen.add(s.id);
        expect(s.duration).toBeGreaterThanOrEqual(4);
        expect(s.duration).toBeLessThanOrEqual(10);
      }
    }
  });

  it('unknown skins fall back to classic', () => {
    expect(scenesFor('no-such-skin')).toEqual(scenesFor('classic'));
  });

  it('pickScene is deterministic per seed and covers all 3 scenes across seeds', () => {
    const a = pickScene('classic', 'daily-2026-07-06');
    const b = pickScene('classic', 'daily-2026-07-06');
    expect(a.id).toBe(b.id);
    const ids = new Set<string>();
    for (let i = 0; i < 40; i++) ids.add(pickScene('classic', `seed-${i}`).id);
    expect(ids.size).toBe(3);
  });

  it('sceneById finds every registered scene', () => {
    for (const skin of SCENE_SKINS) {
      for (const s of scenesFor(skin)) expect(sceneById(s.id)).toBe(s);
    }
  });
});

describe('scene lifecycle', () => {
  it('every scene runs init + full duration of frames against a stub context', () => {
    for (const skin of SCENE_SKINS) {
      for (const scene of scenesFor(skin)) {
        expect(() => runScene(scene, scene.duration + 0.5), scene.id).not.toThrow();
      }
    }
  });

  it('scenes survive a missing gridRect and empty strings', () => {
    for (const skin of SCENE_SKINS) {
      for (const scene of scenesFor(skin)) {
        const c = makeContext();
        c.gridRect = null;
        c.title = '';
        c.timeText = '';
        scene.init(c);
        expect(() => {
          for (let t = 0; t < 2; t += 1 / 30) {
            c.t = t;
            scene.frame(c);
          }
        }, scene.id).not.toThrow();
      }
    }
  });
});

/* --- Primitives ------------------------------------------------------------------ */

describe('easing', () => {
  const eases = { easeOutCubic, easeOutQuint, easeInOutSine, easeOutBounce };
  it('hits 0 at 0 and 1 at 1', () => {
    for (const [name, fn] of Object.entries(eases)) {
      expect(fn(0), name).toBeCloseTo(0, 6);
      expect(fn(1), name).toBeCloseTo(1, 6);
    }
    expect(easeOutBack(1)).toBeCloseTo(1, 6);
  });
  it('clamps out-of-range inputs', () => {
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
    expect(clamp01(5)).toBe(1);
  });
});

describe('color math', () => {
  it('parses hex and rgb forms', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255, 1]);
    expect(parseColor('#1c1b18')).toEqual([28, 27, 24, 1]);
    expect(parseColor('rgb(10, 20, 30)')).toEqual([10, 20, 30, 1]);
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual([10, 20, 30, 0.5]);
  });
  it('withAlpha and mixColor produce valid rgba strings', () => {
    expect(withAlpha('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(mixColor('#000000', '#ffffff', 0.5)).toMatch(/^rgba\(128, 128, 128/);
  });
});

describe('particle pool', () => {
  it('recycles dead slots without growing', () => {
    const ps = new ParticleSystem(4);
    for (let i = 0; i < 4; i++) expect(ps.spawn({ life: 0.1 })).not.toBeNull();
    expect(ps.spawn({})).toBeNull(); // full
    ps.update(0.2, 0); // everything dies
    expect(ps.alive).toBe(0);
    expect(ps.spawn({ life: 1 })).not.toBeNull(); // recycled
    expect(ps.pool.length).toBe(4);
  });

  it('applies gravity, drag, and custom update', () => {
    const ps = new ParticleSystem(1);
    const p = ps.spawn({ vx: 100, vy: 0, life: 10 })!;
    let customRan = false;
    ps.update(0.5, 0, { gravity: 100, drag: 0.5, update: () => { customRan = true; } });
    expect(p.vy).toBeGreaterThan(0);
    expect(p.vx).toBeLessThan(100);
    expect(customRan).toBe(true);
  });
});
