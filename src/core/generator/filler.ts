/** Backtracking grid filler with MRV slot selection and forward checking.
 * Deterministic for a given (bank, template, seed) triple. */

import { deriveSlots, isBlockAt, type GridInfo } from '../grid.ts';
import type { BankEntry, Slot } from '../types.ts';
import type { Rng } from '../rng.ts';
import { countCandidates, candidates, type BankIndex } from './index.ts';

export interface FillOptions {
  /** Entries below this score are excluded (easy days keep fill friendly). */
  scoreFloor?: number;
  /** Backtracking step budget before giving up. */
  maxSteps?: number;
  /** Answers that must be placed first (theme entries), longest first. */
  seedEntries?: string[];
  /** Multiplier per category (adaptive nudges), clamped by caller. */
  categoryWeights?: Record<string, number>;
  /** Random jitter strength 0..1 applied to candidate ordering. */
  jitter?: number;
  /** Cap on how many candidates to try per slot per visit (beam width). */
  beamWidth?: number;
  /** Debug: log MRV choices and dead ends (node-side tooling only). */
  trace?: (msg: string) => void;
  /**
   * Slot selection strategy. 'mrv' = fewest raw candidates (fills short
   * slots early); 'ratio' = fewest relative to bucket size, longest first
   * (constructor-style). Rugged banks benefit from alternating across
   * restarts — neither dominates on every template.
   */
  selection?: 'mrv' | 'ratio';
}

/** Relative English letter frequency (A…Z), normalized to max 1. */
const LETTER_FREQ = [
  0.65, 0.12, 0.22, 0.34, 1.0, 0.18, 0.16, 0.49, 0.56, 0.01, 0.06, 0.32,
  0.19, 0.54, 0.6, 0.15, 0.01, 0.48, 0.51, 0.73, 0.22, 0.08, 0.19, 0.01,
  0.16, 0.01,
];

export interface FillResult {
  ok: boolean;
  /** Complete letter grid rows on success. */
  grid?: string[];
  /** Answer → bank entry for every placed slot on success. */
  placed?: Map<string, BankEntry>;
  steps: number;
  reason?: 'no-candidates' | 'budget' | 'seed-unplaceable';
}

interface SlotState {
  slot: Slot;
  pattern: () => string;
  filled: boolean;
  crossings: { other: number; myPos: number; otherPos: number }[];
}

