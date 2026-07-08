#!/usr/bin/env node
// Stamp a grade (0 = Kindergarten … 5 = fifth grade) onto every themed kid
// entry and clue in src/data/kids/*.json, using the same model as the glue tier
// (scripts/lib/kid-grades.mjs). Idempotent — recomputes and rewrites in place.
// Themed words are pre-vetted kid vocabulary, so they stay available at every
// grade; the grade only governs which CLUE a given grade sees (a kindergartner
// gets a themed word's simplest clue, never a witty fifth-grade one).
//
//   node scripts/annotate-kids-grades.mjs

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { clueGrade, wordGrade } from './lib/kid-grades.mjs';

const KIDS_DIR = new URL('../src/data/kids/', import.meta.url).pathname;
const dist = [0, 0, 0, 0, 0, 0];

for (const f of readdirSync(KIDS_DIR)) {
  if (!f.endsWith('.json')) continue;
  const path = join(KIDS_DIR, f);
  const entries = JSON.parse(readFileSync(path, 'utf8'));
  for (const e of entries) {
    e.grade = wordGrade(e.answer);
    dist[e.grade]++;
    for (const c of e.clues) c.grade = clueGrade(e.answer, c.text, c.difficulty);
  }
  writeFileSync(path, JSON.stringify(entries) + '\n');
  console.log(`  ${f}: ${entries.length} entries graded`);
}
console.log('themed answers by grade (K…5):', JSON.stringify(dist));
