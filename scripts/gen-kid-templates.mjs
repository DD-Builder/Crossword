#!/usr/bin/env node
// Kid grids: small, symmetric LATTICE templates (partial crossings, British
// style) that a ~350-word kid bank can actually fill — and that suit a young
// solver, since fully-interlocked squares are themselves a hard skill. Every
// slot is 3–6 letters (the kid bank's range), the grid stays connected, and
// every white cell belongs to a slot. Fill-gated against the KIDS bank so each
// emitted template is guaranteed solvable from kid words alone.
//
//   node scripts/gen-kid-templates.mjs --size 7 --id kid7-a [--tries 4000]

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { fill } from '../src/core/generator/filler.ts';
import { buildIndex } from '../src/core/generator/index.ts';
import { deriveSlots, isConnected, isSymmetric, templateToGrid } from '../src/core/grid.ts';
import { rngFrom } from '../src/core/rng.ts';

const { values: a } = parseArgs({ options: {
  size: { type: 'string' }, id: { type: 'string' }, tries: { type: 'string', default: '6000' },
} });
const N = Number(a.size);
const MAXLEN = 6; // kid bank tops out at 6 letters

const ROOT = new URL('..', import.meta.url).pathname;
const kids = [];
for (const f of readdirSync(join(ROOT, 'src/data/kids'))) {
  if (f.endsWith('.json')) kids.push(...JSON.parse(readFileSync(join(ROOT, 'src/data/kids', f), 'utf8')));
}
const bank = buildIndex(kids);

/** No white run may exceed MAXLEN (the kid bank tops out at 6 letters). Short
 * runs (1–2) are FINE in a lattice: those cells are unchecked in this direction
 * and belong to a perpendicular slot instead — the `fullyCovered` rule verifies
 * every cell still lands in some slot. (Rejecting short runs would throw out the
 * very lattice patterns we want.) */
function slotsOk(grid) {
  const bad = (arr) => {
    let s = -1;
    for (let i = 0; i <= arr.length; i++) {
      const white = i < arr.length && arr[i] === '.';
      if (white && s < 0) s = i;
      else if (!white && s >= 0) { if (i - s > MAXLEN) return true; s = -1; }
    }
    return false;
  };
  for (let r = 0; r < N; r++) if (bad(grid[r].split(''))) return false;
  for (let c = 0; c < N; c++) {
    const col = []; for (let r = 0; r < N; r++) col.push(grid[r][c]);
    if (bad(col)) return false;
  }
  return true;
}

/** Every white cell belongs to ≥1 slot (lattice coverage rule). */
function fullyCovered(grid) {
  const { slots } = deriveSlots(templateToGrid(N, blocksOf(grid)), 3);
  const covered = new Set();
  for (const s of slots) for (const c of s.cells) covered.add(c.row * N + c.col);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (grid[r][c] === '.' && !covered.has(r * N + c)) return false;
  }
  return true;
}

function blocksOf(grid) {
  const b = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c] === '#') b.push([r, c]);
  return b;
}

/** Build a symmetric block pattern with a target black density. */
function build(rng) {
  const g = Array.from({ length: N }, () => Array(N).fill('.'));
  const center = (N - 1) / 2;
  // Lattice density: enough blocks to break long runs and unchain crossings,
  // but connected. ~28–36% suits a small kid grid.
  const target = Math.round(N * N * (0.28 + rng.next() * 0.08));
  let placed = 0, guard = 0;
  while (placed < target && guard++ < 8000) {
    const r = Math.floor(rng.next() * N), c = Math.floor(rng.next() * N);
    if (r === center && c === center) continue;
    if (g[r][c] === '#') continue;
    const r2 = N - 1 - r, c2 = N - 1 - c;
    g[r][c] = '#'; g[r2][c2] = '#';
    placed += (r === r2 && c === c2) ? 1 : 2;
  }
  return g.map((row) => row.join(''));
}

for (let t = 0; t < Number(a.tries); t++) {
  const g = build(rngFrom(`kid|${N}|${a.id}|${t}`));
  if (!slotsOk(g)) continue;
  const grid2 = g.map((r) => r.split(''));
  if (!isSymmetric(g) || !isConnected(g)) continue;
  if (!fullyCovered(g)) continue;
  const blocks = blocksOf(g);
  // Gate: fill it from the kid bank alone, a few seeds.
  let filled = 0;
  for (let s = 0; s < 3; s++) {
    const res = fill(templateToGrid(N, blocks), bank, rngFrom(`kidf|${a.id}|${s}`),
      { maxSteps: 120_000, jitter: 0.35, beamWidth: 30, scoreFloor: 0 });
    if (res.ok) filled++;
  }
  if (filled >= 2) {
    const { slots } = deriveSlots(templateToGrid(N, blocks), 3);
    const pct = (100 * blocks.length / (N * N)).toFixed(0);
    console.error(`✓ ${a.id}: ${blocks.length} blocks (${pct}%), ${slots.length} slots, fills ${filled}/3 after ${t} tries`);
    console.log(JSON.stringify({ id: a.id, size: N, blocks, openness: 5, lattice: true }));
    process.exit(0);
  }
}
console.error(`✗ ${a.id}: no kid-fillable ${N}×${N} lattice in ${a.tries} tries`);
process.exit(1);
