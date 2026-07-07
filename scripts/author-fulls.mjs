#!/usr/bin/env node
// Library authoring: the full-size daily library (15x15 lattice grids,
// weekday-ramped, 2 per weekday). Clues come from the curated bank at each
// weekday's tier; output lands in src/data/puzzles/full/ for review.
//
//   node scripts/author-fulls.mjs [--per-weekday 2]
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { buildIndex } from '../src/core/generator/index.ts';
import { generatePuzzle } from '../src/core/generator/puzzle-gen.ts';
import { knobsFor } from '../src/core/generator/difficulty.ts';
import { validatePuzzle } from '../src/core/validate/validator.ts';
import { loadBankEntries, loadTemplates } from './lib/bank-node.mjs';

const { values: args } = parseArgs({
  options: { 'per-weekday': { type: 'string', default: '2' } },
});
const perWeekday = Number(args['per-weekday']);

// Bank = curated + authored clues only (no raw fill wordlist), so every answer
// the filler can place is guaranteed to carry a real clue — NYT-standard
// fully-checked American grids with zero placeholder clues.
const bank = buildIndex(loadBankEntries());
const pool = loadTemplates().filter((t) => t.id === 't15-a' || t.id === 't15-d');
const WEEKDAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Original titles per weekday flavor.
const TITLES = {
  1: ['Open Door', 'Clean Slate'],
  2: ['Stepping Stones', 'Second Wind'],
  3: ['The Middle Path', 'Halfway Up'],
  4: ['Thick of It', 'Uphill From Here'],
  5: ['Sharp Turns', 'The Gauntlet'],
  6: ['Full Fathom', 'The Crucible'],
  7: ['The Grand Tour', 'Sunday Best'],
};

const outDir = new URL('../src/data/puzzles/full/', import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

const puzzles = [];
let failures = 0;

for (let weekday = 1; weekday <= 7; weekday++) {
  const knobs = knobsFor(weekday);
  for (let n = 0; n < perWeekday; n++) {
    const id = `lib-full-w${weekday}-${n + 1}`;
    let puzzle = null;
    for (let attempt = 0; attempt < 40 && !puzzle; attempt++) {
      puzzle = generatePuzzle({
        id,
        kind: 'daily',
        title: TITLES[weekday][n % TITLES[weekday].length],
        difficulty: weekday,
        templates: pool,
        seedKey: `libfull|${weekday}|${n}|try${attempt}`,
        fillOptions: { scoreFloor: Math.max(30, knobs.scoreFloor - 10), jitter: 0.45 },
      }, bank);
      // Quality bar: cap the share of single-clue fill entries.
      if (puzzle && attempt < 30) {
        const clues = [...puzzle.clues.across, ...puzzle.clues.down];
        const fillCount = clues.filter((c) => c.tags?.includes('fill')).length;
        if (fillCount > Math.ceil(clues.length * 0.35)) puzzle = null;
      }
    }
    if (!puzzle) {
      console.error(`✗ ${id}: no fill found`);
      failures++;
      continue;
    }
    puzzle.weekday = weekday;
    puzzle.author = 'The Riddle Constructors';
    const problems = validatePuzzle(puzzle, { fullyChecked: true }).filter((p) => p.level === 'error');
    if (problems.length > 0) {
      console.error(`✗ ${id}: ${problems.map((p) => p.message).join('; ')}`);
      failures++;
      continue;
    }
    puzzles.push(puzzle);
    const all = [...puzzle.clues.across, ...puzzle.clues.down];
    const stars = all.reduce((a, c) => a + c.stars, 0) / all.length;
    console.log(`✓ ${id} "${puzzle.title}" (${WEEKDAY_NAMES[weekday]}, ${all.length} clues, avg ${stars.toFixed(1)}★)`);
  }
}

writeFileSync(`${outDir}fulls.json`, JSON.stringify(puzzles, null, 1));
console.log(`\nWrote ${puzzles.length} fulls (${failures} failures) → src/data/puzzles/full/fulls.json`);
process.exit(failures > 0 ? 1 : 0);