export function fill(
  template: string[],
  bank: BankIndex,
  rng: Rng,
  opts: FillOptions = {},
): FillResult {
  const scoreFloor = opts.scoreFloor ?? 0;
  const maxSteps = opts.maxSteps ?? 60_000;
  const jitter = opts.jitter ?? 0.25;
  const beamWidth = opts.beamWidth ?? 24;
  const weights = opts.categoryWeights ?? {};

  const rows = template.length;
  const cols = template[0]?.length ?? 0;
  const cells: string[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) cells.push(template[r]![c]!);
  }
  const at = (r: number, c: number): string => cells[r * cols + c]!;
  const setAt = (r: number, c: number, ch: string): void => {
    cells[r * cols + c] = ch;
  };

  const info: GridInfo = deriveSlots(template, 3);
  const slotIndexById = new Map<string, number>();
  info.slots.forEach((s, i) => slotIndexById.set(s.id, i));

  const states: SlotState[] = info.slots.map((slot) => ({
    slot,
    filled: false,
    pattern: () => slot.cells.map(({ row, col }) => {
      const ch = at(row, col);
      return ch === '.' ? '?' : ch;
    }).join(''),
    crossings: [],
  }));

  // Precompute crossings between across and down slots.
  for (let i = 0; i < states.length; i++) {
    const s = states[i]!;
    s.slot.cells.forEach((cell, myPos) => {
      const [aId, dId] = info.cellSlots[cell.row]![cell.col]!;
      const otherId = s.slot.dir === 'across' ? dId : aId;
      if (!otherId) return;
      const other = slotIndexById.get(otherId)!;
      const otherSlot = info.slots[other]!;
      const otherPos = otherSlot.cells.findIndex(
        (c2) => c2.row === cell.row && c2.col === cell.col,
      );
      s.crossings.push({ other, myPos, otherPos });
    });
  }

  const used = new Set<string>();
  const placed = new Map<string, BankEntry>();
  let steps = 0;

  const idxFor = (len: number) => bank.byLen.get(len);

  const candidateCount = (i: number): number => {
    const s = states[i]!;
    const idx = idxFor(s.slot.cells.length);
    if (!idx) return 0;
    return countCandidates(idx, s.pattern());
  };

  // --- Seed theme entries ---------------------------------------------------
  // Placement is part of the search: if a seed arrangement leaves the grid
  // unfillable, alternative slots for each seed are tried before failing.
  const seeds = [...(opts.seedEntries ?? [])].sort((a, b) => b.length - a.length);
  let anySeedPlaceable = seeds.length === 0;

  const placeSeed = (answer: string, slotIdx: number): (() => void) => {
    const s = states[slotIdx]!;
    const prev = s.slot.cells.map(({ row, col }) => at(row, col));
    s.slot.cells.forEach((cell, p) => setAt(cell.row, cell.col, answer[p]!));
    s.filled = true;
    used.add(answer);
    placed.set(s.slot.id, bank.byAnswer.get(answer) ?? {
      answer, score: 60, categories: ['wordplay'], tags: ['theme'], clues: [],
    });
    return () => {
      s.slot.cells.forEach((cell, p) => setAt(cell.row, cell.col, prev[p]!));
      s.filled = false;
      used.delete(answer);
      placed.delete(s.slot.id);
    };
  };

  const solveWithSeeds = (k: number): boolean => {
    if (k >= seeds.length) {
      anySeedPlaceable = true;
      return solve();
    }
    const answer = seeds[k]!;
    const options: number[] = [];
    states.forEach((s, i) => {
      if (s.filled || s.slot.cells.length !== answer.length) return;
      const pattern = s.pattern();
      for (let p = 0; p < answer.length; p++) {
        if (pattern[p] !== '?' && pattern[p] !== answer[p]) return;
      }
      options.push(i);
    });
    rng.shuffle(options);
    for (const i of options) {
      const undo = placeSeed(answer, i);
      if (solveWithSeeds(k + 1)) return true;
      undo();
      if (steps > maxSteps) return false;
    }
    return false;
  };

  // --- Backtracking fill ----------------------------------------------------
  const solve = (): boolean => {
    // Slot selection: most-constrained-first, where "constrained" is the
    // candidate count RELATIVE to the slot's whole length bucket. Raw MRV
    // would fill short slots first (small buckets), strangling the long
    // slots — constructors place long entries first for a reason. Ties
    // break toward longer slots.
    let best = -1;
    let bestCount = Infinity;
    let bestRatio = Infinity;
    let bestLen = 0;
    for (let i = 0; i < states.length; i++) {
      if (states[i]!.filled) continue;
      const count = candidateCount(i);
      if (count === 0) {
        best = i;
        bestCount = 0;
        break;
      }
      const len = states[i]!.slot.cells.length;
      const bucket = opts.selection === 'mrv' ? 1 : idxFor(len)?.entries.length ?? 1;
      const ratio = count / bucket;
      if (ratio < bestRatio || (ratio === bestRatio && len > bestLen)) {
        bestRatio = ratio;
        bestCount = count;
        bestLen = len;
        best = i;
      }
    }
    if (best === -1) return true; // all filled
    if (bestCount === 0) {
      opts.trace?.(`dead: ${states.find((x, i) => !x.filled && candidateCount(i) === 0)?.slot.id ?? states[best]!.slot.id} pattern=${states[best]!.pattern()} 0 candidates`);
      return false;
    }
    opts.trace?.(`pick ${states[best]!.slot.id} pattern=${states[best]!.pattern()} candidates=${bestCount}`);

    const s = states[best]!;
    const idx = idxFor(s.slot.cells.length)!;
    const pattern = s.pattern();

    // Crossing-friendliness: positions of this slot that sit on unfilled
    // crossing slots. Candidates get a bonus for common letters there —
    // on sparse banks this is the difference between filling and dying.
    const openCross: number[] = [];
    for (const { other, myPos } of s.crossings) {
      if (!states[other]!.filled) openCross.push(myPos);
    }

    // Collect + order candidates: crossing bonus dominates, then score,
    // adaptive weights, and seeded jitter.
    const opts_: { entry: BankEntry; sort: number }[] = [];
    for (const entry of candidates(idx, pattern)) {
      if (entry.score < scoreFloor) continue;
      if (used.has(entry.answer)) continue;
      let w = 1;
      for (const cat of entry.categories) w *= weights[cat] ?? 1;
      let crossBonus = 0;
      for (const p of openCross) crossBonus += LETTER_FREQ[entry.answer.charCodeAt(p) - 65] ?? 0;
      if (openCross.length > 0) crossBonus /= openCross.length;
      opts_.push({
        entry,
        sort: (crossBonus * 100 + entry.score) * w * (1 - jitter * rng.next()),
      });
    }
    opts_.sort((a, b) => b.sort - a.sort);
    const beam = opts_.slice(0, beamWidth);

    for (const { entry } of beam) {
      if (++steps > maxSteps) return false;

      // Place.
      const prev: string[] = [];
      s.slot.cells.forEach((cell, p) => {
        prev.push(at(cell.row, cell.col));
        setAt(cell.row, cell.col, entry.answer[p]!);
      });
      s.filled = true;
      used.add(entry.answer);
      placed.set(s.slot.id, entry);

      // Forward check: every crossing slot must retain ≥1 candidate.
      let viable = true;
      for (const { other } of s.crossings) {
        const o = states[other]!;
        if (o.filled) continue;
        if (candidateCount(other) === 0) {
          viable = false;
          break;
        }
      }

      if (viable && solve()) return true;

      // Undo.
      s.slot.cells.forEach((cell, p) => setAt(cell.row, cell.col, prev[p]!));
      s.filled = false;
      used.delete(entry.answer);
      placed.delete(s.slot.id);
      if (steps > maxSteps) return false;
    }
    return false;
  };

  const ok = solveWithSeeds(0);
  if (!ok) {
    const reason = steps > maxSteps
      ? 'budget'
      : anySeedPlaceable ? 'no-candidates' : 'seed-unplaceable';
    return { ok: false, steps, reason };
  }

  const grid: string[] = [];
  for (let r = 0; r < rows; r++) {
    let row = '';
    for (let c = 0; c < cols; c++) {
      row += isBlockAt(template, r, c) ? '#' : at(r, c);
    }
    grid.push(row);
  }
  return { ok: true, grid, placed, steps };
}
