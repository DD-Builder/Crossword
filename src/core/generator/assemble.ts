/** Turn a successful fill into a full Puzzle: pick each entry's clue at the
 * target difficulty tier and derive numbering from the grid. */

import { deriveSlots, slotAnswer } from '../grid.ts';
import type { BankClue, BankEntry, Category, Clue, Puzzle, PuzzleKind } from '../types.ts';
import type { Rng } from '../rng.ts';
import type { BankIndex } from './index.ts';

/** Choose an entry's clue, **craft first**: pick the wittiest (highest-star)
 * clue the day allows, not the flattest tier-match. Great clues are meant to
 * recur — reusing a gem now and then is a feature, not a bug.
 *
 * Easy/mid days (tier ≤ 3) cap difficulty at tier+1 so the clue stays
 * gettable; harder days lean toward higher difficulty *and* craft. A small
 * seeded jitter shuffles among near-equals so repeat plays of a date vary. */
export function pickClue(entry: BankEntry, tier: number, rng: Rng): BankClue {
  if (entry.clues.length === 0) {
    return { text: `${entry.answer.length} letters`, difficulty: 3, stars: 1 };
  }
  const cap = tier <= 3 ? tier + 1 : 5;
  const pool = entry.clues.filter((c) => c.difficulty <= cap);
  const from = pool.length > 0 ? pool : entry.clues;

  let best = from[0]!;
  let bestScore = -Infinity;
  for (const clue of from) {
    // Craft dominates; a gentle pull keeps difficulty near the day's tier.
    const score = clue.stars * 2 - Math.abs(clue.difficulty - tier) + rng.next() * 0.8;
    if (score > bestScore) {
      bestScore = score;
      best = clue;
    }
  }
  return best;
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
