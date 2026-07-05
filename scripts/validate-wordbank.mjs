#!/usr/bin/env node
// Wordbank gate — entry shape, clue quality rules, distribution minimums.
// Real checks land with the wordbank data; until it exists this passes.
import { existsSync, readdirSync } from 'node:fs';

const dir = new URL('../src/data/wordbank', import.meta.url).pathname;
if (!existsSync(dir) || !readdirSync(dir).some((f) => f.endsWith('.json'))) {
  console.log('validate-wordbank: no wordbank yet — skipping');
  process.exit(0);
}
const { validateWordbank } = await import('./lib/validate-wordbank-impl.mjs');
process.exit(validateWordbank(dir));
