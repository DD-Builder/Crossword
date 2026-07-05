/** Lossless-enough .ipuz export/import for the crossword kind, so puzzles
 * are portable to other solvers/construction tools. Custom metadata (stars,
 * categories, tags) rides in the ipuz-sanctioned `org.riddle:*` extension
 * namespace and round-trips through our importer. */

import { deriveSlots, slotAnswer } from './grid';
import { BLOCK, type Category, type Clue, type Puzzle } from './types';

interface IpuzClueEntry {
  number: number;
  clue: string;
  'org.riddle:stars'?: number;
  'org.riddle:category'?: string;
  'org.riddle:tags'?: string[];
}

export interface IpuzDoc {
  version: string;
  kind: string[];
  title?: string;
  author?: string;
  date?: string;
  dimensions: { width: number; height: number };
  puzzle: (number | string | null)[][];
  solution: (string | null)[][];
  clues: { Across: IpuzClueEntry[]; Down: IpuzClueEntry[] };
  'org.riddle:meta'?: Record<string, unknown>;
}

export function toIpuz(puzzle: Puzzle): IpuzDoc {
  const info = deriveSlots(puzzle.grid, 3);
  const height = puzzle.size.rows;
  const width = puzzle.size.cols;

  const puzzleGrid: (number | string | null)[][] = [];
  const solution: (string | null)[][] = [];
  for (let r = 0; r < height; r++) {
    const pRow: (number | string | null)[] = [];
    const sRow: (string | null)[] = [];
    for (let c = 0; c < width; c++) {
      const ch = puzzle.grid[r]![c]!;
      if (ch === BLOCK) {
        pRow.push('#');
        sRow.push('#');
      } else {
        const n = info.numbers[r]![c]!;
        pRow.push(n > 0 ? n : 0);
        sRow.push(ch);
      }
    }
    puzzleGrid.push(pRow);
    solution.push(sRow);
  }

  const clueEntry = (c: Clue): IpuzClueEntry => ({
    number: c.num,
    clue: c.clue,
    'org.riddle:stars': c.stars,
    'org.riddle:category': c.category,
    ...(c.tags && c.tags.length > 0 ? { 'org.riddle:tags': c.tags } : {}),
  });

  return {
    version: 'http://ipuz.org/v2',
    kind: ['http://ipuz.org/crossword#1'],
    title: puzzle.title,
    author: puzzle.author,
    ...(puzzle.date ? { date: puzzle.date } : {}),
    dimensions: { width, height },
    puzzle: puzzleGrid,
    solution,
    clues: {
      Across: puzzle.clues.across.map(clueEntry),
      Down: puzzle.clues.down.map(clueEntry),
    },
    'org.riddle:meta': {
      id: puzzle.id,
      kind: puzzle.kind,
      difficulty: puzzle.difficulty,
      ...(puzzle.theme ? { theme: puzzle.theme } : {}),
    },
  };
}

export function fromIpuz(doc: IpuzDoc): Puzzle {
  if (!doc.kind.some((k) => k.startsWith('http://ipuz.org/crossword'))) {
    throw new Error('Not an ipuz crossword');
  }
  const { width, height } = doc.dimensions;
  const grid: string[] = [];
  for (let r = 0; r < height; r++) {
    let row = '';
    for (let c = 0; c < width; c++) {
      const sol = doc.solution[r]?.[c];
      row += sol === '#' || sol === null || sol === undefined ? BLOCK : sol.toUpperCase();
    }
    grid.push(row);
  }

  const info = deriveSlots(grid, 3);
  const meta = (doc['org.riddle:meta'] ?? {}) as Record<string, unknown>;

  const toClues = (entries: IpuzClueEntry[], dir: 'across' | 'down'): Clue[] =>
    entries.map((e) => {
      const slot = info.slots.find((s) => s.num === e.number && s.dir === dir);
      return {
        num: e.number,
        answer: slot ? slotAnswer(grid, slot) : '',
        clue: e.clue,
        stars: (e['org.riddle:stars'] ?? 3) as Clue['stars'],
        category: (e['org.riddle:category'] ?? 'wordplay') as Category,
        ...(e['org.riddle:tags'] ? { tags: e['org.riddle:tags'] } : {}),
      };
    });

  return {
    id: typeof meta.id === 'string' ? meta.id : `import-${Date.now()}`,
    kind: (typeof meta.kind === 'string' ? meta.kind : 'generated') as Puzzle['kind'],
    title: doc.title ?? 'Imported puzzle',
    author: doc.author ?? 'Unknown',
    ...(doc.date ? { date: doc.date } : {}),
    difficulty: typeof meta.difficulty === 'number' ? meta.difficulty : 3,
    size: { rows: height, cols: width },
    ...(meta.theme ? { theme: meta.theme as Puzzle['theme'] } : {}),
    grid,
    clues: {
      across: toClues(doc.clues.Across, 'across'),
      down: toClues(doc.clues.Down, 'down'),
    },
  };
}
