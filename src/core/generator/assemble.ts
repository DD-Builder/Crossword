/** Turn a successful fill into a full Puzzle: pick each entry's clue at the
 * target difficulty tier and derive numbering from the grid. */

import { deriveSlots, slotAnswer } from '../grid.ts';
import type { BankClue, BankEntry, Category, Clue, Puzzle, PuzzleKind, Register } from '../types.ts';
import type { Rng } from '../rng.ts';
import type { BankIndex } from './index.ts';

export interface PickClueOptions {
  /** Preferred register; a matching clue gets a craft bonus (soft, not hard). */
  register?: Register;
  /** Clue texts used recently — demoted so gems rotate instead of repeating. */
  recent?: Set<string>;
  /** Hard ceiling on clue difficulty (the day's `clueCap`). Defaults to a
   * gentle `tier + 1` when unset (Free Play / themes that pass a tier only). */
  cap?: number;
}

/** Choose an entry's clue, **craft first**: pick the wittiest (highest-star)
 * clue the day allows, not the flattest tier-match. Great clues are meant to
 * recur — reusing a gem now and then is a feature, not a bug.
 *
 * Easy/mid days (tier ≤ 3) cap difficulty at tier+1 so the clue stays
 * gettable; harder days lean toward higher difficulty *and* craft. A small
 * seeded jitter shuffles among near-equals so repeat plays of a date vary.
 * A `register` preference nudges (not forces) classic↔modern; a `recent`
 * memory demotes just-used clues so a gem rotates rather than repeating. */
export function pickClue(
  entry: BankEntry,
  tier: number,
  rng: Rng,
  opts: PickClueOptions = {},
): BankClue {
  if (entry.clues.length === 0) {
    return { text: `${entry.answer.length} letters`, difficulty: 3, stars: 1 };
  }
  const cap = opts.cap ?? (tier <= 3 ? tier + 1 : 5);
  const pool = entry.clues.filter((c) => c.difficulty <= cap);
  const from = pool.length > 0 ? pool : entry.clues;

  // Craft-weighted RANDOM pick (softmax) rather than always taking the single
  // top-scoring clue — so the same answer doesn't surface the same clue every
  // time, while wittier/on-tier clues stay far likelier. Craft dominates, a
  // gentle pull keeps difficulty near the day's tier, the preferred register
  // nudges, and a just-shown clue is damped (~2 stars' worth) so it rarely
  // repeats within a puzzle but a genuine standout can still appear.
  const scored = from.map((clue) => {
    let s = clue.stars * 1.1 - Math.abs(clue.difficulty - tier) * 0.9;
    if (opts.register && clue.register === opts.register) s += 1.2;
    if (opts.recent?.has(clue.text)) s -= 2.2;
    return s;
  });
  const T = 0.7; // temperature: higher = more variety, lower = craft-greedier
  const max = Math.max(...scored);
  const weights = scored.map((s) => Math.exp((s - max) / T));
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < from.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return from[i]!;
  }
  return from[from.length - 1]!;
}

export interface AssembleMeta {
  id: string;
  kind: PuzzleKind;
  title: string;
  author?: string;
  date?: string;
  difficulty: number;
  clueTier: number;
  /** Hard ceiling on clue difficulty (the day's `clueCap`). */
  clueCap?: number;
  /** Preferred cluing register (player knob); soft preference in pickClue. */
  register?: Register;
  theme?: { name: string; entries: string[] };
  /** British-style lattice grid (alternate cells legitimately unchecked). */
  lattice?: boolean;
  /** Overrides bank clues for specific answers (LLM-generated themes). */
  clueOverrides?: Map<string, { text: string; stars: Clue['stars']; category: Category; register?: Register }>;
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
  // Rotate away from clues already used in this same puzzle.
  const usedClues = new Set<string>();

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
        ...(override.register ? { register: override.register } : {}),
      };
    } else if (entry && entry.clues.length > 0) {
      const c = pickClue(entry, meta.clueTier, rng, { register: meta.register, recent: usedClues, cap: meta.clueCap });
      usedClues.add(c.text);
      clue = {
        num: slot.num,
        answer,
        clue: c.text,
        stars: c.stars,
        difficulty: c.difficulty,
        category: entry.categories[0] ?? 'wordplay',
        ...(c.register ? { register: c.register } : {}),
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
    ...(meta.lattice ? { lattice: true } : {}),
    ...(meta.theme ? { theme: meta.theme } : {}),
    grid,
    clues: { across, down },
  };
}
