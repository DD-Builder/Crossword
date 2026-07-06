/** Solve-state machine. Single source of truth for everything the solver
 * UI renders: cursor, direction, entered letters, pencil marks, check and
 * reveal state, timer, and completion. DOM-free and fully unit-testable —
 * views subscribe via a Store and render dumbly. */

import { deriveSlots, isBlockAt, slotAnswer, type GridInfo } from '../core/grid.ts';
import type { Direction, Puzzle, Slot } from '../core/types.ts';
import { createStore, type Store } from '../ui/store.ts';

export type CellFlag = 'none' | 'checked-wrong' | 'revealed' | 'confirmed';

export interface CellState {
  /** User-entered letter, '' when empty. Blocks never appear here. */
  letter: string;
  pencil: boolean;
  flag: CellFlag;
}

export interface SessionCounts {
  checks: number;
  reveals: number;
  hints: number;
  /** Letters that were typed and later proved wrong (via check/autocheck). */
  wrongLetters: number;
}

export interface FillEvent {
  index: number; // row * cols + col
  t: number;     // activeMs when filled
}

export interface SessionState {
  version: number;
  cursor: { row: number; col: number };
  direction: Direction;
  paused: boolean;
  completed: boolean;
  /** True once completed with zero reveals and zero checked-wrong events. */
  flawless: boolean;
  activeMs: number;
  pencilMode: boolean;
  autocheck: boolean;
}

export interface ClueTiming {
  firstFocusMs: number | null;
  solvedMs: number | null;
  wrongLetters: number;
  hintTiers: number[];
  revealed: boolean;
}

export class SolveSession {
  readonly puzzle: Puzzle;
  readonly info: GridInfo;
  readonly cells: CellState[];
  readonly counts: SessionCounts = { checks: 0, reveals: 0, hints: 0, wrongLetters: 0 };
  readonly fillOrder: FillEvent[] = [];
  readonly clueTimings = new Map<string, ClueTiming>();
  readonly store: Store<SessionState>;

  private readonly now: () => number;
  private startWall: number;
  private accumulated = 0;
  private pausedFlag = false;
  private completedFlag = false;
  private everWrong = false;

  constructor(puzzle: Puzzle, opts: { autocheck?: boolean; now?: () => number } = {}) {
    this.puzzle = puzzle;
    this.info = deriveSlots(puzzle.grid, 3);
    this.now = opts.now ?? (() => performance.now());
    this.startWall = this.now();

    const { rows, cols } = this.info;
    this.cells = Array.from({ length: rows * cols }, () => ({
      letter: '',
      pencil: false,
      flag: 'none' as CellFlag,
    }));

    for (const slot of this.info.slots) {
      this.clueTimings.set(slot.id, {
        firstFocusMs: null,
        solvedMs: null,
        wrongLetters: 0,
        hintTiers: [],
        revealed: false,
      });
    }

    const first = this.info.slots.find((s) => s.dir === 'across') ?? this.info.slots[0]!;
    this.store = createStore<SessionState>({
      version: 0,
      cursor: { row: first.cells[0]!.row, col: first.cells[0]!.col },
      direction: first.dir,
      paused: false,
      completed: false,
      flawless: false,
      activeMs: 0,
      pencilMode: false,
      autocheck: opts.autocheck ?? false,
    });
    this.touchFocus();
  }

  // --- Time -----------------------------------------------------------------

  activeMs(): number {
    return this.accumulated + (this.pausedFlag || this.completedFlag ? 0 : this.now() - this.startWall);
  }

  pause(): void {
    if (this.pausedFlag || this.completedFlag) return;
    this.accumulated += this.now() - this.startWall;
    this.pausedFlag = true;
    this.bump();
  }

  resume(): void {
    if (!this.pausedFlag || this.completedFlag) return;
    this.startWall = this.now();
    this.pausedFlag = false;
    this.bump();
  }

  // --- Geometry helpers -------------------------------------------------------

  private idx(row: number, col: number): number {
    return row * this.info.cols + col;
  }

  cellAt(row: number, col: number): CellState {
    return this.cells[this.idx(row, col)]!;
  }

  isBlock(row: number, col: number): boolean {
    return isBlockAt(this.puzzle.grid, row, col);
  }

  solutionAt(row: number, col: number): string {
    return this.puzzle.grid[row]![col]!;
  }

