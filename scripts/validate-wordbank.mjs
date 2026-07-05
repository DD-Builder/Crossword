#!/usr/bin/env node
// Wordbank gate — entry shape, clue quality rules, distribution minimums.
// Usage: node scripts/validate-wordbank.mjs [dir]
//   WORDBANK_SEED=1       use seed-pass (smaller) count minima
//   WORDBANK_NO_MINIMA=1  skip count minima (single-bucket checks)
import { existsSync, readdirSync } from 'node:fs';

const dir = process.argv[2] ?? new URL('../src/data/wordbank', import.meta.url).pathname;
if (!existsSync(dir) || !readdirSync(dir).some((f) => f.endsWith('.json'))) {
  console.log('validate-wordbank: no wordbank yet — skipping');
  process.exit(0);
}
const { validateWordbank } = await import('./lib/validate-wordbank-impl.mjs');
process.exit(validateWordbank(dir));
