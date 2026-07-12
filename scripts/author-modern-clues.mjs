#!/usr/bin/env node
// Merge scripts/data/modern-clues.json (hand-authored) into the curated
// wordbank, tagging each register:'modern'. Skips any clue that would leak
// the answer (defense in depth — validate-wordbank.mjs checks again) or an
// answer the curated bank doesn't have. Writes back only the files touched.
//
//   node scripts/author-modern-clues.mjs

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const WORDBANK_DIR = join(ROOT, 'src/data/wordbank');

function stems(word) {
  const out = new Set([word]);
  if (word.endsWith('S')) out.add(word.slice(0, -1));
  if (word.endsWith('ES')) out.add(word.slice(0, -2));
  if (word.endsWith('ED')) out.add(word.slice(0, -2));
  if (word.endsWith('ING')) out.add(word.slice(0, -3));
  return out;
}
function leaks(answer, text) {
  const words = text.toUpperCase().replace(/[^A-Z]/g, ' ').split(/\s+/).filter(Boolean);
  const targetStems = stems(answer.toUpperCase());
  return words.some((w) => {
    if (w.length < 3) return false;
    for (const ws of stems(w)) if (targetStems.has(ws)) return true;
    return false;
  });
}

const modern = JSON.parse(readFileSync(join(ROOT, 'scripts/data/modern-clues.json'), 'utf8'));
delete modern._comment;

// Curated tier only — the fill/ subdirectory and any "-fill" file are the
// score-capped completion tier with a strict maxClues:2, not for extra clues.
const files = readdirSync(WORDBANK_DIR).filter((f) => f.endsWith('.json') && !f.includes('fill'));

let added = 0;
let skippedLeak = 0;
const found = new Set();

for (const f of files) {
  const path = join(WORDBANK_DIR, f);
  const entries = JSON.parse(readFileSync(path, 'utf8'));
  let touched = false;
  for (const e of entries) {
    const spec = modern[e.answer];
    if (!spec || found.has(e.answer)) continue;
    if (e.clues.some((c) => c.register === 'modern')) { found.add(e.answer); continue; } // already has one
    if (leaks(e.answer, spec.text)) { skippedLeak++; console.log(`  SKIP (leak): ${e.answer} — "${spec.text}"`); continue; }
    e.clues.push({ text: spec.text, difficulty: spec.difficulty, stars: spec.stars, register: 'modern' });
    found.add(e.answer);
    added++;
    touched = true;
  }
  if (touched) writeFileSync(path, JSON.stringify(entries) + '\n');
}

const missing = Object.keys(modern).filter((a) => !found.has(a));
console.log(`Added ${added} modern clues across ${files.length} curated files.`);
if (skippedLeak) console.log(`Skipped ${skippedLeak} for leaking the answer.`);
if (missing.length) console.log(`Not found in curated bank (${missing.length}): ${missing.join(', ')}`);
