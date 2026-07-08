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

const kidsIndexByGrade: (BankIndex | null)[] = [];

/** Keep only clues at or below the target grade (a 5-year-old never sees a
 * fifth-grade clue). Falls back to the single easiest clue so a word always has
 * one — used for themed words, which stay available at every grade. */
function cluesForGrade(clues: BankEntry['clues'], grade: number, keepEasiest: boolean): BankEntry['clues'] {
  const ok = clues.filter((c) => (c.grade ?? 0) <= grade);
  if (ok.length > 0) return ok;
  if (!keepEasiest || clues.length === 0) return [];
  return [[...clues].sort((a, b) => (a.grade ?? 0) - (b.grade ?? 0))[0]!];
}

/** The kids bank for a grade (0 = Kindergarten … 5). Themed kid words (tag
 * `kid`) stay available at every grade — they're pre-vetted kid vocabulary — but
 * only their grade-appropriate clues show. The Dale–Chall-screened glue tier
 * (tag `glue`) that completes a PROPER fully-checked grid's crossings is gated
 * by both answer grade and clue grade, so a kindergarten puzzle fills entirely
 * from kindergarten-level words and clues. */
export function kidsBank(grade = 5): BankIndex {
  const g = Math.min(5, Math.max(0, Math.round(grade)));
  if (!kidsIndexByGrade[g]) {
    const kids = kidsEntries()
      .map((e) => ({ ...e, tags: [...(e.tags ?? []), 'kid'], clues: cluesForGrade(e.clues, g, true) }))
      .filter((e) => e.clues.length > 0);
    // Answer-vocabulary headroom of +1 grade: a fully-checked 5×5 is full of
    // five-letter slots, and familiar five-letter words (HOUSE, APPLE) grade to
    // 1, so a strict K answer gate would starve the grid. We let the glue answer
    // run one grade ahead while its CLUES stay strictly at-grade (cluesForGrade
    // below), so a kindergartner still only ever reads a kindergarten clue.
    const glue = (Object.values(kidsGlueModules).flat() as BankEntry[])
      .filter((e) => (e.grade ?? 0) <= g + 1)
      .map((e) => ({ ...e, clues: cluesForGrade(e.clues, g, false) }))
      .filter((e) => e.clues.length > 0);
    kidsIndexByGrade[g] = buildIndex([...kids, ...glue]);
  }
  return kidsIndexByGrade[g]!;
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
