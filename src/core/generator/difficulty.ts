/** Weekday difficulty knobs on the traditional Mon(1)…Sun(7) ramp. */

export interface DifficultyKnobs {
  /** Preferred clue difficulty tier (1–5); nearest available is used. */
  clueTier: number;
  /** Hard ceiling on clue difficulty for the day — no clue above this tier is
   * ever shown. This is where we sit *slightly easier than the NYT ramp*:
   * Monday is a firm gimme, and the ceiling tops out at 4 (never the most
   * devious tier-5), so Saturday/Sunday run ~a level friendlier than the Times. */
  clueCap: number;
  /** Minimum entry score allowed in generated fill. */
  scoreFloor: number;
  /** Max template openness to select. */
  maxOpenness: number;
  /** Mini size for the daily mini. */
  miniSize: 5 | 7;
}

// Calibrated to run easier than the New York Times' Mon→Sun ramp: a gentle
// step on Monday, easing further toward the end of the week. Dialed back a
// further notch after playtesting found the back half of the week (and
// especially the big Sunday grid) too hard even for an experienced solver —
// clue tier/cap are the lever eased here; Sunday's 21×21 stays the "grand"
// size by design, but a player who finds it too much can now dial the Size
// and Difficulty knobs down mid-solve (see the in-puzzle tune bar) without
// losing the session.
export const WEEKDAY_KNOBS: Record<number, DifficultyKnobs> = {
  0: { clueTier: 1, clueCap: 2, scoreFloor: 40, maxOpenness: 1, miniSize: 5 }, // Kids
  1: { clueTier: 1, clueCap: 1, scoreFloor: 55, maxOpenness: 3, miniSize: 5 }, // Mon
  2: { clueTier: 1, clueCap: 2, scoreFloor: 50, maxOpenness: 3, miniSize: 5 }, // Tue
  3: { clueTier: 2, clueCap: 2, scoreFloor: 45, maxOpenness: 4, miniSize: 5 }, // Wed
  4: { clueTier: 2, clueCap: 3, scoreFloor: 40, maxOpenness: 4, miniSize: 5 }, // Thu
  5: { clueTier: 3, clueCap: 3, scoreFloor: 35, maxOpenness: 4, miniSize: 5 }, // Fri
  6: { clueTier: 3, clueCap: 4, scoreFloor: 30, maxOpenness: 5, miniSize: 7 }, // Sat
  7: { clueTier: 2, clueCap: 3, scoreFloor: 35, maxOpenness: 5, miniSize: 7 }, // Sun (big but gentler)
};

/** ISO date string → weekday 1 (Mon) … 7 (Sun), in local time. */
export function weekdayOf(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number);
  const day = new Date(y!, m! - 1, d!).getDay(); // 0=Sun
  return day === 0 ? 7 : day;
}

/** 0 (Kids) … 7 (Sunday) — the single difficulty ladder used everywhere: the
 * in-puzzle tune knobs, Free Play, and the daily ramp. */
export function knobsFor(difficulty: number): DifficultyKnobs {
  return WEEKDAY_KNOBS[Math.min(7, Math.max(0, Math.round(difficulty)))]!;
}

/** Calibrated seconds per white cell by difficulty (index 0–7: Kids, Mon…Sun).
 * Shared by par-time estimation (`solve/speed.ts`) and the target-time knob. */
export const SEC_PER_CELL = [3.5, 4.5, 5, 5.5, 6, 7, 8, 7];

/** Approximate white-cell count per offered Free Play size (American grids). */
const SIZE_WHITE: [number, number][] = [
  [5, 21], [7, 41], [9, 67], [11, 103], [13, 133], [15, 187],
  [17, 226], [19, 285], [21, 340],
];

/** Estimated minutes to finish a size at a difficulty — the target-time knob's
 * forward model (white cells × sec/cell). */
export function estimateMinutes(size: number, difficulty: number): number {
  const white = SIZE_WHITE.find(([s]) => s === size)?.[1]
    ?? Math.round((size * size) * 0.83);
  const spc = SEC_PER_CELL[Math.min(7, Math.max(0, Math.round(difficulty)))] ?? 6;
  return (white * spc) / 60;
}

/** Invert the estimate: pick the offered size whose finish time is closest to
 * the player's target minutes at the given difficulty. */
export function sizeForTargetMinutes(minutes: number, difficulty: number): number {
  let best = 5;
  let bestDelta = Infinity;
  for (const [size] of SIZE_WHITE) {
    const delta = Math.abs(estimateMinutes(size, difficulty) - minutes);
    if (delta < bestDelta) { bestDelta = delta; best = size; }
  }
  return best;
}
