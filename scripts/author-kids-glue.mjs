#!/usr/bin/env node
// Graded kid-safe "glue" tier. A proper (fully-checked) kid grid needs more
// words than the themed bank alone, and every one must be a word a child of the
// target grade can read — so we screen the clued bank against kid-safe
// vocabulary (New Dale–Chall + very common words) and LABEL each answer/clue
// with the youngest grade it suits (0 = Kindergarten … 5 = fifth grade). At
// runtime the kids bank is filtered by the player's grade, so a kindergartner
// never sees a fifth-grade clue. Each answer keeps several clues spanning grades
// where the bank has them, which is where most of the extra volume comes from.
// Build-time only (Dale–Chall + a frequency list are devDeps); ships as static
// data, runtime stays dependency-free.
//
//   node scripts/author-kids-glue.mjs

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBankEntries } from './lib/bank-node.mjs';
import { DALE_CHALL, clueGrade, wordGrade } from './lib/kid-grades.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const KIDS_DIR = join(ROOT, 'src/data/kids');
const GLUE_DIR = join(ROOT, 'src/data/kids-glue');

// Very common words (build-time frequency list) widen the kid-safe pool beyond
// Dale–Chall for the older grades; wordGrade() pushes anything unfamiliar to a
// higher grade, so these never reach the little ones.
const common = new Set(
  readFileSync(join(ROOT, 'data/graded/freq.txt'), 'utf8')
    .trim().split('\n').slice(0, 5000).map((w) => w.trim().toUpperCase()),
);
// A short stoplist for words that are common but not for a children's game.
const STOP = new Set(('war wars gun guns kill kills killed death dead die died dying drug drugs '
  + 'beer wine booze bar bars cigarette tobacco casino bet gamble hell damn sexy nude naked '
  + 'gay lesbian rifle bomb bombs murder blood corpse coffin grave weapon weapons ammo tax taxes '
  + 'debt loan mortgage divorce lawsuit lawyer terror crime criminal prison jail slave').toUpperCase().split(/\s+/));

const kidSafe = (a) => (DALE_CHALL.has(a) || common.has(a)) && !STOP.has(a);

// Words the themed kid bank already owns — never duplicate (kids win those
// slots, and glue lives in its own dir so it's never mistaken for a theme word).
const kidWords = new Set();
for (const f of readdirSync(KIDS_DIR)) {
  if (f.endsWith('.json')) {
    for (const e of JSON.parse(readFileSync(join(KIDS_DIR, f), 'utf8'))) kidWords.add(e.answer);
  }
}

// Kid-friendliness of a clue: plain, short, definitional beats jargon.
function kidClueScore(text) {
  let s = 100 - text.length;
  s -= ((text.slice(1).match(/[A-Z]/g) ?? []).length) * 14; // proper nouns / abbreviations
  if (/\d/.test(text)) s -= 20;                             // years, stats
  if (/\b[A-Z]{2,}\b/.test(text)) s -= 25;                  // ALL-CAPS abbreviations
  if (/[:;(]/.test(text)) s -= 8;
  if (/^(A |An |The |To )/.test(text)) s += 8;
  if (/^\w+$/.test(text)) s += 6;
  return s;
}

const MAX_CLUES = 4;
const byGrade = [0, 0, 0, 0, 0, 0];
let clueCount = 0;
const out = [];
const seen = new Set();

for (const e of loadBankEntries({ includeFill: false, includeAuthored: true })) {
  const a = e.answer;
  if (a.length < 3 || a.length > 8) continue;
  if (!kidSafe(a) || kidWords.has(a) || seen.has(a)) continue;
  const aGrade = wordGrade(a);

  // Keep the kid-friendliest clues at a spread of difficulties (so an answer can
  // serve several grades), difficulty ≤ 4 (nothing devious for kids).
  const clues = e.clues
    .filter((c) => c.difficulty <= 4 && !/\b[A-Z]{2,}\b/.test(c.text) && c.text.length <= 60)
    .sort((x, y) => kidClueScore(y.text) - kidClueScore(x.text))
    .slice(0, MAX_CLUES)
    .map((c) => ({ text: c.text, difficulty: c.difficulty, stars: c.stars, grade: clueGrade(a, c.text, c.difficulty) }));
  if (clues.length === 0) continue;

  seen.add(a);
  byGrade[aGrade]++;
  clueCount += clues.length;
  out.push({ answer: a, grade: aGrade, score: e.score, categories: [e.categories[0] ?? 'wordplay'], tags: ['glue'], clues });
}

// Merge the hand-authored plain kindergarten clues. The clued corpus is thin on
// simple, proper-noun-free clues for the commonest concrete words, which starves
// the youngest grade's fill pool — these guarantee each listed word a grade-0
// clue (and create the entry if the corpus lacked the word entirely).
const plain = JSON.parse(readFileSync(join(ROOT, 'scripts/data/kid-plain-clues.json'), 'utf8'));
const byAnswer = new Map(out.map((e) => [e.answer, e]));
for (const [answer, text] of Object.entries(plain)) {
  if (answer.startsWith('_') || kidWords.has(answer)) continue; // skip notes + themed dupes
  const clue = { text, difficulty: 1, stars: 1, grade: 0 };
  const existing = byAnswer.get(answer);
  if (existing) {
    if (!existing.clues.some((c) => c.text === text)) {
      existing.clues.unshift(clue);
      clueCount++;
    }
  } else {
    const e = { answer, grade: wordGrade(answer), score: 70, categories: ['wordplay'], tags: ['glue'], clues: [clue] };
    out.push(e);
    byAnswer.set(answer, e);
    byGrade[e.grade]++;
    clueCount++;
  }
}

out.sort((x, y) => x.grade - y.grade || x.answer.localeCompare(y.answer));
mkdirSync(GLUE_DIR, { recursive: true });
writeFileSync(join(GLUE_DIR, 'glue.json'), JSON.stringify(out) + '\n');
console.log(`Wrote ${out.length} kid-safe glue answers, ${clueCount} clues → src/data/kids-glue/glue.json`);
console.log('answers by grade (K…5):', JSON.stringify(byGrade));
