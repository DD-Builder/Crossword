/** High-level puzzle generation: pick a template, fill it, assemble clues.
 * Pure module — the synchronous path used for minis and by node scripts;
 * the UI wraps the same logic through the fill worker for big grids. */

import { fill, type FillOptions } from './filler.ts';
import { assemble, type AssembleMeta } from './assemble.ts';
import { knobsFor } from './difficulty.ts';
import { rngFrom } from '../rng.ts';
import { templateToGrid } from '../grid.ts';
import type { BankIndex } from './index.ts';
import type { GridTemplate, Puzzle, PuzzleKind } from '../types.ts';

export interface GenerateSpec {
  id: string;
  kind: PuzzleKind;
  title: string;
  date?: string;
  /** 1–7 traditional scale. */
  difficulty: number;
  /** Candidate templates (same size); the seed picks among them. */
  templates: GridTemplate[];
  seedKey: string;
  /** Preferred cluing register (player knob); threaded to clue selection. */
  register?: import('../types.ts').Register;
  /** Override the clue-difficulty tier (1–5) independent of fill difficulty. */
  clueTier?: number;
  theme?: { name: string; entries: string[] };
  categoryWeights?: Record<string, number>;
  restarts?: number;
  fillOptions?: FillOptions;
}

export function generatePuzzle(spec: GenerateSpec, bank: BankIndex): Puzzle | null {
  const knobs = knobsFor(spec.difficulty);
  const pool = spec.templates.length > 0 ? spec.templates : [];
  if (pool.length === 0) return null;

  const restarts = spec.restarts ?? 4;
  for (let attempt = 0; attempt <= restarts; attempt++) {
    const rng = rngFrom(`${spec.seedKey}|r${attempt}`);
    const template = pool[rng.int(pool.length)]!;
    const grid = templateToGrid(template.size, template.blocks);

    const result = fill(grid, bank, rng, {
      scoreFloor: knobs.scoreFloor,
      ...(spec.theme ? { seedEntries: spec.theme.entries } : {}),
      ...(spec.categoryWeights ? { categoryWeights: spec.categoryWeights } : {}),
      ...spec.fillOptions,
    });
    if (!result.ok) continue;

    const meta: AssembleMeta = {
      id: spec.id,
      kind: spec.kind,
      title: spec.title,
      ...(spec.date ? { date: spec.date } : {}),
      difficulty: spec.difficulty,
      clueTier: spec.clueTier ?? knobs.clueTier,
      clueCap: knobs.clueCap,
      ...(spec.register ? { register: spec.register } : {}),
      ...(spec.theme ? { theme: spec.theme } : {}),
      ...(template.lattice ? { lattice: true } : {}),
    };
    return assemble(result.grid!, result.placed!, meta, rngFrom(`${spec.seedKey}|clues`));
  }
  return null;
}
