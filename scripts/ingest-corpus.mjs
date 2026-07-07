// Build-time corpus ingestion.  Walks the locally-cloned NYT crossword archive
// (`data/clue-corpus/raw/nyt_crosswords`, gitignored) and distills it into a
// compact answer -> ranked-clues index used ONLY at authoring time by
// `scripts/author-clues.mjs`.  Nothing here ships to the browser, and no clue
// text is ever emitted verbatim into `src/` — the authoring step transforms
// every clue into our own voice (see data/clue-corpus/PROVENANCE.md).
//
// Usage:  node scripts/ingest-corpus.mjs [--max-clues 24] [--out <path>]
//
// Emits data/clue-corpus/index.json:
//   { "ANSWER": { "n": <total occurrences>,
//                 "clues": [ { "text", "count", "dow": {Mon..Sun}, "diff": 1..5 } ] } }

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'data/clue-corpus/raw/nyt_crosswords');

const argv = process.argv.slice(2);
const argVal = (flag, def) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const MAX_CLUES = Number(argVal('--max-clues', '24'));
const OUT = argVal('--out', join(ROOT, 'data/clue-corpus/index.json'));

// NYT day-of-week → difficulty tier (1 Mon … 5 Sat). Sunday is big but mid.
const DOW_DIFF = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 4, Saturday: 5, Sunday: 3 };
const DOW_KEY = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };

/** Strip the leading "12. " grid-number prefix NYT clue strings carry. */
function cleanClue(raw) {
  return String(raw).replace(/^\s*\d+\.\s*/, '').trim();
}

/** Recursively collect every puzzle JSON path under a dir. */
function walk(dir, out) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && ent.name.endsWith('.json')) out.push(p);
  }
  return out;
}

if (!existsSync(RAW)) {
  console.error(`No corpus at ${RAW}\nClone it first (see data/clue-corpus/PROVENANCE.md):`);
  console.error('  git clone --depth 1 https://github.com/doshea/nyt_crosswords.git \\\n    data/clue-corpus/raw/nyt_crosswords');
  process.exit(1);
}

const files = walk(RAW, []);
console.error(`Scanning ${files.length} puzzle files…`);

// answer -> { n, clues: Map<text, {count, dow:{}}> }
const bank = new Map();
let pairs = 0;
let bad = 0;

for (const file of files) {
  let puz;
  try { puz = JSON.parse(readFileSync(file, 'utf8')); } catch { bad++; continue; }
  const dow = typeof puz.dow === 'string' ? puz.dow : null;
  for (const dir of ['across', 'down']) {
    const clues = puz.clues?.[dir];
    const answers = puz.answers?.[dir];
    if (!Array.isArray(clues) || !Array.isArray(answers)) continue;
    const len = Math.min(clues.length, answers.length);
    for (let i = 0; i < len; i++) {
      const answer = String(answers[i] ?? '').toUpperCase().replace(/[^A-Z]/g, '');
      if (!/^[A-Z]{2,15}$/.test(answer)) continue;
      const text = cleanClue(clues[i]);
      if (text.length < 2 || text.length > 140) continue;
      pairs++;
      let rec = bank.get(answer);
      if (!rec) { rec = { n: 0, clues: new Map() }; bank.set(answer, rec); }
      rec.n++;
      let cr = rec.clues.get(text);
      if (!cr) { cr = { count: 0, dow: {} }; rec.clues.set(text, cr); }
      cr.count++;
      if (dow) cr.dow[DOW_KEY[dow]] = (cr.dow[DOW_KEY[dow]] || 0) + 1;
    }
  }
}

/** Weighted-average difficulty (1..5) from a clue's day-of-week histogram. */
function diffFromDow(dowHist) {
  let sum = 0, w = 0;
  for (const [dowName, key] of Object.entries(DOW_KEY)) {
    const c = dowHist[key] || 0;
    if (c) { sum += DOW_DIFF[dowName] * c; w += c; }
  }
  return w ? Math.max(1, Math.min(5, Math.round(sum / w))) : 3;
}

const index = {};
let keptClues = 0;
for (const [answer, rec] of bank) {
  const clues = [...rec.clues.entries()]
    .map(([text, cr]) => ({ text, count: cr.count, dow: cr.dow, diff: diffFromDow(cr.dow) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_CLUES);
  index[answer] = { n: rec.n, clues };
  keptClues += clues.length;
}

writeFileSync(OUT, JSON.stringify(index));
const sizeMb = (statSync(OUT).size / 1e6).toFixed(1);
console.error(
  `\nDone. ${pairs.toLocaleString()} clue/answer pairs from ${files.length - bad} puzzles ` +
  `(${bad} unreadable)\n` +
  `${bank.size.toLocaleString()} distinct answers, ${keptClues.toLocaleString()} clues kept ` +
  `(≤${MAX_CLUES}/answer)\nWrote ${OUT} (${sizeMb} MB)`,
);
