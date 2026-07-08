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

const kidsIndexByBand: Partial<Record<'K2' | '35' | '68', BankIndex>> = {};

/** Grade-banded kids bank. K–2 is kid words ONLY (a lattice fills from these
 * alone); 3–5 and 6–8 layer in progressively longer easy grown-up words. Kid
 * words carry a `kid` tag so the filler can weight them above the grown-up
 * fillers (see puzzles.ts). */
export function kidsBank(band: 'K2' | '35' | '68' = '35'): BankIndex {
  if (!kidsIndexByBand[band]) {
    // Tag every kid entry so it can be boosted in the candidate sort.
    const kids = kidsEntries().map((e) => ({ ...e, tags: [...(e.tags ?? []), 'kid'] }));
    if (band === 'K2') {
      kidsIndexByBand[band] = buildIndex(kids);
    } else {
      const maxLen = band === '35' ? 6 : 8;
      const easyMain = bankEntries().filter(
        (e) => e.score >= 60 && e.answer.length <= maxLen && e.clues.some((c) => c.difficulty <= 2),
      );
      kidsIndexByBand[band] = buildIndex([...kids, ...easyMain]);
    }
  }
  return kidsIndexByBand[band]!;
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
