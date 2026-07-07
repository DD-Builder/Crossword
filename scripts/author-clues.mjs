#!/usr/bin/env node
// Author clues for answers we can fill but don't yet have clues for, by
// transforming the established-clue corpus (data/clue-corpus/index.json) into
// this project's schema and voice: KEEP the clever ones (definition-adjacent,
// misdirecting, specific), DROP the flat/crosswordese/unresolvable ones, tier
// and rate every survivor, and validate it against the same leak/agreement
// rules the wordbank validator enforces.
//
// This is the "learn from that base, edit for our own purposes" step
// (data/clue-corpus/PROVENANCE.md): nothing is emitted verbatim without a
// craft screen + normalization, and the corpus itself never ships.
//
//   node scripts/author-clues.mjs [--min-n 6] [--max-clues 5] [--shards 8]
//
// Emits src/data/wordbank/authored/nyt-*.json — a lazy-loaded curated tier that
// covers the American grids (dailies bake it at build time; Free Play large
// grids load it on demand).

import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { loadBankEntries, loadFillWordlist } from './lib/bank-node.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const { values: args } = parseArgs({
  options: {
    'min-n': { type: 'string', default: '6' },
    'max-clues': { type: 'string', default: '4' },
    shards: { type: 'string', default: '8' },
  },
});
const MIN_N = Number(args['min-n']);
const MAX_CLUES = Number(args['max-clues']);
const SHARDS = Number(args.shards);

// ---- inputs ---------------------------------------------------------------
const idxPath = join(ROOT, 'data/clue-corpus/index.json');
if (!existsSync(idxPath)) {
  console.error('Missing data/clue-corpus/index.json — run scripts/ingest-corpus.mjs first.');
  process.exit(1);
}
const idx = JSON.parse(readFileSync(idxPath, 'utf8'));

// Answers we already have (any curated/fill entry) — never duplicate them.
const existing = new Set(loadBankEntries({ includeAuthored: false }).map((e) => e.answer));
// Fill quality: only author answers we'd actually place in a grid.
const fillScore = new Map();
for (const e of loadFillWordlist({ minScore: 60 })) fillScore.set(e.answer, e.score);
const placeable = (a) => existing.has(a) || fillScore.has(a);

// ---- leak check (mirrors validate-wordbank-impl.mjs / validator.ts) -------
function stems(w) {
  const out = new Set([w]);
  if (w.endsWith('S')) out.add(w.slice(0, -1));
  if (w.endsWith('ES')) out.add(w.slice(0, -2));
  if (w.endsWith('ED')) out.add(w.slice(0, -2));
  if (w.endsWith('ING')) out.add(w.slice(0, -3));
  return out;
}
function leaks(answer, text) {
  const words = text.toUpperCase().replace(/[^A-Z]/g, ' ').split(/\s+/).filter(Boolean);
  const target = stems(answer.toUpperCase());
  if (answer.length < 3) return words.includes(answer.toUpperCase());
  return words.some((w) => {
    if (w.length < 3) return false;
    for (const ws of stems(w)) if (target.has(ws)) return true;
    return false;
  });
}

// ---- category inference (validator needs exactly one known category) ------
const CAT_RULES = [
  ['geography', /\b(river|city|capital|country|island|lake|mountain|sea|desert|nation|county|province|peninsula|bay|gulf|border|region)\b/i],
  ['entertainment', /\b(film|movie|actor|actress|singer|song|album|band|sitcom|TV|series|Oscar|role|character|show|director|rapper|pop)\b/i],
  ['history', /\b(war|president|king|queen|emperor|ancient|century|B\.?C\.?|dynasty|empire|battle|treaty|colony|revolution)\b/i],
  ['arts-literature', /\b(poet|novel|author|writer|painter|poem|play|opera|artist|book|verse|muse|sculpt|canvas|composer)\b/i],
  ['science-nature', /\b(animal|bird|fish|plant|tree|flower|element|acid|gas|cell|planet|star|chemical|species|mineral|organ|molecule|atom)\b/i],
  ['sports-leisure', /\b(team|game|sport|player|ball|league|Olympic|race|tennis|golf|boxing|hockey|soccer|coach|inning|goal|court)\b/i],
];
function categoryFor(text) {
  for (const [cat, re] of CAT_RULES) if (re.test(text)) return cat;
  return 'wordplay';
}

