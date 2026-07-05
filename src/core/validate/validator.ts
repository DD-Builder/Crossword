/** Puzzle validator — the single source of truth for correctness, shared by
 * the runtime, authoring scripts, and tests. Returns a list of problems;
 * an empty list means the puzzle is sound. */

import {
  deriveSlots,
  isCompleteGrid,
  isConnected,
  isFullyChecked,
  isSymmetric,
  slotAnswer,
} from '../grid';
import { CATEGORIES, type Clue, type Puzzle } from '../types';

export interface Problem {
  level: 'error' | 'warn';
  where: string;
  message: string;
}

const err = (where: string, message: string): Problem => ({ level: 'error', where, message });
const warn = (where: string, message: string): Problem => ({ level: 'warn', where, message });

export interface ValidateOptions {
  /** Enforce 180° rotational symmetry (standard for real puzzles). */
  symmetry?: boolean;
  /** Enforce that every white cell is crossed both ways. */
  fullyChecked?: boolean;
  /** Minimum slot length (3 for standard crosswords). */
  minLen?: number;
}

/** Simple inflection stems so "Cookie" can't clue OREO as "cookies", etc. */
function answerLeaksIntoClue(answer: string, clue: string): boolean {
  const norm = clue.toUpperCase().replace(/[^A-Z]/g, ' ');
  const words = norm.split(/\s+/).filter(Boolean);
  const target = answer.toUpperCase();
  if (target.length < 3) return words.includes(target);
  const stems = new Set([target]);
  if (target.endsWith('S')) stems.add(target.slice(0, -1));
  if (target.endsWith('ES')) stems.add(target.slice(0, -2));
  if (target.endsWith('ED')) stems.add(target.slice(0, -2));
  if (target.endsWith('ING')) stems.add(target.slice(0, -3));
  return words.some((w) => {
    if (w.length < 3) return false;
    const wStems = new Set([w]);
    if (w.endsWith('S')) wStems.add(w.slice(0, -1));
    if (w.endsWith('ES')) wStems.add(w.slice(0, -2));
    if (w.endsWith('ED')) wStems.add(w.slice(0, -2));
    if (w.endsWith('ING')) wStems.add(w.slice(0, -3));
    for (const s of stems) if (wStems.has(s)) return true;
    return false;
  });
}

export function validatePuzzle(puzzle: Puzzle, opts: ValidateOptions = {}): Problem[] {
  const problems: Problem[] = [];
  const symmetry = opts.symmetry ?? true;
  const fullyChecked = opts.fullyChecked ?? true;
  const minLen = opts.minLen ?? 3;
  const { grid, size } = puzzle;

  // -- Grid shape ---------------------------------------------------------
  if (grid.length !== size.rows) {
    problems.push(err('grid', `Expected ${size.rows} rows, got ${grid.length}`));
    return problems;
  }
  for (let r = 0; r < grid.length; r++) {
    if (grid[r]!.length !== size.cols) {
      problems.push(err('grid', `Row ${r} has width ${grid[r]!.length}, expected ${size.cols}`));
      return problems;
    }
  }
  if (!isCompleteGrid(grid)) {
    problems.push(err('grid', 'Grid contains characters other than A–Z and #'));
    return problems;
  }
  if (symmetry && !isSymmetric(grid)) problems.push(err('grid', 'Block pattern is not 180° symmetric'));
  if (!isConnected(grid)) problems.push(err('grid', 'White cells are not fully connected'));
  if (fullyChecked && !isFullyChecked(grid, minLen)) {
    problems.push(err('grid', 'Not every cell is checked in both directions'));
  }

  // -- Slots vs clues ------------------------------------------------------
  const info = deriveSlots(grid, minLen);
  const short = info.slots.find((s) => s.cells.length < minLen);
  if (short) problems.push(err(short.id, `Slot length ${short.cells.length} < ${minLen}`));

  for (const dir of ['across', 'down'] as const) {
    const slots = info.slots.filter((s) => s.dir === dir);
    const clues = puzzle.clues[dir];
    const byNum = new Map<number, Clue>();
    for (const clue of clues) {
      if (byNum.has(clue.num)) problems.push(err(`${clue.num}-${dir}`, 'Duplicate clue number'));
      byNum.set(clue.num, clue);
    }
    for (const slot of slots) {
      const clue = byNum.get(slot.num);
      const expected = slotAnswer(grid, slot);
      if (!clue) {
        problems.push(err(slot.id, `No clue for ${slot.num}-${dir} (${expected})`));
        continue;
      }
      byNum.delete(slot.num);
      if (clue.answer !== expected) {
        problems.push(err(slot.id, `Clue answer ${clue.answer} ≠ grid answer ${expected}`));
      }
      if (!clue.clue || clue.clue.trim().length === 0) {
        problems.push(err(slot.id, 'Empty clue text'));
      } else if (answerLeaksIntoClue(clue.answer, clue.clue)) {
        problems.push(err(slot.id, `Clue text leaks its own answer: "${clue.clue}"`));
      }
      if (!Number.isInteger(clue.stars) || clue.stars < 1 || clue.stars > 5) {
        problems.push(err(slot.id, `stars must be 1–5, got ${clue.stars}`));
      }
      if (!CATEGORIES.includes(clue.category)) {
        problems.push(err(slot.id, `Unknown category "${clue.category}"`));
      }
    }
    for (const orphan of byNum.keys()) {
      problems.push(err(`${orphan}-${dir}`, 'Clue has no matching slot in the grid'));
    }
  }

  // -- Duplicate answers ----------------------------------------------------
  const seen = new Map<string, string>();
  for (const slot of info.slots) {
    const ans = slotAnswer(grid, slot);
    const prev = seen.get(ans);
    if (prev) problems.push(err(slot.id, `Answer ${ans} duplicates ${prev}`));
    seen.set(ans, slot.id);
  }

  // -- Theme entries ---------------------------------------------------------
  if (puzzle.theme) {
    const answers = new Set(info.slots.map((s) => slotAnswer(grid, s)));
    for (const entry of puzzle.theme.entries) {
      if (!answers.has(entry)) {
        problems.push(err('theme', `Theme entry ${entry} not present as a grid answer`));
      }
    }
    if (puzzle.theme.entries.length === 0) {
      problems.push(warn('theme', 'Theme declared but has no entries'));
    }
  }

  // -- Daily metadata ----------------------------------------------------------
  if (puzzle.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(puzzle.date)) {
    problems.push(err('meta', `date must be YYYY-MM-DD, got "${puzzle.date}"`));
  }
  if (!Number.isInteger(puzzle.difficulty) || puzzle.difficulty < 1 || puzzle.difficulty > 7) {
    problems.push(err('meta', `difficulty must be 1–7, got ${puzzle.difficulty}`));
  }

  return problems;
}

export function assertValid(puzzle: Puzzle, opts?: ValidateOptions): void {
  const errors = validatePuzzle(puzzle, opts).filter((p) => p.level === 'error');
  if (errors.length > 0) {
    throw new Error(
      `Puzzle ${puzzle.id} invalid:\n` + errors.map((e) => `  [${e.where}] ${e.message}`).join('\n'),
    );
  }
}
