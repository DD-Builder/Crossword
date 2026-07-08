/** Victory-animation contracts. Scenes are pure functions of a SceneContext
 * so they run against a stub 2D context in unit tests — no scene may touch
 * `document` at import time or inside init/frame. */

import type { Rng } from '../../core/rng.ts';

/** The slice of CanvasRenderingContext2D scenes are allowed to use.
 * Structural, so tests can pass a no-op stub. */
export interface Ctx2D {
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(rad: number): void;
  scale(x: number, y: number): void;
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  globalAlpha: number;
  globalCompositeOperation: string;
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  font: string;
  textAlign: string;
  textBaseline: string;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void;
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient;
}

/** Skin colors sampled from the live CSS tokens at play time — scenes
 * automatically harmonize with the active skin × light/dark mode. */
export interface Palette {
  bg: string;
  surface: string;
  ink: string;
  inkMuted: string;
  accent: string;
  accentSoft: string;
  cellSelected: string;
  cellBlock: string;
  good: string;
  warn: string;
  bad: string;
  fontDisplay: string;
  /** True when the resolved mode is dark — some scenes flip their physics. */
  dark: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneContext {
  ctx: Ctx2D;
  /** Viewport size in CSS pixels (DPR is handled by the engine transform). */
  w: number;
  h: number;
  /** Seconds since the scene started / since last frame. */
  t: number;
  dt: number;
  /** 1 = full particle budgets; the perf watchdog may halve it. */
  quality: number;
  /** Viewport-relative scale unit: `min(w,h) / 720`. Multiply fixed hero sizes
   * by this so figures fill the screen instead of sitting tiny on large displays
   * (1 at a 720px baseline, ~1.5 on a tall desktop). */
  unit: number;
  palette: Palette;
  rng: Rng;
  /** Where the solved grid sits on screen, if known. */
  gridRect: Rect | null;
  title: string;
  timeText: string;
  /** Soft radial glow, sprite-cached by the engine (no-op in tests). */
  drawGlow(x: number, y: number, r: number, color: string, alpha?: number): void;
}

export interface Scene {
  /** `${skin}/${name}` — unique across the registry. */
  id: string;
  skin: string;
  /** Seconds before the engine fades the canvas out. */
  duration: number;
  init(c: SceneContext): void;
  frame(c: SceneContext): void;
}
