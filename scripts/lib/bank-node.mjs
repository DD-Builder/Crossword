// Node-side wordbank/template loading for authoring + smoke scripts.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;

export function loadBankEntries({ includeKids = false, includeFill = true } = {}) {
  const dirs = [join(ROOT, 'src/data/wordbank')];
  if (includeFill) dirs.push(join(ROOT, 'src/data/wordbank/fill'));
  if (includeKids) dirs.push(join(ROOT, 'src/data/kids'));
  const entries = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir, { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith('.json')) continue;
      entries.push(...JSON.parse(readFileSync(join(dir, file.name), 'utf8')));
    }
  }
  return entries;
}

export function loadTemplates() {
  const file = join(ROOT, 'src/data/templates/templates.json');
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * The large MIT-licensed fill wordlist (Crossword Nexus collaborative list) as
 * answer-only bank entries — build-time only, never shipped to the browser.
 * Supplies ANSWERS + fill scores so the filler can complete fully-checked
 * American grids; clues are authored separately (never taken from any list).
 *
 * `minScore` is a quality floor on the SOURCE score (0–100): in this list,
 * junk (variant spellings, partials, roll-your-own phrases, EEEEE…) all scores
 * ≤ ~46, genuine clean fill is 60+. Default 60 gives NYT-grade fill and still
 * leaves ~150k answers. Source scores are rescaled into 40–58 so curated
 * entries (mostly 60+) win the candidate sort; the `fill` tag lets callers
 * demote them further via tagWeights. Returns [] if the list isn't present.
 */
export function loadFillWordlist({ minScore = 60 } = {}) {
  const file = join(ROOT, 'data/fill-wordlist/collaborative.dict');
  if (!existsSync(file)) return [];
  const entries = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const i = line.indexOf(';');
    if (i < 0) continue;
    const answer = line.slice(0, i);
    const raw = Number(line.slice(i + 1));
    if (!answer || !(raw >= minScore)) continue;
    // Map source [minScore..100] → [40..58], preserving relative order.
    const score = Math.round(40 + ((raw - minScore) / (100 - minScore)) * 18);
    entries.push({ answer, score, categories: ['wordplay'], tags: ['fill'], clues: [] });
  }
  return entries;
}
