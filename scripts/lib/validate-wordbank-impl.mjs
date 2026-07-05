// Wordbank checks: entry shape, clue quality rules, cross-file duplicate
// answers, per-length distribution minimums, and letter-frequency sanity.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CATEGORIES = new Set([
  'geography', 'entertainment', 'history', 'arts-literature',
  'science-nature', 'sports-leisure', 'wordplay',
]);

// Per-length minimum entry counts for a healthy fill (final targets; the
// seed pass gates at the scaled-down MINIMA_SEED until the bank matures).
const MINIMA = { 3: 260, 4: 340, 5: 330, 6: 200, 7: 150, 8: 60, 9: 30 };
const MINIMA_SEED = { 3: 90, 4: 110, 5: 100, 6: 55, 7: 40, 8: 15, 9: 8 };

// English letter frequency (rough), used to flag rare-letter overload that
// silently kills fill success.
const COMMON = new Set(['E', 'A', 'R', 'I', 'O', 'T', 'N', 'S', 'L', 'C']);

function stems(word) {
  const out = new Set([word]);
  if (word.endsWith('S')) out.add(word.slice(0, -1));
  if (word.endsWith('ES')) out.add(word.slice(0, -2));
  if (word.endsWith('ED')) out.add(word.slice(0, -2));
  if (word.endsWith('ING')) out.add(word.slice(0, -3));
  return out;
}

function clueLeaksAnswer(answer, clueText) {
  const words = clueText.toUpperCase().replace(/[^A-Z]/g, ' ').split(/\s+/).filter(Boolean);
  const targetStems = stems(answer.toUpperCase());
  if (answer.length < 3) return words.includes(answer.toUpperCase());
  return words.some((w) => {
    if (w.length < 3) return false;
    for (const ws of stems(w)) if (targetStems.has(ws)) return true;
    return false;
  });
}

export function validateWordbank(dir, { seedPass = process.env.WORDBANK_SEED === '1' } = {}) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  let errors = 0;
  let clueCount = 0;
  const byLen = new Map();
  const seen = new Map(); // answer -> file (dupes across files are errors)

  const fail = (where, msg) => {
    console.error(`  ✗ ${where}: ${msg}`);
    errors++;
  };

  for (const file of files) {
    let entries;
    try {
      entries = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    } catch (e) {
      fail(file, `bad JSON: ${e.message}`);
      continue;
    }
    if (!Array.isArray(entries)) { fail(file, 'expected a JSON array'); continue; }

    for (const e of entries) {
      const where = `${file}:${e.answer ?? '?'}`;
      if (typeof e.answer !== 'string' || !/^[A-Z]{2,15}$/.test(e.answer)) {
        fail(where, `answer must be 2–15 chars A–Z, got "${e.answer}"`);
        continue;
      }
      const prev = seen.get(e.answer);
      if (prev) fail(where, `duplicate answer (also in ${prev})`);
      seen.set(e.answer, file);
      byLen.set(e.answer.length, (byLen.get(e.answer.length) ?? 0) + 1);

      if (!Number.isInteger(e.score) || e.score < 1 || e.score > 100) fail(where, `score must be 1–100`);
      if (!Array.isArray(e.categories) || e.categories.length === 0) {
        fail(where, 'needs ≥1 category');
      } else {
        for (const c of e.categories) if (!CATEGORIES.has(c)) fail(where, `unknown category "${c}"`);
      }
      if (!Array.isArray(e.tags)) fail(where, 'tags must be an array');

      if (!Array.isArray(e.clues) || e.clues.length === 0) {
        fail(where, 'needs ≥1 clue');
        continue;
      }
      const difficulties = new Set();
      for (const c of e.clues) {
        clueCount++;
        if (typeof c.text !== 'string' || c.text.trim().length < 3) fail(where, 'clue text too short');
        else if (clueLeaksAnswer(e.answer, c.text)) fail(where, `clue leaks answer: "${c.text}"`);
        if (!Number.isInteger(c.difficulty) || c.difficulty < 1 || c.difficulty > 5) {
          fail(where, 'clue difficulty must be 1–5');
        } else difficulties.add(c.difficulty);
        if (!Number.isInteger(c.stars) || c.stars < 1 || c.stars > 5) fail(where, 'clue stars must be 1–5');
      }
      // Entries 4+ letters need at least two difficulty tiers so the weekday
      // knobs have something to select between.
      if (e.answer.length >= 4 && difficulties.size < 2) {
        fail(where, `needs clues at ≥2 difficulty tiers (has ${[...difficulties].join(',') || 'none'})`);
      }
    }
  }

  // Distribution + letter sanity per length bucket. WORDBANK_NO_MINIMA=1
  // skips count minima (used when validating a single bucket file).
  if (process.env.WORDBANK_NO_MINIMA !== '1') {
    const minima = seedPass ? MINIMA_SEED : MINIMA;
    for (const [len, min] of Object.entries(minima)) {
      const have = byLen.get(Number(len)) ?? 0;
      if (have < min) fail(`len${len}`, `only ${have} entries (< ${min}${seedPass ? ' seed-pass minimum' : ''})`);
    }
  }
  for (const [len, count] of [...byLen.entries()].sort((a, b) => a[0] - b[0])) {
    if (count < 8) continue; // tiny buckets aren't statistically meaningful
    let commonLetters = 0;
    let total = 0;
    for (const [answer] of [...seen.entries()].filter(([a]) => a.length === len)) {
      for (const ch of answer) {
        total++;
        if (COMMON.has(ch)) commonLetters++;
      }
    }
    const ratio = commonLetters / total;
    if (ratio < 0.55) {
      fail(`len${len}`, `common-letter ratio ${(ratio * 100).toFixed(0)}% < 55% — fill rates will suffer`);
    }
  }

  if (errors > 0) {
    console.error(`validate-wordbank: ${errors} error(s)`);
    return 1;
  }
  console.log(
    `validate-wordbank: OK (${seen.size} entries, ${clueCount} clues${seedPass ? ', seed-pass minima' : ''})`,
  );
  return 0;
}
