/** Victory choreography: grid ripple at t=0, canvas scene at ~150ms, and the
 * celebration card held back until the scene has fully played AND faded — the
 * animation owns the stage, then the card rises into empty space (never over a
 * live or fading scene). A tap or key press skips straight to the card for
 * anyone who doesn't want to wait it out. Honors prefers-reduced-motion and the
 * "Victory animations" setting by going straight to the card. */

import { getSettings } from '../../storage/settings.ts';
import { playScene, type PlayHandle } from './engine.ts';
import { pickScene } from './registry.ts';
import { playGridWave } from './gridWave.ts';
import type { Rect } from './types.ts';

export interface VictoryOptions {
  /** Stable per-puzzle key — dailies share one scene worldwide per day. */
  seedKey: string;
  gridEl: HTMLElement | null;
  title: string;
  timeText: string;
  /** Called when the celebration modal should rise (exactly once).
   * `animated` is false when the scene was skipped — the modal should fall
   * back to its own built-in confetti. */
  onModalCue: (animated: boolean) => void;
}

const SCENE_START_MS = 150;
const SCENE_FADE_MS = 600;   // mirror the engine's fade-out
const CUE_FALLBACK_MS = 900; // margin past the scene's full run + fade

export function playVictory(opts: VictoryOptions): PlayHandle {
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (reduced || !getSettings().victoryAnimations) {
    opts.onModalCue(false);
    return { stop: () => {}, done: true };
  }

  const skin = document.documentElement.dataset.skin ?? 'classic';
  const scene = pickScene(skin, opts.seedKey);
  const gridRect: Rect | null = opts.gridEl
    ? (({ x, y, width, height }) => ({ x, y, w: width, h: height }))(opts.gridEl.getBoundingClientRect())
    : null;

  playGridWave(opts.gridEl);

  let inner: PlayHandle | null = null;
  let cued = false;

  const onSkipInput = (): void => stop();
  const teardownInput = (): void => {
    document.removeEventListener('pointerdown', onSkipInput, true);
    document.removeEventListener('keydown', onSkipInput, true);
  };
  const cue = (): void => {
    if (cued) return;
    cued = true;
    teardownInput();
    opts.onModalCue(true);
  };
  const stop = (): void => {
    window.clearTimeout(sceneTimer);
    window.clearTimeout(cueTimer);
    inner?.stop(); // triggers the scene's onDone → cue(), and tears the canvas down
    cue();         // …and cue directly in case the scene never started
  };

  const sceneTimer = window.setTimeout(() => {
    // Primary cue is the scene's onDone — it fires once the scene has played its
    // full duration AND faded out, so the card rises into empty space with zero
    // overlap. (A self-terminating scene, e.g. an init error, cues at once.)
    inner = playScene(scene, {
      seedKey: opts.seedKey,
      gridRect,
      title: opts.title,
      timeText: opts.timeText,
      onDone: cue,
    });
  }, SCENE_START_MS);
  // Fallback only: if onDone is never delivered (rAF throttled in a background
  // tab), still raise the card a beat after the scene's full run + fade.
  const cueTimer = window.setTimeout(cue, SCENE_START_MS + scene.duration * 1000 + SCENE_FADE_MS + CUE_FALLBACK_MS);

  // Tap or press any key to skip the flourish and see the time card now.
  document.addEventListener('pointerdown', onSkipInput, true);
  document.addEventListener('keydown', onSkipInput, true);

  return {
    stop,
    get done() {
      return inner?.done ?? false;
    },
  };
}
