#!/usr/bin/env node
// Hand-authored puzzle library gate — numbering derived from the grid must
// match every clue; symmetry/connectivity/min-length/fully-checked enforced.
import { existsSync, readdirSync } from 'node:fs';

const dir = new URL('../src/data/puzzles', import.meta.url).pathname;
if (!existsSync(dir)) {
  console.log('validate-puzzles: no puzzles yet — skipping');
  process.exit(0);
}
const { validatePuzzles } = await import('./lib/validate-puzzles-impl.mjs');
process.exit(validatePuzzles(dir));
