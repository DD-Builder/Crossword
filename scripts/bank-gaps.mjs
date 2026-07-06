#!/usr/bin/env node
// Wordbank gap analysis — the per-wave briefing tool for fill-tier authoring.
//
//   node scripts/bank-gaps.mjs                     # bucket counts vs targets + letter profile
//   node scripts/bank-gaps.mjs --dead --size 15 --runs 12   # harvest dead-end patterns
//   node scripts/bank-gaps.mjs --candidates        # morphological variant worklist (review, don't auto-add)
import { parseArgs } from 'node:util';
import { fill } from '../src/core/generator/filler.ts';
import { buildIndex } from '../src/core/generator/index.ts';
import { templateToGrid } from '../src/core/grid.ts';
import { rngFrom } from '../src/core/rng.ts';
import { loadBankEntries, loadTemplates } from './lib/bank-node.mjs';

const { values: args } = parseArgs({
  options: {
    dead: { type: 'boolean', default: false },
    candidates: { type: 'boolean', default: false },
    size: { type: 'string', default: '15' },
    runs: { type: 'string', default: '12' },
  },
});

const entries = loadBankEntries();
const answers = new Set(entries.map((e) => e.answer));

// Growth targets that unlock fully-checked American 15×15 (see plan/fill curve).
const TARGETS = { 3: 550, 4: 1900, 5: 1900, 6: 1300, 7: 900, 8: 700 };
const COMMON = new Set(['E', 'A', 'R', 'I', 'O', 'T', 'N', 'S', 'L', 'C']);

if (args.candidates) {
  // Morphological variants of curated answers not yet in the bank. A worklist
  // for authoring agents — every emitted word still needs a human-quality
  // check (is it a real, familiar word?) and an original clue.
  const out = new Map(); // variant -> source
  const add = (variant, source) => {
    if (variant.length < 3 || variant.length > 8) return;
    if (!/^[A-Z]+$/.test(variant) || answers.has(variant) || out.has(variant)) return;
    out.set(variant, source);
  };
  for (const e of entries) {
    const a = e.answer;
    if (e.tags?.includes('fill') || a.length < 3) continue;
    if (!a.endsWith('S')) add(a.endsWith('X') || a.endsWith('CH') || a.endsWith('SH') ? `${a}ES` : `${a}S`, a);
    if (!a.endsWith('E')) { add(`${a}ED`, a); add(`${a}ING`, a); add(`${a}ER`, a); }
    else { add(`${a}D`, a); add(`${a.slice(0, -1)}ING`, a); add(`${a}R`, a); }
    add(`RE${a}`, a);
    add(`UN${a}`, a);
  }
  const byLen = new Map();
  for (const [v, src] of out) {
    if (!byLen.has(v.length)) byLen.set(v.length, []);
    byLen.get(v.length).push(`${v} (from ${src})`);
  }
  for (const [len, list] of [...byLen.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`\n## len ${len} — ${list.length} candidates`);
    console.log(list.join('\n'));
  }
  process.exit(0);
}

if (args.dead) {
  // Run American fills at --size with trace on; tally the patterns the
  // filler died on. The most frequent patterns per length are exactly the
  // letter shapes the next authoring wave should cover.
  const size = Number(args.size);
  const runs = Number(args.runs);
  const templates = loadTemplates().filter(
    (t) => t.size === size && !t.lattice && !t.themeSlotMin,
  );
  if (templates.length === 0) {
    console.error(`no American templates at size ${size}`);
    process.exit(1);
  }
  const bank = buildIndex(entries);
  const tally = new Map(); // pattern -> count
  for (let i = 0; i < runs; i++) {
    const template = templates[i % templates.length];
    fill(templateToGrid(template.size, template.blocks), bank, rngFrom(`gaps|${size}|${i}`), {
      maxSteps: 120_000,
      beamWidth: 44,
      jitter: 0.35,
      tagWeights: { fill: 0.6 },
      trace: (msg) => {
        const m = msg.match(/^dead: \S+ pattern=(\S+)/);
        if (m) tally.set(m[1], (tally.get(m[1]) ?? 0) + 1);
      },
    });
  }
  const byLen = new Map();
  for (const [pattern, count] of tally) {
    if (!byLen.has(pattern.length)) byLen.set(pattern.length, []);
    byLen.get(pattern.length).push({ pattern, count });
  }
  for (const [len, list] of [...byLen.entries()].sort((a, b) => a[0] - b[0])) {
    list.sort((a, b) => b.count - a.count);
    console.log(`\n## len ${len} — top dead-end patterns (${runs} runs, size ${size})`);
    for (const { pattern, count } of list.slice(0, 30)) {
      console.log(`  ${pattern}  ×${count}`);
    }
  }
  process.exit(0);
}

// Default report: bucket counts vs targets, plus per-position letter profile
// for the workhorse lengths (what letters the next wave should favor).
console.log('## Bucket counts vs American-15 targets');
const byLen = new Map();
for (const e of entries) byLen.set(e.answer.length, (byLen.get(e.answer.length) ?? 0) + 1);
for (const [len, target] of Object.entries(TARGETS)) {
  const have = byLen.get(Number(len)) ?? 0;
  const gap = Math.max(0, target - have);
  console.log(`  len ${len}: ${String(have).padStart(4)} / ${target}  ${gap > 0 ? `→ need ${gap}` : '✓'}`);
}

console.log('\n## Common-letter ratio + per-position profile (len 4–7)');
for (const len of [4, 5, 6, 7]) {
  const words = entries.filter((e) => e.answer.length === len).map((e) => e.answer);
  if (words.length === 0) continue;
  let common = 0;
  let total = 0;
  const posCounts = Array.from({ length: len }, () => new Map());
  for (const w of words) {
    for (let p = 0; p < len; p++) {
      const ch = w[p];
      total++;
      if (COMMON.has(ch)) common++;
      posCounts[p].set(ch, (posCounts[p].get(ch) ?? 0) + 1);
    }
  }
  const tops = posCounts.map((m) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([ch]) => ch).join(''),
  );
  const sFinal = words.filter((w) => w.endsWith('S')).length / words.length;
  console.log(
    `  len ${len}: ${words.length} words, common ${(100 * common / total).toFixed(0)}%, ` +
    `S-final ${(100 * sFinal).toFixed(0)}%, top letters by pos: ${tops.join(' | ')}`,
  );
}