  /** The slot under the cursor in the current direction (falls back to the
   * crossing slot when the current direction has none). */
  currentSlot(): Slot {
    const { cursor, direction } = this.store.get();
    const [aId, dId] = this.info.cellSlots[cursor.row]![cursor.col]!;
    const id = direction === 'across' ? aId ?? dId : dId ?? aId;
    return this.info.byId.get(id!)!;
  }

  crossingSlot(): Slot | null {
    const { cursor, direction } = this.store.get();
    const [aId, dId] = this.info.cellSlots[cursor.row]![cursor.col]!;
    const id = direction === 'across' ? dId : aId;
    return id ? this.info.byId.get(id) ?? null : null;
  }

  slotById(id: string): Slot | undefined {
    return this.info.byId.get(id);
  }

  /** Ordered clue list for direction, as slots. */
  slots(direction: Direction): Slot[] {
    return this.info.slots.filter((s) => s.dir === direction);
  }

  // --- Cursor movement -----------------------------------------------------------

  private setCursor(row: number, col: number, direction?: Direction): void {
    const state = this.store.get();
    this.store.set({
      ...state,
      version: state.version + 1,
      cursor: { row, col },
      ...(direction ? { direction } : {}),
    });
    this.touchFocus();
  }

  private touchFocus(): void {
    const t = this.activeMs();
    const slot = this.currentSlot();
    const timing = this.clueTimings.get(slot.id);
    if (timing && timing.firstFocusMs === null) timing.firstFocusMs = t;
  }

  private bump(): void {
    const state = this.store.get();
    this.store.set({
      ...state,
      version: state.version + 1,
      paused: this.pausedFlag,
      completed: this.completedFlag,
      activeMs: this.activeMs(),
    });
  }

  /** Click/tap behavior: same cell toggles direction; a new cell selects it. */
  clickCell(row: number, col: number): void {
    if (this.isBlock(row, col) || this.completedFlag) return;
    const { cursor, direction } = this.store.get();
    if (cursor.row === row && cursor.col === col) {
      this.toggleDirection();
      return;
    }
    // Keep direction if the cell supports it, else flip.
    const [aId, dId] = this.info.cellSlots[row]![col]!;
    const dir: Direction =
      direction === 'across' ? (aId ? 'across' : 'down') : dId ? 'down' : 'across';
    this.setCursor(row, col, dir);
  }

  toggleDirection(): void {
    const state = this.store.get();
    const next: Direction = state.direction === 'across' ? 'down' : 'across';
    const [aId, dId] = this.info.cellSlots[state.cursor.row]![state.cursor.col]!;
    if ((next === 'across' && !aId) || (next === 'down' && !dId)) return;
    this.setCursor(state.cursor.row, state.cursor.col, next);
  }

  /** Arrow keys: same-axis arrows move; perpendicular arrows flip direction
   * first (NYT behavior), then move on the second press. */
  arrow(dr: -1 | 0 | 1, dc: -1 | 0 | 1): void {
    if (this.completedFlag) return;
    const { cursor, direction } = this.store.get();
    const horizontal = dc !== 0;
    if ((horizontal && direction !== 'across') || (!horizontal && direction !== 'down')) {
      this.toggleDirection();
      return;
    }
    let { row, col } = cursor;
    for (;;) {
      row += dr;
      col += dc;
      if (row < 0 || col < 0 || row >= this.info.rows || col >= this.info.cols) return;
      if (!this.isBlock(row, col)) break;
    }
    this.setCursor(row, col);
  }

  /** Jump to a slot's first empty cell (or its start when full). */
  focusSlot(slot: Slot): void {
    const empty = slot.cells.find((c) => this.cellAt(c.row, c.col).letter === '');
    const target = empty ?? slot.cells[0]!;
    this.setCursor(target.row, target.col, slot.dir);
  }

  /** Tab/Enter: next clue in book order (across then down), wrapping; prefers
   * unsolved clues when any remain. */
  nextClue(step: 1 | -1 = 1): void {
    if (this.completedFlag) return;
    const ordered = [...this.slots('across'), ...this.slots('down')];
    const current = this.currentSlot();
    const start = ordered.findIndex((s) => s.id === current.id);
    const n = ordered.length;
    for (let k = 1; k <= n; k++) {
      const slot = ordered[(start + step * k + n * k) % n]!;
      if (!this.slotFilled(slot)) {
        this.focusSlot(slot);
        return;
      }
    }
    const slot = ordered[(start + step + n) % n]!;
    this.focusSlot(slot);
  }

