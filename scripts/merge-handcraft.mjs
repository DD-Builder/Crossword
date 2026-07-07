#!/usr/bin/env node
// Integrate hand-crafted clue sets (authored in this project's voice) into the
// bank. Validates every clue against the same leak/charset/tier rules the
// wordbank enforces, then routes each answer:
//   - already in the curated bank  → merge new clues into its existing entry
//   - otherwise                    → emit into src/data/wordbank/handcraft.json
// (author-clues.mjs then skips these answers, so the authored tier never dupes.)
//
//   node scripts/merge-handcraft.mjs <dir-of-batch-json-files>

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const srcDir = process.argv[2];
if (!srcDir) { console.error('usage: merge-handcraft.mjs <dir>'); process.exit(1); }

const CATEGORIES = new Set([
  'geography', 'entertainment', 'history', 'arts-literature',
  'science-nature', 'sports-leisure', 'wordplay',
]);

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
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(n)));
const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, '');

// --- load hand-crafted batches --------------------------------------------
const authored = [];
for (const f of readdirSync(srcDir).filter((f) => f.endsWith('.json'))) {
  authored.push(...JSON.parse(readFileSync(join(srcDir, f), 'utf8')));
}

// --- clean + validate an answer's clue set --------------------------------
function clean(answer, rawClues) {
  const out = [];
  const seen = new Set();
  for (const c of rawClues || []) {
    const text = String(c.text ?? '').trim();
    if (text.length < 3 || text.length > 120) continue;
    if (/[^\x20-\x7E]/.test(text)) continue;
    if (leaks(answer, text)) continue;
    const key = norm(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      text,
      difficulty: clamp(c.difficulty ?? 2, 1, 5),
      stars: clamp(c.stars ?? 2, 1, 5),
      ...(c.register === 'classic' || c.register === 'modern' ? { register: c.register } : {}),
      category: CATEGORIES.has(c.category) ? c.category : 'wordplay',
    });
  }
  if (out.length === 0) return null;
  // Ensure ≥2 difficulty tiers for len-4+ answers.
  const tiers = new Set(out.map((c) => c.difficulty));
  if (answer.length >= 4 && tiers.size < 2) {
    if (out.length < 2) return null;
    out[out.length - 1].difficulty = out[0].difficulty <= 2
      ? out[0].difficulty + 1 : out[0].difficulty - 1;
  }
  return out;
}

// --- existing curated answers → file map (top-level wordbank only) ---------
const curatedDir = join(ROOT, 'src/data/wordbank');
const curatedFiles = readdirSync(curatedDir).filter((f) => f.endsWith('.json'));
const answerFile = new Map();
const fileEntries = new Map();
for (const f of curatedFiles) {
  const entries = JSON.parse(readFileSync(join(curatedDir, f), 'utf8'));
  fileEntries.set(f, entries);
  for (const e of entries) answerFile.set(e.answer, f);
}

// --- route each answer -----------------------------------------------------
const handcraft = [];
const mergedInto = new Map(); // file -> count
let merged = 0, created = 0, skipped = 0;

for (const entry of authored) {
  const answer = String(entry.answer || '').toUpperCase();
  if (!/^[A-Z]{2,15}$/.test(answer)) { skipped++; continue; }
  const clues = clean(answer, entry.clues);
  if (!clues) { skipped++; console.error(`  skip ${answer}: no valid clues`); continue; }

  const file = answerFile.get(answer);
  if (file) {
    // Merge into the existing curated entry, de-duping by clue text.
    const target = fileEntries.get(file).find((e) => e.answer === answer);
    const have = new Set(target.clues.map((c) => norm(c.text)));
    let added = 0;
    for (const c of clues) if (!have.has(norm(c.text))) { target.clues.push(c); have.add(norm(c.text)); added++; }
    if (added) { merged++; mergedInto.set(file, (mergedInto.get(file) || 0) + added); }
  } else {
    const catCount = {};
    for (const c of clues) catCount[c.category] = (catCount[c.category] || 0) + 1;
    const category = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0][0];
    handcraft.push({ answer, score: 64, categories: [category], tags: ['handcraft'], clues });
    created++;
  }
}

// --- write outputs ---------------------------------------------------------
for (const [file, n] of mergedInto) {
  writeFileSync(join(curatedDir, file), JSON.stringify(fileEntries.get(file), null, 1));
  console.log(`  merged ${n} clue(s) into ${file}`);
}
// Accumulate into any existing handcraft.json (so multiple waves compose).
const handcraftPath = join(curatedDir, 'handcraft.json');
const prior = existsSync(handcraftPath) ? JSON.parse(readFileSync(handcraftPath, 'utf8')) : [];
const byAnswer = new Map(prior.map((e) => [e.answer, e]));
for (const e of handcraft) {
  const existing = byAnswer.get(e.answer);
  if (!existing) { byAnswer.set(e.answer, e); continue; }
  const have = new Set(existing.clues.map((c) => norm(c.text)));
  for (const c of e.clues) if (!have.has(norm(c.text))) { existing.clues.push(c); have.add(norm(c.text)); }
}
const combined = [...byAnswer.values()].sort((a, b) => a.answer.localeCompare(b.answer));
writeFileSync(handcraftPath, JSON.stringify(combined, null, 1));
console.log(`  handcraft.json now holds ${combined.length} answers`);

console.log(`\nHand-craft merge: ${created} new → handcraft.json, ${merged} merged into curated, ${skipped} skipped.`);
