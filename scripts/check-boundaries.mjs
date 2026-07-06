#!/usr/bin/env node
// Module boundary gate: src/core and src/data must stay pure — no imports
// from ui/app/solve layers and no DOM globals. This keeps the engine usable
// from node scripts and unit tests.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PURE_DIRS = ['src/core'];
const BANNED = [
  /from\s+['"].*\/(ui|app|solve|stats|llm|storage|worker)\//,
  /\bdocument\./,
  /\bwindow\./,
  /\blocalStorage\b/,
  /\bnavigator\./,
];

let failures = 0;

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|js)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

for (const dir of PURE_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const text = readFileSync(file, 'utf8');
    for (const pattern of BANNED) {
      const m = text.match(pattern);
      if (m) {
        console.error(`BOUNDARY VIOLATION ${file.replace(ROOT, '')}: ${m[0]}`);
        failures++;
      }
    }
  }
}

if (failures > 0) {
  console.error(`\ncheck-boundaries: ${failures} violation(s)`);
  process.exit(1);
}
console.log('check-boundaries: OK');
