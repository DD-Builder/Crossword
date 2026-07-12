#!/usr/bin/env node
// Kid-safe "glue" tier. A proper (fully-checked) kid grid needs more words than
// the themed bank alone, and every one must be a word a child can read — so we
// screen the clued bank against kid-safe vocabulary (New Dale–Chall + very
// common words) and rate each clue with the SAME 1–5 difficulty/stars fields as
// the grown-up bank. There is one merged kids pool (no grade ladder): a clue
// that reads like an adult reference gets its difficulty bumped up so the
// Kids tier's low `clueCap` naturally excludes it at generation time — the
// same mechanism that keeps Monday gettable in the main bank.
// Build-time only (Dale–Chall + a frequency list are devDeps); ships as static
// data, runtime stays dependency-free.
//
//   node scripts/author-kids-glue.mjs

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadBankEntries } from './lib/bank-node.mjs';
import { DALE_CHALL, looksLikeReference } from './lib/kid-grades.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const KIDS_DIR = join(ROOT, 'src/data/kids');
const GLUE_DIR = join(ROOT, 'src/data/kids-glue');

// Very common words (build-time frequency list) widen the kid-safe pool beyond
// Dale–Chall.
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
const byDifficulty = [0, 0, 0, 0, 0, 0];
let clueCount = 0;
const out = [];
const seen = new Set();

for (const e of loadBankEntries({ includeFill: false, includeAuthored: true })) {
  const a = e.answer;
  if (a.length < 3 || a.length > 8) continue;
  if (!kidSafe(a) || kidWords.has(a) || seen.has(a)) continue;

  // Keep the kid-friendliest clues (nothing devious — difficulty ≤ 4), and bump
  // any that read as an adult reference up to difficulty 3+ so they naturally
  // sit above the Kids tier's clueCap and never get picked for a kids puzzle.
  const clues = e.clues
    .filter((c) => c.difficulty <= 4 && !/\b[A-Z]{2,}\b/.test(c.text) && c.text.length <= 60)
    .sort((x, y) => kidClueScore(y.text) - kidClueScore(x.text))
    .slice(0, MAX_CLUES)
    .map((c) => ({
      text: c.text,
      difficulty: looksLikeReference(c.text) ? Math.max(c.difficulty, 3) : c.difficulty,
      stars: c.stars,
    }));
  // Require at least one reasonably easy (difficulty ≤ 2) clue — otherwise
  // pickClue's easiest-available fallback could still hand a kid its hardest
  // clue for this answer. Drop the whole answer rather than ship it without
  // one; this trims the pool a little but every answer that survives is
  // guaranteed a plain-enough clue.
  if (clues.length === 0 || !clues.some((c) => c.difficulty <= 2)) continue;

  seen.add(a);
  for (const c of clues) byDifficulty[c.difficulty]++;
  clueCount += clues.length;
  out.push({ answer: a, score: e.score, categories: [e.categories[0] ?? 'wordplay'], tags: ['glue'], clues });
}

// Merge the hand-authored plain clues. The clued corpus is thin on simple,
// proper-noun-free clues for the commonest concrete words, which otherwise
// starves the easy end of the pool — these guarantee each listed word a plain
// difficulty-1 clue (and create the entry if the corpus lacked the word
// entirely).
const plain = JSON.parse(readFileSync(join(ROOT, 'scripts/data/kid-plain-clues.json'), 'utf8'));
const byAnswer = new Map(out.map((e) => [e.answer, e]));
for (const [answer, text] of Object.entries(plain)) {
  if (answer.startsWith('_') || kidWords.has(answer)) continue; // skip notes + themed dupes
  const clue = { text, difficulty: 1, stars: 1 };
  const existing = byAnswer.get(answer);
  if (existing) {
    if (!existing.clues.some((c) => c.text === text)) {
      existing.clues.unshift(clue);
      byDifficulty[1]++;
      clueCount++;
    }
  } else {
    const e = { answer, score: 70, categories: ['wordplay'], tags: ['glue'], clues: [clue] };
    out.push(e);
    byAnswer.set(answer, e);
    byDifficulty[1]++;
    clueCount++;
  }
}

out.sort((x, y) => x.answer.localeCompare(y.answer));
mkdirSync(GLUE_DIR, { recursive: true });
writeFileSync(join(GLUE_DIR, 'glue.json'), JSON.stringify(out) + '\n');
console.log(`Wrote ${out.length} kid-safe glue answers, ${clueCount} clues → src/data/kids-glue/glue.json`);
console.log('clues by difficulty (1…5):', JSON.stringify(byDifficulty.slice(1)));
