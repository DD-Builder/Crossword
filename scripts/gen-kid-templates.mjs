#!/usr/bin/env node
// Kid grids: small, symmetric, FULLY-CHECKED templates — real crosswords where
// every white cell sits in both an across and a down word (no orphan pairs, no
// unchecked cells). Words are short (3..maxword) so a young solver — and the kid
// vocabulary — can actually fill them. Fill-gated so each emitted template is
// solvable from the kid bank (optionally plus a simple "glue" tier).
//
//   node scripts/gen-kid-templates.mjs --size 7 --id kid7-a [--maxword 5] [--glue] [--tries 20000]

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { fill } from '../src/core/generator/filler.ts';
import { buildIndex } from '../src/core/generator/index.ts';
import { deriveSlots, isConnected, isFullyChecked, isSymmetric, templateToGrid } from '../src/core/grid.ts';
import { rngFrom } from '../src/core/rng.ts';
import { loadBankEntries } from './lib/bank-node.mjs';

const { values: a } = parseArgs({ options: {
  size: { type: 'string' }, id: { type: 'string' },
  maxword: { type: 'string', default: '5' }, tries: { type: 'string', default: '20000' },
  glue: { type: 'boolean', default: false },
} });
const N = Number(a.size);
const MAXLEN = Number(a.maxword);

const ROOT = new URL('..', import.meta.url).pathname;
const kids = [];
for (const f of readdirSync(join(ROOT, 'src/data/kids'))) {
  if (f.endsWith('.json')) kids.push(...JSON.parse(readFileSync(join(ROOT, 'src/data/kids', f), 'utf8')));
}
// The gate bank: kid words always; a simple short grown-up "glue" tier when
// --glue, so we can measure whether a grid fills once glue is allowed. (Runtime
// quality — how much glue actually appears — is controlled separately by kid
// weighting in loader.kidsBank.)
const gateEntries = [...kids];
if (a.glue) {
  for (const e of loadBankEntries({ includeFill: false, includeAuthored: false })) {
    if (e.answer.length <= 5 && e.score >= 60 && e.clues.some((c) => c.difficulty <= 2)) {
      gateEntries.push(e);
    }
  }
}
const bank = buildIndex(gateEntries);

/** Every white run must be 3..MAXLEN in BOTH directions — which is exactly a
 * fully-checked grid with short words (no run of 1 or 2 ⇒ every cell is in a
 * ≥3 word across and down). */
function runsOk(grid) {
  const bad = (arr) => {
    let s = -1;
    for (let i = 0; i <= arr.length; i++) {
      const white = i < arr.length && arr[i] === '.';
      if (white && s < 0) s = i;
      else if (!white && s >= 0) { const len = i - s; if (len < 3 || len > MAXLEN) return true; s = -1; }
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

function blocksOf(grid) {
  const b = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (grid[r][c] === '#') b.push([r, c]);
  return b;
}

/** Maximal white runs on the given rows/cols contain no length-1 or length-2
 * run? (Short runs would leave an unchecked cell — reject them during placement;
 * long runs are fine here and get shortened afterward.) */
function noOrphans(g, rows, cols) {
  const bad = (arr) => {
    let s = -1;
    for (let i = 0; i <= arr.length; i++) {
      const white = i < arr.length && arr[i] === '.';
      if (white && s < 0) s = i;
      else if (!white && s >= 0) { const len = i - s; if (len === 1 || len === 2) return true; s = -1; }
    }
    return false;
  };
  for (const r of rows) if (bad(g[r])) return false;
  for (const c of cols) { const col = []; for (let r = 0; r < N; r++) col.push(g[r][c]); if (bad(col)) return false; }
  return true;
}

/** Constructive symmetric placement: only ever place a block pair that leaves
 * no orphan (length 1/2) run — so the grid stays fully-checkable — then shorten
 * any run longer than MAXLEN. (Pure rejection sampling can't find these; this is
 * the same method the American large-grid generator uses.) */
function build(rng) {
  const g = Array.from({ length: N }, () => Array(N).fill('.'));
  const center = (N - 1) / 2;
  const tryPlace = (r, c) => {
    if (r < 0 || r >= N || c < 0 || c >= N || (r === center && c === center) || g[r][c] === '#') return false;
    const r2 = N - 1 - r, c2 = N - 1 - c;
    g[r][c] = '#'; g[r2][c2] = '#';
    if (noOrphans(g, [r, r2], [c, c2])) return true;
    g[r][c] = '.'; g[r2][c2] = '.';
    return false;
  };
  const lo = MAXLEN <= 4 ? 0.30 : 0.18;
  const target = Math.round(N * N * (lo + rng.next() * 0.08));
  let blocks = 0, guard = 0;
  while (blocks < target && guard++ < 12000) {
    if (tryPlace(Math.floor(rng.next() * N), Math.floor(rng.next() * N))) {
      blocks = blocksOf(g).length;
    }
  }
  // Shorten any run longer than MAXLEN where a valid split exists.
  for (let pass = 0; pass < 4; pass++) {
    const rows = g.map((row) => row.join(''));
    for (let r = 0; r < N; r++) {
      for (const m of rows[r].matchAll(/\.{6,}/g)) {
        const start = m.index, len = m[0].length;
        if (len <= MAXLEN) continue;
        for (let k = 3; k <= len - 4; k++) if (tryPlace(r, start + k)) break;
      }
    }
    for (let c = 0; c < N; c++) {
      const col = g.map((row) => row[c]).join('');
      for (const m of col.matchAll(/\.{6,}/g)) {
        const start = m.index, len = m[0].length;
        if (len <= MAXLEN) continue;
        for (let k = 3; k <= len - 4; k++) if (tryPlace(start + k, c)) break;
      }
    }
  }
  return g.map((row) => row.join(''));
}

for (let t = 0; t < Number(a.tries); t++) {
  const g = build(rngFrom(`kid|${N}|${a.id}|${a.maxword}|${t}`));
  if (!runsOk(g)) continue;
  if (!isSymmetric(g) || !isConnected(g) || !isFullyChecked(g, 3)) continue;
  const blocks = blocksOf(g.map((r) => r.split('')));
  let filled = 0;
  for (let s = 0; s < 3; s++) {
    const res = fill(templateToGrid(N, blocks), bank, rngFrom(`kidf|${a.id}|${s}`),
      { maxSteps: 150_000, jitter: 0.35, beamWidth: 30, scoreFloor: 0 });
    if (res.ok) filled++;
  }
  if (filled >= 2) {
    const { slots } = deriveSlots(templateToGrid(N, blocks), 3);
    const pct = (100 * blocks.length / (N * N)).toFixed(0);
    console.error(`✓ ${a.id}: ${blocks.length} blocks (${pct}%), ${slots.length} slots, fills ${filled}/3 after ${t} tries`);
    console.log(JSON.stringify({ id: a.id, size: N, blocks, openness: 4 }));
    process.exit(0);
  }
}
console.error(`✗ ${a.id}: no kid-fillable fully-checked ${N}×${N} in ${a.tries} tries`);
process.exit(1);
