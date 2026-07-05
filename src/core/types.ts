/** Core domain types. This module is pure — safe for node scripts/tests. */

/** Trivial Pursuit-style clue classification (+ wordplay for cryptic-ish clues). */
export const CATEGORIES = [
  'geography',
  'entertainment',
  'history',
  'arts-literature',
  'science-nature',
  'sports-leisure',
  'wordplay',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  geography: 'Geography',
  entertainment: 'Entertainment',
  history: 'History',
  'arts-literature': 'Arts & Literature',
  'science-nature': 'Science & Nature',
  'sports-leisure': 'Sports & Leisure',
  wordplay: 'Wordplay',
};

export type Direction = 'across' | 'down';

export type PuzzleKind = 'daily' | 'mini' | 'themed' | 'kids' | 'generated';

export interface Cell {
  row: number;
  col: number;
}

/** A numbered answer slot derived from the grid. */
export interface Slot {
  /** Clue number as printed in the grid. */
  num: number;
  dir: Direction;
  cells: Cell[];
  /** Convenience: `${num}-${dir}` — unique within a puzzle. */
  id: string;
}

export interface Clue {
  num: number;
  answer: string;
  clue: string;
  /** Combined difficulty + cleverness, 1 (gimme) … 5 (devious gem). */
  stars: 1 | 2 | 3 | 4 | 5;
  category: Category;
  tags?: string[];
}

export interface PuzzleTheme {
  name: string;
  /** Answers (A–Z only) that carry the theme; must appear in the grid. */
  entries: string[];
}

export interface Puzzle {
  id: string;
  kind: PuzzleKind;
  title: string;
  author: string;
  /** ISO date for dailies; omitted for generated/free puzzles. */
  date?: string;
  /** 1 (Mon) … 7 (Sun) on the traditional scale; kids puzzles use 1. */
  difficulty: number;
  size: { rows: number; cols: number };
  theme?: PuzzleTheme;
  /**
   * Solution rows: one string per row, `#` for blocks, A–Z for letters.
   * The single source of truth — numbering and slots derive from this.
   */
  grid: string[];
  clues: {
    across: Clue[];
    down: Clue[];
  };
}

/** A grid template: block layout without letters. */
export interface GridTemplate {
  id: string;
  size: number;
  /** [row, col] block coordinates (the 180°-rotation mirror must also be listed). */
  blocks: [number, number][];
  /** 1 (closed, easy to fill) … 5 (wide open). */
  openness: number;
  /** Slot lengths ≥ this are reserved for theme entries when theming. */
  themeSlotMin?: number;
}

/** Wordbank entry: one answer, several clues at different difficulty tiers. */
export interface BankClue {
  text: string;
  /** 1 (Monday) … 5 (Saturday) clue-writing tier. */
  difficulty: 1 | 2 | 3 | 4 | 5;
  stars: 1 | 2 | 3 | 4 | 5;
}

export interface BankEntry {
  answer: string;
  /** Fill quality 1–100; crosswordese scores ≤ 30 and is used sparingly. */
  score: number;
  categories: Category[];
  tags: string[];
  clues: BankClue[];
}

export const BLOCK = '#';

export function isLetter(ch: string): boolean {
  return ch.length === 1 && ch >= 'A' && ch <= 'Z';
}
