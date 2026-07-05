#!/usr/bin/env node
// Authoring aid: render a template's grid and slot profile.
//   node scripts/inspect-template.mjs '<json blocks>' <size>
//   node scripts/inspect-template.mjs --file src/data/templates/t15.json
import { readFileSync } from 'node:fs';
import {
  templateToGrid, isSymmetric, isConnected, isFullyChecked, deriveSlots,
} from '../src/core/grid.ts';

function report(id, size, blocks) {
  const grid = templateToGrid(size, blocks);
  console.log(`\n=== ${id} (${size}x${size}, ${blocks.length} blocks) ===`);
  for (const row of grid) console.log('  ' + row.replaceAll('.', '·').split('').join(' '));
  console.log(`  symmetric=${isSymmetric(grid)} connected=${isConnected(grid)} fullyChecked=${isFullyChecked(grid, 3)}`);
  const { slots } = deriveSlots(grid, 3);
  const hist = {};
  for (const s of slots) hist[s.cells.length] = (hist[s.cells.length] ?? 0) + 1;
  console.log(`  words=${slots.length} lengths=${JSON.stringify(hist)}`);
}

const args = process.argv.slice(2);
if (args[0] === '--file') {
  const templates = JSON.parse(readFileSync(args[1], 'utf8'));
  for (const t of templates) report(t.id, t.size, t.blocks);
} else {
  report('adhoc', Number(args[1] ?? 15), JSON.parse(args[0]));
}
