#!/usr/bin/env node
// Kid-safe "glue" tier: the common words that let a PROPER (fully-checked) kid
// grid fill without pulling in adult vocabulary. A fully-checked 5×5 needs more
// words than the themed kid bank alone has, and the crossings force some
// non-themed fill — so we screen the clued bank against the New Dale–Chall list
// of ~3,000 words familiar to 4th-graders (a devDependency, build-time only).
// Every survivor is a word a child reads, carrying an easy clue we already
// wrote. Output ships as static data (runtime stays dependency-free).
//
//   node scripts/author-kids-glue.mjs

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { daleChall } from 'dale-chall';
import { loadBankEntries } from './lib/bank-node.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const KIDS_DIR = join(ROOT, 'src/data/kids');
const GLUE_DIR = join(ROOT, 'src/data/kids-glue');

const familiar = new Set(daleChall.map((w) => w.toUpperCase()));

// Words the themed kid bank already owns — never duplicate (kids win those
// slots, and glue lives in its own dir so it's never mistaken for a theme word).
const kidWords = new Set();
for (const f of readdirSync(KIDS_DIR)) {
  if (f.endsWith('.json')) {
    for (const e of JSON.parse(readFileSync(join(KIDS_DIR, f), 'utf8'))) kidWords.add(e.answer);
  }
}

// Kid-friendliness of a clue: plain, short, definitional beats jargon. Penalize
// interior capitals (proper nouns / abbreviations like "QB"), digits, and
// grown-up reference-y phrasing; reward short definitional wording. Higher wins.
function kidClueScore(text) {
  let s = 100 - text.length; // shorter is friendlier
  const interiorCaps = (text.slice(1).match(/[A-Z]/g) ?? []).length;
  s -= interiorCaps * 14;                        // proper nouns / abbreviations
  if (/\d/.test(text)) s -= 20;                  // years, sports stats, jargon
  if (/\b[A-Z]{2,}\b/.test(text)) s -= 25;       // ALL-CAPS abbreviations (QB, NBA)
  if (/[:;(]/.test(text)) s -= 8;                // editorial/technical asides
  if (/^(A |An |The |To )/.test(text)) s += 8;   // clean definitional opener
  if (/^\w+$/.test(text)) s += 6;                // one-word synonym: simple
  return s;
}

// Screen the clued bank (curated + authored) → familiar, short, easy-clued.
const bySize = { 3: 0, 4: 0, 5: 0, 6: 0 };
const out = [];
const seen = new Set();
for (const e of loadBankEntries({ includeFill: false, includeAuthored: true })) {
  const a = e.answer;
  if (a.length < 3 || a.length > 6) continue;
  if (!familiar.has(a) || kidWords.has(a) || seen.has(a)) continue;
  // Among the easy clues, take the kid-friendliest.
  const easy = e.clues
    .filter((c) => c.difficulty <= 2)
    .sort((x, y) => kidClueScore(y.text) - kidClueScore(x.text))[0];
  if (!easy) continue;
  seen.add(a);
  bySize[a.length]++;
  out.push({
    answer: a,
    score: e.score,
    categories: [e.categories[0] ?? 'wordplay'],
    tags: ['glue'],
    clues: [{ text: easy.text, difficulty: easy.difficulty, stars: easy.stars }],
  });
}

out.sort((x, y) => x.answer.length - y.answer.length || x.answer.localeCompare(y.answer));
mkdirSync(GLUE_DIR, { recursive: true });
writeFileSync(join(GLUE_DIR, 'glue.json'), JSON.stringify(out) + '\n');
console.log(`Wrote ${out.length} kid-safe glue words → src/data/kids-glue/glue.json`);
console.log('by length:', JSON.stringify(bySize));
