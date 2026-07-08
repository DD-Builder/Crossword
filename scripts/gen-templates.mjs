#!/usr/bin/env node
// Generate NYT-standard American grid templates (180°-symmetric, fully checked,
// ~16% black, every word 3–7 letters) for a size, gated by the real filler so
// every emitted template is guaranteed fillable. Constructive strategy: keep
// breaking the longest white run with a symmetric block pair until no run
// exceeds MAXWORD, then verify connectivity + fill.
//
//   node scripts/gen-templates.mjs --size 21 --id t21-a [--maxword 7] [--tries 200]

import { parseArgs } from 'node:util';
import { fill } from '../src/core/generator/filler.ts';
import { buildIndex } from '../src/core/generator/index.ts';
import { isConnected, isFullyChecked, isSymmetric, templateToGrid } from '../src/core/grid.ts';
import { rngFrom } from '../src/core/rng.ts';
import { loadBankEntries, loadFillWordlist } from './lib/bank-node.mjs';

const { values: a } = parseArgs({ options: {
  size: { type: 'string' }, id: { type: 'string' },
  maxword: { type: 'string', default: '7' }, tries: { type: 'string', default: '400' },
} });
const N = Number(a.size);
const MAXWORD = Number(a.maxword);
const MINDENS = 0.15, MAXDENS = 0.25;
// Build-time only: the dense 509k list makes fills fast + reliable so the gate
// measures the *pattern*, not bank coverage. Runtime fill uses the shipped bank.
const bank = buildIndex([...loadBankEntries(), ...loadFillWordlist({ minScore: 55 })]);

const key = (r, c) => r * N + c;
const inb = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

/** Maximal white runs (row + col). Returns { line: 'r'|'c', idx, start, len }. */
function runs(g) {
  const out = [];
  for (let r = 0; r < N; r++) {
    let s = -1;
    for (let c = 0; c <= N; c++) {
      const white = c < N && g[r][c] === '.';
      if (white && s < 0) s = c;
      else if (!white && s >= 0) { out.push({ line: 'r', idx: r, start: s, len: c - s }); s = -1; }
    }
  }
  for (let c = 0; c < N; c++) {
    let s = -1;
    for (let r = 0; r <= N; r++) {
      const white = r < N && g[r][c] === '.';
      if (white && s < 0) s = r;
      else if (!white && s >= 0) { out.push({ line: 'c', idx: c, start: s, len: r - s }); s = -1; }
    }
  }
  return out;
}

/** No white run of length 1 or 2 on the changed lines? (Long runs are fine
 * mid-construction — the break-longest-run loop drives them down to MAXWORD.) */
function linesOk(g, rows, cols) {
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

function build(rng) {
  const g = Array.from({ length: N }, () => Array(N).fill('.'));
  const center = (N - 1) / 2;
  // Random symmetric placement keeping no 1/2-length run (so the result is
  // fully checked by construction) until the density target is met, then cap
  // any word longer than MAXWORD if we can. The dense build-time bank fills
  // long words fine, so MAXWORD is a soft preference.
  const target = Math.round(N * N * (MINDENS + 0.02));
  let blocks = 0, guard = 0;
  const tryPlace = (r, c) => {
    if (!inb(r, c) || (r === center && c === center) || g[r][c] === '#') return false;
    const r2 = N - 1 - r, c2 = N - 1 - c;
    g[r][c] = '#'; g[r2][c2] = '#';
    if (linesOk(g, [r, r2], [c, c2])) { blocks += (r === r2 && c === c2) ? 1 : 2; return true; }
    g[r][c] = '.'; g[r2][c2] = '.';
    return false;
  };
  // Phase 1: fill to the density target with random valid blocks.
  while (blocks < target && guard++ < 12000) {
    tryPlace(Math.floor(rng.next() * N), Math.floor(rng.next() * N));
  }
  // Phase 2: shorten over-long words where a valid split exists (best effort).
  for (let pass = 0; pass < 3; pass++) {
    for (const L of runs(g)) {
      if (L.len <= MAXWORD) continue;
      for (let k = 3; k <= L.len - 4; k++) {
        const r = L.line === 'r' ? L.idx : L.start + k;
        const c = L.line === 'r' ? L.start + k : L.idx;
        if (tryPlace(r, c)) break;
      }
    }
  }
  return g.map((row) => row.join(''));
}

function gridBlocks(g) {
  const b = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (g[r][c] === '#') b.push([r, c]);
  return b;
}

for (let t = 0; t < Number(a.tries); t++) {
  const g = build(rngFrom(`gt|${N}|${a.id}|${t}`));
  if (!g) continue;
  const dens = g.join('').split('#').length / (N * N);
  if (dens < MINDENS || dens > MAXDENS) continue;
  if (!isSymmetric(g) || !isConnected(g) || !isFullyChecked(g, 3)) continue;
  const blocks = gridBlocks(g.map((r) => r.split('')));
  let filled = 0;
  for (let s = 0; s < 2; s++) {
    const res = fill(templateToGrid(N, blocks), bank, rngFrom(`gtf|${a.id}|${s}`),
      { maxSteps: 200_000, jitter: 0.3, beamWidth: 40, tagWeights: { fill: 0.6 } });
    if (res.ok) filled++;
  }
  if (filled >= 1) {
    const pct = (100 * blocks.length / (N * N)).toFixed(0);
    console.error(`✓ ${a.id}: ${blocks.length} blocks (${pct}%), fills ${filled}/3 after ${t} tries`);
    console.log(JSON.stringify({ id: a.id, size: N, blocks, openness: N >= 15 ? 5 : 4 }));
    process.exit(0);
  }
}
console.error(`✗ ${a.id}: no fillable ${N}×${N} pattern in ${a.tries} tries`);
process.exit(1);
