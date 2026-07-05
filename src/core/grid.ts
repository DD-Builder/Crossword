/** Grid math: numbering, slot derivation, symmetry, connectivity.
 * The grid (array of row strings) is the single source of truth —
 * clue numbers and slots are always recomputed from it. */

import { BLOCK, isLetter, type Cell, type Direction, type Slot } from './types';

export interface GridInfo {
  rows: number;
  cols: number;
  slots: Slot[];
  /** Clue number shown in each cell, 0 if none. Indexed [row][col]. */
  numbers: number[][];
  /** slotId → Slot for quick lookup. */
  byId: Map<string, Slot>;
  /** For each cell, the slot ids crossing it: [across, down] (either may be null). */
  cellSlots: (readonly [string | null, string | null])[][];
}

export function isBlockAt(grid: string[], r: number, c: number): boolean {
  if (r < 0 || c < 0 || r >= grid.length) return true;
  const row = grid[r]!;
  if (c >= row.length) return true;
  return row[c] === BLOCK;
}

/** Derive numbering and slots from a grid, NYT-style:
 * a cell starts an across slot if it's open, has a block/edge to its left,
 * and at least `minLen` open cells rightward (similarly for down). */
export function deriveSlots(grid: string[], minLen = 2): GridInfo {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  for (const row of grid) {
    if (row.length !== cols) throw new Error(`Ragged grid: expected width ${cols}, got ${row.length}`);
  }

  const slots: Slot[] = [];
  const numbers: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  const cellSlots: [string | null, string | null][][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => [null, null] as [string | null, string | null]),
  );

  let num = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isBlockAt(grid, r, c)) continue;

      const startsAcross = isBlockAt(grid, r, c - 1) && !isBlockAt(grid, r, c + 1);
      const startsDown = isBlockAt(grid, r - 1, c) && !isBlockAt(grid, r + 1, c);
      if (!startsAcross && !startsDown) continue;

      let assigned = false;
      if (startsAcross) {
        const cells: Cell[] = [];
        for (let cc = c; !isBlockAt(grid, r, cc); cc++) cells.push({ row: r, col: cc });
        if (cells.length >= minLen) {
          if (!assigned) { num++; assigned = true; }
          const slot: Slot = { num, dir: 'across', cells, id: `${num}-across` };
          slots.push(slot);
          for (const cell of cells) cellSlots[cell.row]![cell.col]![0] = slot.id;
        }
      }
      if (startsDown) {
        const cells: Cell[] = [];
        for (let rr = r; !isBlockAt(grid, rr, c); rr++) cells.push({ row: rr, col: c });
        if (cells.length >= minLen) {
          if (!assigned) { num++; assigned = true; }
          const slot: Slot = { num, dir: 'down', cells, id: `${num}-down` };
          slots.push(slot);
          for (const cell of cells) cellSlots[cell.row]![cell.col]![1] = slot.id;
        }
      }
      if (assigned) numbers[r]![c] = num;
    }
  }

  const byId = new Map(slots.map((s) => [s.id, s]));
  return { rows, cols, slots, numbers, byId, cellSlots };
}

/** Read a slot's current answer from a (possibly partial) letter grid. */
export function slotAnswer(grid: string[], slot: Slot): string {
  return slot.cells.map(({ row, col }) => grid[row]![col]!).join('');
}

/** 180° rotational symmetry of the block pattern. */
export function isSymmetric(grid: string[]): boolean {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = grid[r]![c] === BLOCK;
      const b = grid[rows - 1 - r]![cols - 1 - c] === BLOCK;
      if (a !== b) return false;
    }
  }
  return true;
}

/** All white cells form one connected region (4-neighbor BFS). */
export function isConnected(grid: string[]): boolean {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  let start: Cell | null = null;
  let whiteCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isBlockAt(grid, r, c)) {
        whiteCount++;
        if (!start) start = { row: r, col: c };
      }
    }
  }
  if (!start) return false;

  const seen = new Set<number>([start.row * cols + start.col]);
  const queue: Cell[] = [start];
  while (queue.length > 0) {
    const { row, col } = queue.pop()!;
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      const r = row + dr;
      const c = col + dc;
      const key = r * cols + c;
      if (!isBlockAt(grid, r, c) && !seen.has(key)) {
        seen.add(key);
        queue.push({ row: r, col: c });
      }
    }
  }
  return seen.size === whiteCount;
}

/** Shortest slot length in the grid (Infinity if no slots). */
export function minSlotLength(grid: string[]): number {
  const { slots } = deriveSlots(grid, 1);
  return slots.reduce((min, s) => Math.min(min, s.cells.length), Infinity);
}

/** Every white cell belongs to both an across and a down slot (fully checked). */
export function isFullyChecked(grid: string[], minLen = 3): boolean {
  const { cellSlots } = deriveSlots(grid, minLen);
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[0]?.length ?? 0); c++) {
      if (isBlockAt(grid, r, c)) continue;
      const [a, d] = cellSlots[r]![c]!;
      if (!a || !d) return false;
    }
  }
  return true;
}

/** Every cell is a block or an A–Z letter (i.e. the grid is complete/valid). */
export function isCompleteGrid(grid: string[]): boolean {
  return grid.every((row) => [...row].every((ch) => ch === BLOCK || isLetter(ch)));
}

/** Build a template grid (all-open letters '.' replaced later) from blocks. */
export function templateToGrid(size: number, blocks: [number, number][]): string[] {
  const cells: string[][] = Array.from({ length: size }, () => Array<string>(size).fill('.'));
  for (const [r, c] of blocks) {
    if (r < 0 || r >= size || c < 0 || c >= size) throw new Error(`Block out of bounds: ${r},${c}`);
    cells[r]![c] = BLOCK;
  }
  return cells.map((row) => row.join(''));
}