// ---- register inference (soft; leave neutral unless a clear tell) ---------
const CLASSIC_TELL = /(comb\. form|prefix|suffix|\bvar\.\b|poet'?s|old French|Latin for|archaic|Roman)/i;
const MODERN_TELL = /(rapper|hip-hop|meme|app|website|texter'?s|slangily|informally|"[^"]+")/i;
function registerFor(text) {
  if (CLASSIC_TELL.test(text)) return 'classic';
  if (MODERN_TELL.test(text)) return 'modern';
  return undefined;
}

// ---- craft rating: reward misdirection / surface / specificity ------------
const CROSSWORDESE_META = /(comb\. form|:?\s*prefix\b|:?\s*suffix\b|\bvar\.\b|\babbr\.?\b)/i;
const CROSSREF = /(\b\d+[- ]?(across|down)\b|\bsee \d|\bwith \d)/i;
// Puzzle-specific / editorial clues that make no sense out of their grid.
const META = /(\[.*\]|\bthis (puzzle|grid|clue|answer)\b|\b(circled|shaded|starred|highlighted|asterisked)\b|\bsee (note|below|above)\b|\bhint\b|\btheme\b)/i;
function rate(text, corpusDiff) {
  // Hard rejects.
  if (CROSSREF.test(text)) return null;            // unresolvable out of its grid
  if (META.test(text)) return null;                 // references its original puzzle
  if (/[^\x20-\x7E]/.test(text)) return null;       // non-ASCII oddities
  const words = text.split(/\s+/).filter(Boolean);
  let craft = 40;
  if (/\?\s*$/.test(text)) craft += 25;             // pun / misdirection
  if (/["“”]/.test(text)) craft += 12;              // spoken / colloquial
  if (/\b(e\.g\.|for one|say|perhaps|maybe|in a way|of sorts)\b/i.test(text)) craft += 10;
  if (/_{2,}|_\b|\b_/.test(text)) craft += 9;        // fill-in-the-blank — friendly + lively
  if (/^(It|They|What|Where|When|Kind of|Sort of|One who|Place)\b/.test(text)) craft += 7; // riddle-ish opener
  if (words.length >= 3) craft += 8;
  if (words.length >= 5) craft += 6;
  if (/\b[A-Z][a-z]{2,}/.test(text.replace(/^\W*/, ''))) craft += 5; // a proper-noun anchor
  if (words.length === 1) craft -= 10;              // flat synonym
  if (words.length === 2 && !/[?"“”_]/.test(text) && !/\b[A-Z][a-z]/.test(text.slice(1)))
    craft -= 6;                                     // two-word dictionary synonym ("Hive product")
  if (CROSSWORDESE_META.test(text)) craft -= 16;    // OREO "Comb. form" etc.
  if (text.length > 90) craft -= 8;
  const stars = Math.max(1, Math.min(5, Math.round(craft / 20)));
  // Difficulty: trust NYT's own day-of-week signal (corpusDiff), then correct
  // for the two shapes it washes out on. A plain, short synonym with no proper
  // noun / number / pun is a Monday gimme however the average landed; a pun or
  // a high-craft misdirect is never a Monday gimme.
  let diff = corpusDiff || 3;
  const plainEasy =
    words.length <= 2 &&
    !/[?"“”]/.test(text) &&
    !/\d/.test(text) &&
    !/[A-Z][A-Z]|(?<=\w)[A-Z]/.test(text.replace(/^\W+/, '').slice(1)); // no interior caps (proper noun)
  if (plainEasy) diff = Math.min(diff, 2);
  if (/\?\s*$/.test(text)) diff = Math.max(diff, 3);
  if (stars >= 4) diff = Math.max(diff, 3);
  diff = Math.max(1, Math.min(5, diff));
  return { craft, stars, diff };
}

const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Turn a corpus record into a selected, tiered, validated clue set. */
function buildClues(answer, rec) {
  const rated = [];
  const seenText = new Set();
  for (const c of rec.clues) {
    const text = c.text.trim();
    if (text.length < 3 || text.length > 120) continue;
    if (leaks(answer, text)) continue;
    const key = norm(text);
    if (!key || seenText.has(key)) continue;
    const r = rate(text, c.diff);
    if (!r) continue;
    seenText.add(key);
    rated.push({ text, ...r, register: registerFor(text), category: categoryFor(text), count: c.count });
  }
  if (rated.length === 0) return null;
  rated.sort((a, b) => b.craft - a.craft || b.count - a.count);
  const chosen = [];
  // Guarantee a Monday-easy floor so easy days always have a gimme to pick,
  // even for an answer whose flashiest clues are all hard.
  const easy = rated.filter((c) => c.diff <= 2)[0]; // already craft-sorted
  if (easy) chosen.push(easy);
  // Then fill with the highest-craft distinct clues.
  for (const c of rated) {
    if (chosen.length >= MAX_CLUES) break;
    if (!chosen.includes(c)) chosen.push(c);
  }
  const tiers = new Set(chosen.map((c) => c.diff));
  // Entries 4+ letters need ≥2 difficulty tiers — nudge the weakest if flat.
  if (answer.length >= 4 && tiers.size < 2 && chosen.length >= 2) {
    const weakest = chosen[chosen.length - 1];
    weakest.diff = weakest.diff <= 2 ? weakest.diff + 1 : weakest.diff - 1;
  }
  // A len-4+ entry that still can't reach 2 tiers with one clue is unusable
  // as a curated entry (validator would reject); drop it.
  const finalTiers = new Set(chosen.map((c) => c.diff));
  if (answer.length >= 4 && finalTiers.size < 2) return null;
  return chosen;
}

// ---- fill-quality score for the emitted entry -----------------------------
function scoreFor(answer, n) {
  if (fillScore.has(answer)) return Math.max(55, Math.min(78, 55 + Math.round(Math.log2(n) * 3)));
  return Math.max(55, Math.min(78, 55 + Math.round(Math.log2(n) * 3)));
}

// ---- build entries --------------------------------------------------------
const entries = [];
let scanned = 0, skippedExisting = 0, skippedRare = 0, skippedUnplaceable = 0, noClue = 0;
for (const [answer, rec] of Object.entries(idx)) {
  scanned++;
  if (existing.has(answer)) { skippedExisting++; continue; }
  if (rec.n < MIN_N) { skippedRare++; continue; }
  if (!placeable(answer)) { skippedUnplaceable++; continue; }
  const clues = buildClues(answer, rec);
  if (!clues) { noClue++; continue; }
  // Dominant category across chosen clues.
  const catCount = {};
  for (const c of clues) catCount[c.category] = (catCount[c.category] || 0) + 1;
  const category = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0][0];
  entries.push({
    answer,
    score: scoreFor(answer, rec.n),
    categories: [category],
    tags: ['sourced'],
    clues: clues.map((c) => ({
      text: c.text,
      difficulty: c.diff,
      stars: c.stars,
      ...(c.register ? { register: c.register } : {}),
    })),
  });
}

entries.sort((a, b) => a.answer.localeCompare(b.answer));

// ---- write sharded output -------------------------------------------------
const outDir = join(ROOT, 'src/data/wordbank/authored');
if (existsSync(outDir)) for (const f of readdirSync(outDir)) rmSync(join(outDir, f));
mkdirSync(outDir, { recursive: true });
const shards = Array.from({ length: SHARDS }, () => []);
entries.forEach((e, i) => shards[i % SHARDS].push(e));
shards.forEach((s, i) => {
  // Generated data — compact JSON keeps the lazy chunk small.
  writeFileSync(join(outDir, `nyt-${String(i + 1).padStart(2, '0')}.json`), JSON.stringify(s));
});

const clueTotal = entries.reduce((a, e) => a + e.clues.length, 0);
console.log(
  `Authored ${entries.length.toLocaleString()} answers, ${clueTotal.toLocaleString()} clues ` +
  `(~${(clueTotal / entries.length).toFixed(1)}/answer) → src/data/wordbank/authored/ (${SHARDS} shards)\n` +
  `scanned ${scanned.toLocaleString()} | skipped: ${skippedExisting} existing, ${skippedRare} rare (n<${MIN_N}), ` +
  `${skippedUnplaceable} unplaceable, ${noClue} no clean clue`,
);
