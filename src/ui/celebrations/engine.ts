/** The canvas runtime for victory scenes: one full-viewport layer under the
 * modal, a rAF loop with a perf watchdog, sprite-cached glows, and a fade-out
 * teardown. Scenes stay pure — everything DOM-flavored lives here. */

import { rngFrom } from '../../core/rng.ts';
import { samplePalette } from './palette.ts';
import { withAlpha } from './particles.ts';
import type { Palette, Rect, Scene, SceneContext } from './types.ts';

export interface PlayHandle {
  stop(): void;
  readonly done: boolean;
}

export interface PlaySceneOptions {
  seedKey: string;
  gridRect?: Rect | null;
  title?: string;
  timeText?: string;
  /** Test/dev hook: override the sampled palette. */
  palette?: Palette;
  /** Extra seconds past scene.duration before fade (modal lingers). */
  onDone?: () => void;
}

const FADE_MS = 600;
const DPR_CAP = 2;
const WATCHDOG_FRAMES = 60;
const WATCHDOG_BUDGET_MS = 24;

export function playScene(scene: Scene, opts: PlaySceneOptions): PlayHandle {
  const canvas = document.createElement('canvas');
  canvas.className = 'celebration-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const raw = canvas.getContext('2d');
  if (!raw) return { stop: () => {}, done: true };
  document.body.append(canvas);

  const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
  let w = window.innerWidth;
  let h = window.innerHeight;
  const resize = (): void => {
    w = window.innerWidth;
    h = window.innerHeight;
    // Buffer is in device pixels; CSS size MUST be pinned to the viewport in
    // CSS pixels, or the element renders at its 2×-DPR intrinsic size and the
    // scene spills off-screen (only the top-left quadrant shows).
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    raw.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  // Glow sprites: pre-rendered radial gradients, keyed by color — drawing a
  // scaled bitmap every frame is dramatically cheaper than shadowBlur.
  const sprites = new Map<string, HTMLCanvasElement>();
  const glowSprite = (color: string): HTMLCanvasElement => {
    let sprite = sprites.get(color);
    if (!sprite) {
      sprite = document.createElement('canvas');
      sprite.width = sprite.height = 64;
      const sctx = sprite.getContext('2d')!;
      const g = sctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, withAlpha(color, 0.85));
      g.addColorStop(0.35, withAlpha(color, 0.32));
      g.addColorStop(1, withAlpha(color, 0));
      sctx.fillStyle = g;
      sctx.fillRect(0, 0, 64, 64);
      sprites.set(color, sprite);
    }
    return sprite;
  };

  const context: SceneContext = {
    ctx: raw,
    w,
    h,
    t: 0,
    dt: 0,
    quality: 1,
    palette: opts.palette ?? samplePalette(),
    rng: rngFrom(opts.seedKey),
    gridRect: opts.gridRect ?? null,
    title: opts.title ?? '',
    timeText: opts.timeText ?? '',
    drawGlow(x, y, r, color, alpha = 1) {
      if (r <= 0) return;
      const prev = raw.globalAlpha;
      raw.globalAlpha = prev * alpha;
      raw.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
      raw.globalAlpha = prev;
    },
  };

  let rafId = 0;
  let last = performance.now();
  let elapsed = 0;
  let frames = 0;
  let frameCost = 0;
  let fading = false;
  let finished = false;

  const teardown = (): void => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    canvas.remove();
    opts.onDone?.();
  };

  const fadeOut = (): void => {
    if (fading) return;
    fading = true;
    canvas.style.transition = `opacity ${FADE_MS}ms ease-out`;
    canvas.style.opacity = '0';
    window.setTimeout(teardown, FADE_MS + 60);
  };

  const tick = (now: number): void => {
    if (finished) return;
    const frameStart = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;

    context.w = w;
    context.h = h;
    context.t = elapsed;
    context.dt = dt;

    raw.clearRect(0, 0, w, h);
    scene.frame(context);

    // Watchdog: if the opening frames run hot, halve particle budgets once.
    if (frames < WATCHDOG_FRAMES) {
      frames++;
      frameCost += performance.now() - frameStart;
      if (frames === WATCHDOG_FRAMES && frameCost / WATCHDOG_FRAMES > WATCHDOG_BUDGET_MS) {
        context.quality = 0.5;
      }
    }

    if (elapsed >= scene.duration) fadeOut();
    if (!fading || !finished) rafId = requestAnimationFrame(tick);
  };

  try {
    scene.init(context);
  } catch {
    teardown();
    return { stop: () => {}, done: true };
  }
  rafId = requestAnimationFrame((now) => {
    last = now;
    tick(now);
  });

  return {
    stop: teardown,
    get done() {
      return finished;
    },
  };
}
