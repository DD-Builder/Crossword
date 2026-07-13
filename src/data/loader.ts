/** Runtime data loading: wordbank, kids bank, templates, and the
 * hand-authored puzzle library, bundled eagerly via Vite glob imports. */

import type { BankEntry, GridTemplate, Puzzle } from '../core/types.ts';
import { buildIndex, type BankIndex } from '../core/generator/index.ts';

const bankModules = import.meta.glob<BankEntry[]>('./wordbank/*.json', {
  eager: true,
  import: 'default',
});
// The fill tier (score-capped completion vocabulary for big grids) is large
// and only needed when generating 11×11+, so it loads lazily in its own chunk.
const fillModules = import.meta.glob<BankEntry[]>('./wordbank/fill/*.json', {
  import: 'default',
});
// Clues transformed from the established-clue corpus (build-time; see
// data/clue-corpus/PROVENANCE.md). A deep bench for American/large grids —
// large, so it also loads lazily in its own chunk, only for 11×11+.
const authoredModules = import.meta.glob<BankEntry[]>('./wordbank/authored/*.json', {
  import: 'default',
});
const kidsModules = import.meta.glob<BankEntry[]>('./kids/*.json', {
  eager: true,
  import: 'default',
});
// Kid-safe "glue": common 4th-grade-familiar words (Dale–Chall screened) that
// let a PROPER fully-checked kid grid fill without adult vocabulary. Kept out of
// `kids/` so it's never used as a theme seed — it's fill, not theme content.
const kidsGlueModules = import.meta.glob<BankEntry[]>('./kids-glue/*.json', {
  eager: true,
  import: 'default',
});
const puzzleModules = import.meta.glob<Puzzle[]>('./puzzles/**/*.json', {
  eager: true,
  import: 'default',
});

import templatesJson from './templates/templates.json';

let mainIndex: BankIndex | null = null;
let fullIndex: BankIndex | null = null;

export function bankEntries(): BankEntry[] {
  return Object.values(bankModules).flat();
}

export function kidsEntries(): BankEntry[] {
  return Object.values(kidsModules).flat();
}

export function mainBank(): BankIndex {
  if (!mainIndex) mainIndex = buildIndex(bankEntries());
  return mainIndex;
}

/** Curated bank + the lazily-loaded fill tier — for generating large grids. */
export async function fullBank(): Promise<BankIndex> {
  if (!fullIndex) {
    const chunks = await Promise.all(
      [...Object.values(fillModules), ...Object.values(authoredModules)].map((load) => load()),
    );
    fullIndex = buildIndex([...bankEntries(), ...chunks.flat()]);
  }
  return fullIndex;
}

let kidsIndex: BankIndex | null = null;

/** The one merged kids bank: pre-vetted themed words (tag `kid`) plus the
 * Dale–Chall-screened "glue" tier (tag `glue`) that completes a PROPER
 * fully-checked grid's crossings. No grade ladder — every clue carries the
 * same 1–5 difficulty/stars rating as the grown-up bank, and kids puzzles
 * generate at a fixed easy tier (`knobsFor(0)`) that naturally excludes
 * anything harder, the same mechanism that keeps Monday gettable. */
export function kidsBank(): BankIndex {
  if (!kidsIndex) {
    const kids = kidsEntries().map((e) => ({ ...e, tags: [...(e.tags ?? []), 'kid'] }));
    const glue = Object.values(kidsGlueModules).flat() as BankEntry[];
    kidsIndex = buildIndex([...kids, ...glue]);
  }
  return kidsIndex;
}

export function templates(): GridTemplate[] {
  return templatesJson as GridTemplate[];
}

export function templatesBySize(size: number, maxOpenness = 5): GridTemplate[] {
  return templates().filter((t) => t.size === size && t.openness <= maxOpenness);
}

export function libraryPuzzles(): Puzzle[] {
  return Object.values(puzzleModules).flat();
}
