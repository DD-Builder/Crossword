/** Speed Challenge: race par + your personal best, with a ghost that
 * repaints your PB solve cell-by-cell alongside the live one. */

import type { SolveSession, FillEvent } from './session.ts';
import { loadJson, saveJson } from '../storage/settings.ts';
import type { Puzzle } from '../core/types.ts';

export interface SpeedRecord {
  ms: number;
  fillOrder: FillEvent[];
  when: number;
}

function pbKey(puzzle: Puzzle): string {
  // PB per (kind, size, weekday difficulty) — "my best Tuesday mini".
  return `speedpb.${puzzle.kind}.${puzzle.size.rows}.${puzzle.difficulty}`;
}

/** Par: calibrated seconds/cell by difficulty, on the traditional ramp. */
export function parMsFor(puzzle: Puzzle): number {
  const whiteCells = puzzle.grid.join('').replace(/#/g, '').length;
  const secPerCell = [0, 4.5, 5, 5.5, 6, 7, 8, 7][puzzle.difficulty] ?? 6;
  return Math.round(whiteCells * secPerCell) * 1000;
}

export function getSpeedPb(puzzle: Puzzle): SpeedRecord | null {
  return loadJson<SpeedRecord | null>(pbKey(puzzle), null);
}

export function maybeSaveSpeedPb(session: SolveSession): { improved: boolean; prev: SpeedRecord | null } {
  const prev = getSpeedPb(session.puzzle);
  const ms = session.activeMs();
  // Reveals disqualify a speed record; checks/hints just cost time.
  if (session.counts.reveals > 0) return { improved: false, prev };
  if (prev && prev.ms <= ms) return { improved: false, prev };
  saveJson(pbKey(session.puzzle), {
    ms,
    fillOrder: session.fillOrder.slice(0, 2000),
    when: Date.now(),
  } satisfies SpeedRecord);
  return { improved: true, prev };
}

export interface Ghost {
  /** Cells the PB run had filled by time t. */
  filledAt(t: number): number;
  total: number;
  pbMs: number;
}

export function makeGhost(pb: SpeedRecord): Ghost {
  const order = pb.fillOrder;
  return {
    total: order.length,
    pbMs: pb.ms,
    filledAt(t: number): number {
      // Binary search: count of events with time ≤ t.
      let lo = 0;
      let hi = order.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (order[mid]!.t <= t) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    },
  };
}
