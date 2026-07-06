#!/usr/bin/env node
// Authoring aid: expand a top-half ASCII pattern (rows 0..floor(size/2)),
// '#'=block '.'=white, into a full 180°-symmetric grid, then validate and
// print the block list ready to paste into a template JSON.
//   node scripts/mirror-template.mjs '....#.....#....' '....#.....#....' ...
import {
  templateToGrid, isSymmetric, isConnected, isFullyChecked, deriveSlots,
} from '../src/core/grid.ts';

const half = process.argv.slice(2);
const size = half[0].length;
const mid = Math.floor(size / 2);
if (half.length !== mid + 1) {
  console.error(`Need ${mid + 1} rows for size ${size}, got ${half.length}`);
  process.exit(1);
}

const rows = [...half];
for (let r = mid + 1; r < size; r++) {
  const src = rows[size - 1 - r];
  rows.push([...src].reverse().join(''));
}
// Middle row must be self-symmetric; enforce by mirroring its left half.
{
  const m = [...rows[mid]];
  for (let c = 0; c < size; c++) if (m[c] === '#') m[size - 1 - c] = '#';
  rows[mid] = m.join('');
}

const blocks = [];
rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') blocks.push([r, c]); }));

const grid = templateToGrid(size, blocks);
for (const row of grid) console.log(row.replaceAll('.', '·').split('').join(' '));
console.log(`blocks=${blocks.length} symmetric=${isSymmetric(grid)} connected=${isConnected(grid)} fullyChecked=${isFullyChecked(grid, 3)}`);
const { slots } = deriveSlots(grid, 3);
const hist = {};
for (const s of slots) hist[s.cells.length] = (hist[s.cells.length] ?? 0) + 1;
console.log(`words=${slots.length} lengths=${JSON.stringify(hist)}`);
console.log(JSON.stringify(blocks));
