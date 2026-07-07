#!/usr/bin/env node
// Generate NYT-standard American grid templates (180°-symmetric, fully checked,
// ~16% black) for a size, gated by the real filler + shipped bank so every
// emitted template is guaranteed to fill. Prints JSON template objects to add
// to src/data/templates/templates.json.
//
//   node scripts/gen-templates.mjs --size 21 --id t21-a [--density 0.16] [--tries 4000]

import { parseArgs } from 'node:util';
import { fill } from '../src/core/generator/filler.ts';
import { buildIndex } from '../src/core/generator/index.ts';
import { isConnected, isFullyChecked, isSymmetric, templateToGrid } from '../src/core/grid.ts';
import { rngFrom } from '../src/core/rng.ts';
import { loadBankEntries } from './lib/bank-node.mjs';

const { values: a } = parseArgs({ options: {
  size: { type: 'string' }, id: { type: 'string' },
  density: { type: 'string', default: '0.16' }, tries: { type: 'string', default: '5000' },
} });
const N = Number(a.size);
const TARGET = Math.round(N * N * Number(a.density));
const bank = buildIndex(loadBankEntries());

// True if the grid has no white run (horizontal or vertical) of length 1 or 2.
function runsOk(g) {
  const bad = (line) => line.split('#').some((run) => run.length === 1 || run.length === 2);
  for (let r = 0; r < N; r++) if (bad(g[r].join(''))) return false;
  for (let c = 0; c < N; c++) {
    let col = '';
    for (let r = 0; r < N; r++) col += g[r][c];
    if (bad(col)) return false;
  }
  return true;
}

function buildPattern(rng) {
  const g = Array.from({ length: N }, () => Array(N).fill('.'));
  let blocks = 0;
  const center = (N - 1) / 2;
  let guard = 0;
  while (blocks < TARGET && guard++ < TARGET * 40) {
    const r = Math.floor(rng.next() * N);
    const c = Math.floor(rng.next() * N);
    if (r === center && c === center) continue;     // keep center white (odd grid)
    if (g[r][c] === '#') continue;
    const r2 = N - 1 - r, c2 = N - 1 - c;
    g[r][c] = '#'; g[r2][c2] = '#';
    if (runsOk(g)) {
      blocks += (r === r2 && c === c2) ? 1 : 2;
    } else {
      g[r][c] = '.'; g[r2][c2] = '.';               // revert — created a stub run
    }
  }
  return g.map((row) => row.join('')); // rows of '.' (white) and '#' (block)
}

function gridToBlocks(g) {
  const blocks = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (g[r][c] === '#') blocks.push([r, c]);
  return blocks;
}

for (let t = 0; t < Number(a.tries); t++) {
  const rng = rngFrom(`tmpl|${N}|${a.id}|${t}`);
  const grid = buildPattern(rng); // rows of '.' (white) and '#' (block)
  if (!isSymmetric(grid) || !isConnected(grid) || !isFullyChecked(grid, 3)) continue;
  const blocks = gridToBlocks(grid.map((r) => r.split('')));
  // Final gate: does it actually fill? (3 seeds, restart ladder.)
  let filled = 0;
  for (let s = 0; s < 3; s++) {
    let ok = false;
    for (let att = 0; att < 4 && !ok; att++) {
      const res = fill(templateToGrid(N, blocks), bank, rngFrom(`fitT|${a.id}|${s}|${att}`),
        { maxSteps: 200_000, jitter: 0.25 + att * 0.12, beamWidth: 24 + att * 24, tagWeights: { fill: 0.6 } });
      ok = res.ok;
    }
    if (ok) filled++;
  }
  if (filled >= 2) {
    const pct = (100 * blocks.length / (N * N)).toFixed(0);
    console.error(`✓ ${a.id}: ${blocks.length} blocks (${pct}%), fills ${filled}/3 after ${t} tries`);
    const openness = N >= 15 ? 5 : 4;
    console.log(JSON.stringify({ id: a.id, size: N, blocks, openness }));
    process.exit(0);
  }
}
console.error(`✗ ${a.id}: no fillable ${N}×${N} pattern found in ${a.tries} tries`);
process.exit(1);