  slotFilled(slot: Slot): boolean {
    return slot.cells.every((c) => this.cellAt(c.row, c.col).letter !== '');
  }

  slotCorrect(slot: Slot): boolean {
    return slot.cells.every(
      (c) => this.cellAt(c.row, c.col).letter === this.solutionAt(c.row, c.col),
    );
  }

  // --- Typing -------------------------------------------------------------------

  /** Type a letter at the cursor, advance smartly. */
  typeLetter(letter: string, opts: { smartSkip?: boolean } = {}): void {
    if (this.completedFlag || this.pausedFlag) return;
    const ch = letter.toUpperCase();
    if (!/^[A-Z]$/.test(ch)) return;
    const { cursor, pencilMode, autocheck } = this.store.get();
    const cell = this.cellAt(cursor.row, cursor.col);
    if (cell.flag === 'revealed' || cell.flag === 'confirmed') {
      this.advance(opts.smartSkip ?? true);
      return;
    }

    cell.letter = ch;
    cell.pencil = pencilMode;
    cell.flag = 'none';
    this.fillOrder.push({ index: this.idx(cursor.row, cursor.col), t: this.activeMs() });

    if (autocheck) {
      if (ch !== this.solutionAt(cursor.row, cursor.col)) {
        cell.flag = 'checked-wrong';
        this.noteWrong(cursor.row, cursor.col);
      } else {
        cell.flag = 'confirmed';
      }
    }

    this.noteClueProgress();
    this.checkCompletion();
    if (!this.completedFlag) this.advance(opts.smartSkip ?? true);
    else this.bump();
  }

  /** Move to next cell in the current word; smartSkip jumps over filled
   * cells (and past the word's end to the next unsolved clue). */
  private advance(smartSkip: boolean): void {
    const slot = this.currentSlot();
    const { cursor } = this.store.get();
    const pos = slot.cells.findIndex((c) => c.row === cursor.row && c.col === cursor.col);

    for (let p = pos + 1; p < slot.cells.length; p++) {
      const c = slot.cells[p]!;
      if (!smartSkip || this.cellAt(c.row, c.col).letter === '') {
        this.setCursor(c.row, c.col);
        return;
      }
    }
    // End of word: with smartSkip move to the next unsolved clue; without it
    // stay on the last cell.
    if (smartSkip && !this.slotFilled(slot)) {
      // Word has holes behind the cursor — loop back to its first empty cell.
      this.focusSlot(slot);
      return;
    }
    if (smartSkip) this.nextClue(1);
    else this.bump();
  }

  /** Backspace: clear current cell if filled; otherwise step back and clear. */
  backspace(): void {
    if (this.completedFlag || this.pausedFlag) return;
    const { cursor } = this.store.get();
    const cell = this.cellAt(cursor.row, cursor.col);
    if (cell.letter !== '' && cell.flag !== 'revealed' && cell.flag !== 'confirmed') {
      cell.letter = '';
      cell.flag = 'none';
      this.bump();
      return;
    }
    const slot = this.currentSlot();
    const pos = slot.cells.findIndex((c) => c.row === cursor.row && c.col === cursor.col);
    if (pos > 0) {
      const prev = slot.cells[pos - 1]!;
      const prevCell = this.cellAt(prev.row, prev.col);
      if (prevCell.flag !== 'revealed' && prevCell.flag !== 'confirmed') {
        prevCell.letter = '';
        prevCell.flag = 'none';
      }
      this.setCursor(prev.row, prev.col);
    }
  }

  clearCell(): void {
    if (this.completedFlag) return;
    const { cursor } = this.store.get();
    const cell = this.cellAt(cursor.row, cursor.col);
    if (cell.flag === 'revealed' || cell.flag === 'confirmed') return;
    cell.letter = '';
    cell.flag = 'none';
    this.bump();
  }

  togglePencilMode(): void {
    const state = this.store.get();
    this.store.set({ ...state, version: state.version + 1, pencilMode: !state.pencilMode });
  }

  setAutocheck(on: boolean): void {
    const state = this.store.get();
    this.store.set({ ...state, version: state.version + 1, autocheck: on });
    if (on) this.checkPuzzle(false);
  }

  // --- Check / reveal ---------------------------------------------------------------

