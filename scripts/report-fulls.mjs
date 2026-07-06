#!/usr/bin/env node
// The dailies quality gate: prints every fill-tagged (single-clue) entry in
// each library puzzle so a human can read the weak clues in context. Weak
// ones get rewritten in the bank (possibly promoted out of `fill`), then the
// puzzle is regenerated.
//
//   node scripts/report-fulls.mjs [--dir src/data/puzzles/full]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({
  options: { dir: { type: 'string', default: 'src/data/puzzles/full' } },
});

const ROOT = new URL('..', import.meta.url).pathname;
const dir = join(ROOT, args.dir);

let totalClues = 0;
let totalFill = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  let puzzles = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  if (!Array.isArray(puzzles)) puzzles = [puzzles];
  for (const p of puzzles) {
    const all = [...p.clues.across.map((c) => ({ ...c, dir: 'A' })), ...p.clues.down.map((c) => ({ ...c, dir: 'D' }))];
    const fill = all.filter((c) => c.tags?.includes('fill'));
    totalClues += all.length;
    totalFill += fill.length;
    const pct = ((100 * fill.length) / all.length).toFixed(0);
    const longFill = fill.filter((c) => c.answer.length >= 8);
    console.log(`\n== ${p.id} "${p.title}" — ${fill.length}/${all.length} fill clues (${pct}%)${longFill.length ? `  ⚠ ${longFill.length} in 8+ slots` : ''}`);
    for (const c of fill.sort((a, b) => b.answer.length - a.answer.length)) {
      console.log(`  ${String(c.num).padStart(3)}${c.dir} ${c.answer.padEnd(9)} ${c.clue}`);
    }
  }
}

console.log(`\nTotal: ${totalFill}/${totalClues} fill clues (${((100 * totalFill) / Math.max(1, totalClues)).toFixed(0)}%)`);
