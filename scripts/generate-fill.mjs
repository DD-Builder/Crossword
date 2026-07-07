#!/usr/bin/env node
// Offline fill generator — the authoring tool behind the hand-made daily
// library, and the fill-smoke health check for the wordbank.
//
//   node scripts/generate-fill.mjs --size 15 [--template t15-a] [--seed 3]
//       [--theme-entries FOO,BAR] [--score-floor 40] [--json]
//   node scripts/generate-fill.mjs --smoke [--seeds 50]
import { parseArgs } from 'node:util';
import { fill } from '../src/core/generator/filler.ts';
import { buildIndex } from '../src/core/generator/index.ts';
import { deriveSlots, slotAnswer, templateToGrid } from '../src/core/grid.ts';
import { rngFrom } from '../src/core/rng.ts';
import { loadBankEntries, loadFillWordlist, loadTemplates } from './lib/bank-node.mjs';

const { values: args } = parseArgs({
  options: {
    size: { type: 'string' },
    template: { type: 'string' },
    seed: { type: 'string', default: '1' },
    'theme-entries': { type: 'string' },
    'score-floor': { type: 'string' },
    json: { type: 'boolean', default: false },
    smoke: { type: 'boolean', default: false },
    seeds: { type: 'string', default: '50' },
    // Curated bank only (measure the bank in isolation). Default includes the
    // large MIT fill wordlist — the production reality for daily authoring.
    'no-fill-list': { type: 'boolean', default: false },
  },
});

const fillList = args['no-fill-list'] ? [] : loadFillWordlist();
const bank = buildIndex([...loadBankEntries(), ...fillList]);
const templates = loadTemplates();

function runOne(template, seedKey, opts = {}) {
  const grid = templateToGrid(template.size, template.blocks);
  const started = performance.now();
  const result = fill(grid, bank, rngFrom(seedKey), {
    maxSteps: 120_000,
    ...opts,
  });
  return { result, ms: performance.now() - started };
}

if (args.smoke) {
  // Success-rate targets per (size, lattice) family — the true wordbank
  // health metric. Families gate separately: mixing American + lattice
  // templates in one number would let the always-fillable lattice hide an
  // American 0%. With the large MIT fill wordlist loaded (the production
  // reality — see data/fill-wordlist/), fully-checked American grids fill
  // reliably at every size, so the lattice grids are retired for dailies.
  // Run with --no-fill-list to measure the curated bank in isolation.
  const targets = {
    am5: 1.0, am7: 1.0, am11: 0.95, am13: 0.95, am15: 0.95,
    lat9: 1.0, lat11: 1.0, lat13: 1.0, lat15: 1.0,
  };
  const seedCount = Number(args.seeds);
  let failed = false;
  const report = [];

  for (const family of Object.keys(targets)) {
    const lattice = family.startsWith('lat');
    const size = Number(family.replace(/^\D+/, ''));
    // Themed templates need seeded long entries — not part of the raw smoke.
    const sized = templates.filter(
      (t) => t.size === size && !t.themeSlotMin && Boolean(t.lattice) === lattice,
    );
    if (sized.length === 0) continue;
    let ok = 0;
    let totalMs = 0;
    let maxMs = 0;
    for (let i = 0; i < seedCount; i++) {
      // Mirror production: restart ladder with rising jitter/beam across
      // the family's templates until one lands; curated entries outrank
      // the fill tier just like the runtime path.
      let ms = 0;
      let landed = false;
      for (let attempt = 0; attempt < 5 && !landed; attempt++) {
        const template = sized[(i + attempt) % sized.length];
        const out = runOne(template, `smoke|${family}|${i}|r${attempt}`, {
          beamWidth: 24 + attempt * 20,
          jitter: 0.25 + attempt * 0.12,
          tagWeights: { fill: 0.6 },
        });
        ms += out.ms;
        landed = out.result.ok;
      }
      totalMs += ms;
      maxMs = Math.max(maxMs, ms);
      if (landed) ok++;
    }
    const rate = ok / seedCount;
    const target = targets[family];
    const status = rate >= target ? 'OK  ' : 'FAIL';
    report.push({ family, size, lattice, rate, target, avgMs: totalMs / seedCount, maxMs });
    if (!args.json) {
      console.log(
        `${status} ${family.padEnd(5)} ${String(size).padStart(2)}x${size}: ${(rate * 100).toFixed(0)}% ` +
        `(target ${(target * 100).toFixed(0)}%)  avg ${(totalMs / seedCount).toFixed(0)}ms  max ${maxMs.toFixed(0)}ms`,
      );
    }
    if (rate < target) failed = true;
  }
  if (args.json) {
    const byLen = {};
    for (const e of loadBankEntries()) byLen[e.answer.length] = (byLen[e.answer.length] ?? 0) + 1;
    console.log(JSON.stringify({ seeds: seedCount, bankByLen: byLen, families: report }, null, 1));
  }
  process.exit(failed ? 1 : 0);
}

// --- Single fill -----------------------------------------------------------
const size = Number(args.size ?? 15);
const pool = templates.filter((t) => (args.template ? t.id === args.template : t.size === size));
if (pool.length === 0) {
  console.error(`No template matches size=${size} template=${args.template ?? '*'}`);
  process.exit(1);
}

const seedEntries = args['theme-entries']
  ? args['theme-entries'].split(',').map((s) => s.trim().toUpperCase())
  : undefined;

for (const template of pool) {
  const { result, ms } = runOne(template, `gen|${template.id}|${args.seed}`, {
    ...(seedEntries ? { seedEntries } : {}),
    ...(args['score-floor'] ? { scoreFloor: Number(args['score-floor']) } : {}),
  });
  if (!result.ok) {
    console.error(`✗ ${template.id}: ${result.reason} after ${result.steps} steps (${ms.toFixed(0)}ms)`);
    continue;
  }
  if (args.json) {
    const info = deriveSlots(result.grid, 3);
    console.log(JSON.stringify({
      template: template.id,
      seed: args.seed,
      grid: result.grid,
      answers: info.slots.map((s) => ({ id: s.id, answer: slotAnswer(result.grid, s) })),
    }, null, 2));
  } else {
    console.log(`✓ ${template.id} seed=${args.seed} steps=${result.steps} ${ms.toFixed(0)}ms`);
    for (const row of result.grid) console.log('  ' + row.split('').join(' '));
    const scores = [...result.placed.values()].map((e) => e.score);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    console.log(`  avg fill score: ${avg.toFixed(1)}`);
  }
}
