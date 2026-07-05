/** Turn a successful fill into a full Puzzle: pick each entry's clue at the
 * target difficulty tier and derive numbering from the grid. */

import { deriveSlots, slotAnswer } from '../grid.ts';
import type { BankClue, BankEntry, Category, Clue, Puzzle, PuzzleKind } from '../types.ts';
import type { Rng } from '../rng.ts';
import type { BankIndex } from './index.ts';

/** Pick the clue nearest the target tier; ties prefer higher stars, then a
 * seeded coin flip so repeat plays of a date shuffle among equals. */
export function pickClue(entry: BankEntry, tier: number, rng: Rng): BankClue {
  let best: BankClue | null = null;
  let bestKey = Infinity;
  for (const clue of entry.clues) {
    const key = Math.abs(clue.difficulty - tier) * 10 - clue.stars - rng.next();
    if (key < bestKey) {
      bestKey = key;
      best = clue;
    }
  }
  return best ?? { text: `${entry.answer.length} letters`, difficulty: 3, stars: 1 };
}

export interface AssembleMeta {
  id: string;
  kind: PuzzleKind;
  title: string;
  author?: string;
  date?: string;
  difficulty: number;
  clueTier: number;
  theme?: { name: string; entries: string[] };
  /** Overrides bank clues for specific answers (LLM-generated themes). */
  clueOverrides?: Map<string, { text: string; stars: Clue['stars']; category: Category }>;
}

export function assemble(
  grid: string[],
  placed: Map<string, BankEntry>,
  meta: AssembleMeta,
  rng: Rng,
): Puzzle {
  const info = deriveSlots(grid, 3);
  const across: Clue[] = [];
  const down: Clue[] = [];

  for (const slot of info.slots) {
    const answer = slotAnswer(grid, slot);
    const entry = placed.get(slot.id);
    const override = meta.clueOverrides?.get(answer);
    let clue: Clue;
    if (override) {
      clue = {
        num: slot.num,
        answer,
        clue: override.text,
        stars: override.stars,
        category: override.category,
      };
    } else if (entry && entry.clues.length > 0) {
      const c = pickClue(entry, meta.clueTier, rng);
      clue = {
        num: slot.num,
        answer,
        clue: c.text,
        stars: c.stars,
        category: entry.categories[0] ?? 'wordplay',
        ...(entry.tags.length > 0 ? { tags: entry.tags } : {}),
      };
    } else {
      clue = {
        num: slot.num,
        answer,
        clue: `Mystery word (${answer.length} letters)`,
        stars: 1,
        category: 'wordplay',
      };
    }
    (slot.dir === 'across' ? across : down).push(clue);
  }

  return {
    id: meta.id,
    kind: meta.kind,
    title: meta.title,
    author: meta.author ?? 'The Riddle Engine',
    ...(meta.date ? { date: meta.date } : {}),
    difficulty: meta.difficulty,
    size: { rows: grid.length, cols: grid[0]?.length ?? 0 },
    ...(meta.theme ? { theme: meta.theme } : {}),
    grid,
    clues: { across, down },
  };
}
