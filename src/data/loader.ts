/** Runtime data loading: wordbank, kids bank, templates, and the
 * hand-authored puzzle library, bundled eagerly via Vite glob imports. */

import type { BankEntry, GridTemplate, Puzzle } from '../core/types.ts';
import { buildIndex, type BankIndex } from '../core/generator/index.ts';

const bankModules = import.meta.glob<BankEntry[]>('./wordbank/*.json', {
  eager: true,
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
let kidsIndex: BankIndex | null = null;

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

export function kidsBank(): BankIndex {
  // Kids puzzles draw from the kids bank plus easy, kid-safe main entries.
  if (!kidsIndex) {
    const easyMain = bankEntries().filter(
      (e) => e.score >= 60 && e.clues.some((c) => c.difficulty <= 2),
    );
    kidsIndex = buildIndex([...kidsEntries(), ...easyMain]);
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
