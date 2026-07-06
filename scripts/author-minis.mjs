#!/usr/bin/env node
// Library authoring: generate the daily-mini library (weekday-ramped),
// assembling clues from the curated bank at each weekday's tier. Output
// goes to src/data/puzzles/mini/ for hand review before committing.
//
//   node scripts/author-minis.mjs [--per-weekday 3]
import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { buildIndex } from '../src/core/generator/index.ts';
import { generatePuzzle } from '../src/core/generator/puzzle-gen.ts';
import { knobsFor } from '../src/core/generator/difficulty.ts';
import { validatePuzzle } from '../src/core/validate/validator.ts';
import { loadBankEntries, loadTemplates } from './lib/bank-node.mjs';

const { values: args } = parseArgs({
  options: { 'per-weekday': { type: 'string', default: '3' } },
});
const perWeekday = Number(args['per-weekday']);

const bank = buildIndex(loadBankEntries());
const templates = loadTemplates();
const WEEKDAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Original titles per weekday flavor.
const TITLES = {
  1: ['Warm-Up Lap', 'Gentle Start', 'First Sip'],
  2: ['Second Gear', 'Easy Does It', 'Tuesday Trot'],
  3: ['Midweek Spark', 'Hump Day Hustle', 'Wednesday Wink'],
  4: ['Thursday Twist', 'Almost Friday', 'The Long Bridge'],
  5: ['Friday Flourish', 'Weekend Warm-Up', 'Five O’Clock Somewhere'],
  6: ['Saturday Stinger', 'The Deep End', 'No Training Wheels'],
  7: ['Sunday Stroll', 'The Long Way Home', 'Lazy Morning'],
};

const outDir = new URL('../src/data/puzzles/mini/', import.meta.url).pathname;
mkdirSync(outDir, { recursive: true });

const puzzles = [];
let failures = 0;

for (let weekday = 1; weekday <= 7; weekday++) {
  const knobs = knobsFor(weekday);
  const size = knobs.miniSize;
  const pool = templates.filter((t) => t.size === size && !t.themeSlotMin);
  for (let n = 0; n < perWeekday; n++) {
    const id = `lib-mini-w${weekday}-${n + 1}`;
    let puzzle = null;
    for (let attempt = 0; attempt < 30 && !puzzle; attempt++) {
      puzzle = generatePuzzle({
        id,
        kind: 'mini',
        title: TITLES[weekday][n % TITLES[weekday].length],
        difficulty: weekday,
        templates: pool,
        seedKey: `libmini|${weekday}|${n}|try${attempt}`,
        fillOptions: { scoreFloor: knobs.scoreFloor, jitter: 0.4 },
      }, bank);
      // Library quality bar: no fill-coverage entries in minis when avoidable.
      if (puzzle && attempt < 20) {
        const clues = [...puzzle.clues.across, ...puzzle.clues.down];
        const fillCount = clues.filter((c) => c.tags?.includes('fill')).length;
        if (fillCount > Math.ceil(clues.length * 0.2)) puzzle = null;
      }
    }
    if (!puzzle) {
      console.error(`✗ ${id}: no fill found`);
      failures++;
      continue;
    }
    puzzle.weekday = weekday;
    puzzle.author = 'The Riddle Constructors';
    const problems = validatePuzzle(puzzle).filter((p) => p.level === 'error');
    if (problems.length > 0) {
      console.error(`✗ ${id}: ${problems.map((p) => p.message).join('; ')}`);
      failures++;
      continue;
    }
    puzzles.push(puzzle);
    const stars = [...puzzle.clues.across, ...puzzle.clues.down].reduce((a, c) => a + c.stars, 0) /
      (puzzle.clues.across.length + puzzle.clues.down.length);
    console.log(`✓ ${id} ${size}x${size} "${puzzle.title}" (${WEEKDAY_NAMES[weekday]}, avg ${stars.toFixed(1)}★)`);
  }
}

writeFileSync(`${outDir}minis.json`, JSON.stringify(puzzles, null, 1));
console.log(`\nWrote ${puzzles.length} minis (${failures} failures) → src/data/puzzles/mini/minis.json`);
process.exit(failures > 0 ? 1 : 0);
