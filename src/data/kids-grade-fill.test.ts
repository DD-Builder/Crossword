import { describe, it, expect } from 'vitest';
import { fill } from '../core/generator/filler.ts';
import { generatePuzzle } from '../core/generator/puzzle-gen.ts';
import { matchTheme } from '../core/generator/themer.ts';
import { deriveSlots, isFullyChecked, templateToGrid } from '../core/grid.ts';
import { mulberry32 } from '../core/rng.ts';
import { kidsBank, kidsEntries, templatesBySize } from './loader.ts';

/** The exact grid pool the app routes each grade to (mirror of puzzles.ts). */
function kidTemplates(g: number) {
  return g <= 0
    ? templatesBySize(5, 5).filter((t) => t.id === 't5-kinder')
    : templatesBySize(5, 5).filter((t) => t.id.startsWith('t5-kids'));
}

describe('kids grade-limited generation', () => {
  // Bare fill: every grade fills its proper grid pool from the grade-limited bank.
  for (let g = 0; g <= 5; g++) {
    it(`grade ${g} fills a proper grid within a few seeds`, () => {
      const bank = kidsBank(g);
      let filled: string[] | null = null;
      outer: for (const t of kidTemplates(g)) {
        const template = templateToGrid(t.size, t.blocks);
        for (let seed = 0; seed < 12; seed++) {
          const res = fill(template, bank, mulberry32(seed), {
            scoreFloor: 40,
            tagWeights: { kid: 10, glue: 0.5 },
          });
          if (res.ok) { filled = res.grid ?? null; break outer; }
        }
      }
      expect(filled, `grade ${g} produced no fill`).not.toBeNull();
      expect(isFullyChecked(filled!, 3)).toBe(true);
    });
  }

  // Full themed path: a kids puzzle must build for every grade, theme and seed
  // (this is what the app calls). generateThemed degrades to a category-biased
  // fill when a hard seed can't complete, so this must never return null.
  const THEMES = ['animals', 'food', 'space'];
  for (let g = 0; g <= 5; g++) {
    it(`grade ${g} builds a themed puzzle for every theme/seed`, () => {
      for (const theme of THEMES) {
        const match = matchTheme(theme, kidsEntries(), { maxSeeds: 4, minLen: 3 });
        const templates = kidTemplates(g);
        const seeds = match.seeds.slice(0, 1);
        for (let seed = 0; seed < 8; seed++) {
          // Try the hard-seeded fill, then the category-biased fallback — the two
          // stages generateThemed runs. One of them must yield a fully-checked grid.
          const base = {
            id: 'k', kind: 'kids' as const, title: 't',
            difficulty: g <= 1 ? 1 : g <= 3 ? 2 : 3,
            templates, seedKey: `kids|${g}|${theme}|${seed}`,
            categoryWeights: match.weights, restarts: 14,
            fillOptions: { scoreFloor: 40, tagWeights: { kid: 10, glue: 0.5 } },
          };
          const puzzle =
            generatePuzzle({ ...base, theme: { name: theme, entries: seeds } }, kidsBank(g)) ??
            generatePuzzle(base, kidsBank(g));
          expect(puzzle, `grade ${g} ${theme} seed ${seed} built nothing`).not.toBeNull();
          expect(isFullyChecked(puzzle!.grid, 3)).toBe(true);
        }
      }
    });
  }
});
