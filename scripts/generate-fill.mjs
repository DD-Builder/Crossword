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
import { loadBankEntries, loadTemplates } from './lib/bank-node.mjs';

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
  },
});

const bank = buildIndex(loadBankEntries());
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
  // Success-rate targets per size — the true wordbank health metric.
  const targets = { 5: 1.0, 7: 1.0, 9: 0.95, 11: 0.95, 13: 0.7, 15: 0.5 };
  const seedCount = Number(args.seeds);
  let failed = false;

  for (const size of [5, 7, 9, 11, 13, 15]) {
    // Themed templates need seeded long entries — not part of the raw smoke.
    const sized = templates.filter((t) => t.size === size && !t.themeSlotMin);
    if (sized.length === 0) continue;
    let ok = 0;
    let totalMs = 0;
    let maxMs = 0;
    for (let i = 0; i < seedCount; i++) {
      const template = sized[i % sized.length];
      const { result, ms } = runOne(template, `smoke|${size}|${i}`);
      totalMs += ms;
      maxMs = Math.max(maxMs, ms);
      if (result.ok) ok++;
    }
    const rate = ok / seedCount;
    const target = targets[size] ?? 0.5;
    const status = rate >= target ? 'OK  ' : 'FAIL';
    console.log(
      `${status} ${String(size).padStart(2)}x${size}: ${(rate * 100).toFixed(0)}% ` +
      `(target ${(target * 100).toFixed(0)}%)  avg ${(totalMs / seedCount).toFixed(0)}ms  max ${maxMs.toFixed(0)}ms`,
    );
    if (rate < target) failed = true;
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
