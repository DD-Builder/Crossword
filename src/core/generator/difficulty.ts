/** Weekday difficulty knobs on the traditional Mon(1)…Sun(7) ramp. */

export interface DifficultyKnobs {
  /** Preferred clue difficulty tier (1–5); nearest available is used. */
  clueTier: number;
  /** Minimum entry score allowed in generated fill. */
  scoreFloor: number;
  /** Max template openness to select. */
  maxOpenness: number;
  /** Mini size for the daily mini. */
  miniSize: 5 | 7;
}

export const WEEKDAY_KNOBS: Record<number, DifficultyKnobs> = {
  1: { clueTier: 1, scoreFloor: 55, maxOpenness: 3, miniSize: 5 }, // Mon
  2: { clueTier: 2, scoreFloor: 50, maxOpenness: 3, miniSize: 5 }, // Tue
  3: { clueTier: 3, scoreFloor: 45, maxOpenness: 4, miniSize: 5 }, // Wed
  4: { clueTier: 3, scoreFloor: 40, maxOpenness: 4, miniSize: 5 }, // Thu
  5: { clueTier: 4, scoreFloor: 35, maxOpenness: 4, miniSize: 5 }, // Fri
  6: { clueTier: 5, scoreFloor: 30, maxOpenness: 5, miniSize: 7 }, // Sat
  7: { clueTier: 4, scoreFloor: 35, maxOpenness: 5, miniSize: 7 }, // Sun (themed, a notch friendlier than Sat)
};

/** ISO date string → weekday 1 (Mon) … 7 (Sun), in local time. */
export function weekdayOf(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number);
  const day = new Date(y!, m! - 1, d!).getDay(); // 0=Sun
  return day === 0 ? 7 : day;
}

export function knobsFor(difficulty: number): DifficultyKnobs {
  return WEEKDAY_KNOBS[Math.min(7, Math.max(1, Math.round(difficulty)))]!;
}
