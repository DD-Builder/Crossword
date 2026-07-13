#!/usr/bin/env node
// Craft-quality auditor: scores every clue in the wordbank against the
// STYLE.md rubric (specific and vivid > flat dictionary definition; "?" earns
// its keep; abbreviations self-identify; not just a bare synonym) and prints
// the weakest N, worst first — a worklist for a future authoring pass.
//
// What this can't do: rank clues by how often real players miss them. This
// app is local-first with no backend or login (see CLAUDE.md), so per-clue
// solve outcomes exist only in each player's own IndexedDB (src/stats/db.ts)
// — there is no cross-player signal to aggregate. The existing adaptive
// system (src/stats/adaptive.ts) already personalizes DIFFICULTY per player
// from their own history; a true "clues players often miss, in general"
// worklist would need opt-in telemetry to a server, a materially different
// project from — and in tension with — this app's no-account design. This
// script's craft score is the honest, buildable proxy: weak-clue detection
// from the text itself, independent of any one player's history.
//
//   node scripts/audit-clue-quality.mjs [--top 50] [--register modern] [--dir wordbank]

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const ROOT = new URL('..', import.meta.url).pathname;
const { values: args } = parseArgs({
  options: {
    top: { type: 'string', default: '50' },
    register: { type: 'string' },
    dir: { type: 'string', default: 'wordbank' },
  },
});
const TOP = Number(args.top);

function loadDir(dir) {
  const out = [];
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, f.name);
    if (f.isDirectory()) out.push(...loadDir(p));
    else if (f.name.endsWith('.json')) {
      for (const e of JSON.parse(readFileSync(p, 'utf8'))) out.push({ ...e, _file: p });
    }
  }
  return out;
}

// Lower score = weaker clue. Mirrors (and generalizes) the kid-clue scorer
// used in scripts/author-kids-glue.mjs, tuned for the grown-up bank's bar.
function craftScore(text, stars) {
  let s = stars * 10; // the author's own craft rating anchors the score
  const bare = /^[A-Z][a-z]+(\s[a-z]+){0,2}$/.test(text) && !/[?!]/.test(text);
  if (bare) s -= 12; // reads like a bare two/three-word dictionary gloss
  if (text.length <= 10) s -= 6; // likely too terse to have any personality
  if (/\b[A-Z]{2,}\b/.test(text) && !/Abbr\.|:.*Abbr/.test(text)) s -= 8; // unsignaled abbreviation
  if (/\?/.test(text)) s += 6; // earns a wink
  if (/["']/.test(text)) s += 3; // a spoken/quoted phrase — usually lively
  if (/\b(e\.g\.|for one|say)\b/i.test(text)) s += 3; // "clue by example" technique
  if (/\d{3,}/.test(text)) s -= 4; // a specific year/stat — trivia-flavored
  return s;
}

const entries = loadDir(join(ROOT, 'src/data', args.dir));
const rows = [];
for (const e of entries) {
  for (const c of e.clues) {
    if (args.register && c.register !== args.register) continue;
    rows.push({ answer: e.answer, text: c.text, stars: c.stars, difficulty: c.difficulty,
      register: c.register ?? 'neutral', file: e._file.replace(ROOT, ''), score: craftScore(c.text, c.stars) });
  }
}
rows.sort((a, b) => a.score - b.score);

console.log(`Scored ${rows.length} clues${args.register ? ` (register=${args.register})` : ''}. Weakest ${TOP}:\n`);
for (const r of rows.slice(0, TOP)) {
  console.log(`  [${r.score.toFixed(0).padStart(4)}] ${r.answer.padEnd(10)} d${r.difficulty} ${r.stars}★ (${r.register}) "${r.text}"  — ${r.file}`);
}
