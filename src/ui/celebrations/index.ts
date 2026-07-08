/** Victory choreography: grid ripple at t=0, canvas scene at ~150ms, and the
 * celebration modal held back until the scene has run its full course — the
 * animation gets the stage to itself, then the time card rises as it fades
 * (no more card veiling a still-playing scene). Honors prefers-reduced-motion
 * and the "Victory animations" setting by skipping straight to the modal. */

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
  const cue = (): void => {
    if (cued) return;
    cued = true;
    opts.onModalCue(true);
  };
  const sceneTimer = window.setTimeout(() => {
    // onDone is the early-exit backstop: a self-terminating scene (e.g. an init
    // error tears down immediately) cues the card at once instead of stranding
    // it behind a blank screen for the full duration.
    inner = playScene(scene, {
      seedKey: opts.seedKey,
      gridRect,
      title: opts.title,
      timeText: opts.timeText,
      onDone: cue,
    });
  }, SCENE_START_MS);
  // Primary cue: the card rises exactly as the scene reaches the end of its run
  // and begins to fade, so the animation gets the full stage first and the card
  // crossfades in over the tail — never veiling a live scene.
  const cueTimer = window.setTimeout(cue, SCENE_START_MS + scene.duration * 1000);

  return {
    stop() {
      window.clearTimeout(sceneTimer);
      window.clearTimeout(cueTimer);
      cue(); // never strand the modal
      inner?.stop();
    },
    get done() {
      return inner?.done ?? false;
    },
  };
}