  private noteWrong(row: number, col: number): void {
    this.counts.wrongLetters++;
    this.everWrong = true;
    const [aId, dId] = this.info.cellSlots[row]![col]!;
    for (const id of [aId, dId]) {
      if (!id) continue;
      const timing = this.clueTimings.get(id);
      if (timing) timing.wrongLetters++;
    }
  }

  private checkCells(cells: { row: number; col: number }[], countIt = true): void {
    if (countIt) this.counts.checks++;
    for (const { row, col } of cells) {
      const cell = this.cellAt(row, col);
      if (cell.letter === '' || cell.flag === 'revealed' || cell.flag === 'confirmed') continue;
      if (cell.letter === this.solutionAt(row, col)) {
        cell.flag = 'confirmed';
      } else {
        cell.flag = 'checked-wrong';
        this.noteWrong(row, col);
      }
    }
    this.bump();
  }

  checkLetter(): void {
    const { cursor } = this.store.get();
    this.checkCells([cursor]);
  }

  checkWord(): void {
    this.checkCells(this.currentSlot().cells);
  }

  checkPuzzle(countIt = true): void {
    const all: { row: number; col: number }[] = [];
    for (let r = 0; r < this.info.rows; r++) {
      for (let c = 0; c < this.info.cols; c++) {
        if (!this.isBlock(r, c)) all.push({ row: r, col: c });
      }
    }
    this.checkCells(all, countIt);
  }

  private revealCells(cells: { row: number; col: number }[], slotIds: string[]): void {
    this.counts.reveals++;
    this.everWrong = true;
    for (const { row, col } of cells) {
      const cell = this.cellAt(row, col);
      if (cell.flag === 'revealed' || cell.flag === 'confirmed') continue;
      if (cell.letter !== this.solutionAt(row, col)) {
        cell.letter = this.solutionAt(row, col);
        cell.flag = 'revealed';
        this.fillOrder.push({ index: this.idx(row, col), t: this.activeMs() });
      } else {
        cell.flag = 'confirmed';
      }
    }
    for (const id of slotIds) {
      const timing = this.clueTimings.get(id);
      if (timing) timing.revealed = true;
    }
    this.noteClueProgress();
    this.checkCompletion();
    this.bump();
  }

  revealLetter(): void {
    const { cursor } = this.store.get();
    this.revealCells([cursor], []);
  }

  revealWord(): void {
    const slot = this.currentSlot();
    this.revealCells(slot.cells, [slot.id]);
  }

  revealPuzzle(): void {
    const all: { row: number; col: number }[] = [];
    for (let r = 0; r < this.info.rows; r++) {
      for (let c = 0; c < this.info.cols; c++) {
        if (!this.isBlock(r, c)) all.push({ row: r, col: c });
      }
    }
    this.revealCells(all, this.info.slots.map((s) => s.id));
  }

  /** Record a hint-ladder use against the current clue (tier 1–6). */
  noteHint(tier: number): void {
    this.counts.hints++;
    const timing = this.clueTimings.get(this.currentSlot().id);
    if (timing) timing.hintTiers.push(tier);
    this.bump();
  }

  // --- Completion -------------------------------------------------------------------

  private noteClueProgress(): void {
    const t = this.activeMs();
    for (const slot of this.info.slots) {
      const timing = this.clueTimings.get(slot.id)!;
      if (timing.solvedMs === null && this.slotCorrect(slot)) timing.solvedMs = t;
    }
  }

  private checkCompletion(): void {
    if (this.completedFlag) return;
    for (let r = 0; r < this.info.rows; r++) {
      for (let c = 0; c < this.info.cols; c++) {
        if (this.isBlock(r, c)) continue;
        if (this.cellAt(r, c).letter !== this.solutionAt(r, c)) return;
      }
    }
    this.accumulated += this.now() - this.startWall;
    this.completedFlag = true;
    const state = this.store.get();
    this.store.set({
      ...state,
      version: state.version + 1,
      completed: true,
      flawless: !this.everWrong && this.counts.reveals === 0 && this.counts.hints === 0,
      activeMs: this.accumulated,
    });
  }

  /** All letters entered but at least one is wrong (drives the "hmm, not
   * quite" nudge instead of a silent nothing). */
  filledButWrong(): boolean {
    if (this.completedFlag) return false;
    for (let r = 0; r < this.info.rows; r++) {
      for (let c = 0; c < this.info.cols; c++) {
        if (!this.isBlock(r, c) && this.cellAt(r, c).letter === '') return false;
      }
    }
    return true;
  }
}
