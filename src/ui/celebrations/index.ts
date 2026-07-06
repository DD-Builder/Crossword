/** Victory choreography: grid ripple at t=0, canvas scene at ~150ms, the
 * celebration modal cued at 1.4s so the scene gets a beat to shine first.
 * Honors prefers-reduced-motion and the "Victory animations" setting by
 * skipping straight to the modal. */

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

const MODAL_CUE_MS = 1400;
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
    inner = playScene(scene, {
      seedKey: opts.seedKey,
      gridRect,
      title: opts.title,
      timeText: opts.timeText,
    });
  }, SCENE_START_MS);
  const cueTimer = window.setTimeout(cue, MODAL_CUE_MS);

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
