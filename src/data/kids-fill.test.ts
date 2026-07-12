import { describe, it, expect } from 'vitest';
import { fill } from '../core/generator/filler.ts';
import { generatePuzzle } from '../core/generator/puzzle-gen.ts';
import { matchTheme } from '../core/generator/themer.ts';
import { knobsFor } from '../core/generator/difficulty.ts';
import { isFullyChecked, templateToGrid } from '../core/grid.ts';
import { mulberry32 } from '../core/rng.ts';
import { kidsBank, kidsEntries, templatesBySize } from './loader.ts';

/** The exact grid pool the app routes kids puzzles to (mirror of puzzles.ts). */
function kidTemplates() {
  return templatesBySize(5, 5).filter((t) => t.id === 't5-kinder' || t.id.startsWith('t5-kids'));
}

describe('kids pool generation', () => {
  // Bare fill: each kid grid fills reliably from the one merged kids bank.
  for (const t of kidTemplates()) {
    it(`${t.id} fills a proper grid within a few seeds`, () => {
      const bank = kidsBank();
      const template = templateToGrid(t.size, t.blocks);
      let filled: string[] | null = null;
      for (let seed = 0; seed < 12; seed++) {
        const res = fill(template, bank, mulberry32(seed), {
          scoreFloor: 40,
          tagWeights: { kid: 10, glue: 0.5 },
        });
        if (res.ok) { filled = res.grid ?? null; break; }
      }
      expect(filled, `${t.id} produced no fill`).not.toBeNull();
      expect(isFullyChecked(filled!, 3)).toBe(true);
    });
  }

  // Full themed path: a kids puzzle must build for every theme/seed (this is
  // what the app calls). generateThemed degrades to a category-biased fill
  // when a hard seed can't complete, so this must never return null.
  const THEMES = ['animals', 'food', 'space'];
  it('builds a themed puzzle for every theme/seed', () => {
    const bank = kidsBank();
    const templates = kidTemplates();
    for (const theme of THEMES) {
      const match = matchTheme(theme, kidsEntries(), { maxSeeds: 4, minLen: 3 });
      const seeds = match.seeds.slice(0, 1);
      for (let seed = 0; seed < 8; seed++) {
        const base = {
          id: 'k', kind: 'kids' as const, title: 't', difficulty: 0,
          templates, seedKey: `kids|${theme}|${seed}`,
          categoryWeights: match.weights, restarts: 14,
          fillOptions: { tagWeights: { kid: 10, glue: 0.5 } },
        };
        const puzzle =
          generatePuzzle({ ...base, theme: { name: theme, entries: seeds } }, bank) ??
          generatePuzzle(base, bank);
        expect(puzzle, `${theme} seed ${seed} built nothing`).not.toBeNull();
        expect(isFullyChecked(puzzle!.grid, 3)).toBe(true);
        // Every clue in a kids puzzle must sit at the Kids tier's ceiling — no
        // clue harder than clueCap should ever surface (WEEKDAY_KNOBS[0]).
        const cap = knobsFor(0).clueCap;
        for (const c of [...puzzle!.clues.across, ...puzzle!.clues.down]) {
          expect(c.difficulty ?? 1, `${c.answer}: "${c.clue}"`).toBeLessThanOrEqual(cap);
        }
      }
    }
  });
});
