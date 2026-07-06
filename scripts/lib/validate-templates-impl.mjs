// Template checks: JSON shape, 180° symmetry, connectivity, min slot
// length 3, fully-checked cells, and a sane slot-length profile.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  templateToGrid,
  isSymmetric,
  isConnected,
  isFullyChecked,
  deriveSlots,
} from '../../src/core/grid.ts';

export function validateTemplates(dir) {
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  let errors = 0;
  let count = 0;
  const seenIds = new Set();

  for (const file of files) {
    const templates = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    for (const t of templates) {
      count++;
      const where = `${file}:${t.id ?? '?'}`;
      const fail = (msg) => {
        console.error(`  ✗ ${where}: ${msg}`);
        errors++;
      };

      if (!t.id) { fail('missing id'); continue; }
      if (seenIds.has(t.id)) fail(`duplicate id ${t.id}`);
      seenIds.add(t.id);
      if (!Number.isInteger(t.size) || t.size < 3) { fail('bad size'); continue; }
      if (!Array.isArray(t.blocks)) { fail('blocks must be an array'); continue; }
      if (!Number.isInteger(t.openness) || t.openness < 1 || t.openness > 5) fail('openness must be 1–5');

      let grid;
      try {
        grid = templateToGrid(t.size, t.blocks);
      } catch (e) {
        fail(e.message);
        continue;
      }
      if (!isSymmetric(grid)) fail('not 180° symmetric');
      if (!isConnected(grid)) fail('not connected');
      // Lattice (British-style) templates legitimately leave alternate
      // letters unchecked; every cell must still belong to ≥1 slot.
      if (t.lattice) {
        const { slots } = deriveSlots(grid, 3);
        const covered = new Set();
        for (const s of slots) for (const c of s.cells) covered.add(c.row * t.size + c.col);
        for (let r = 0; r < t.size; r++) {
          for (let c = 0; c < t.size; c++) {
            if (grid[r][c] !== '#' && !covered.has(r * t.size + c)) {
              fail(`cell ${r},${c} belongs to no slot`);
            }
          }
        }
      } else if (!isFullyChecked(grid, 3)) {
        fail('not fully checked (or has a slot shorter than 3)');
      }

      const { slots } = deriveSlots(grid, 3);
      const lengths = slots.map((s) => s.cells.length);
      const maxLen = Math.max(...lengths);
      if (maxLen > t.size) fail(`slot longer than grid size?! ${maxLen}`);
      // Fill-tractability guard: non-theme slots beyond 8 letters get scarce
      // in a curated bank. Themed templates declare themeSlotMin; everything
      // longer than 8 must be a designated theme slot.
      if (t.size >= 11) {
        const longSlots = lengths.filter((l) => l > 8).length;
        const declared = t.themeLongSlots ?? 0;
        if (longSlots > declared) {
          fail(`${longSlots} slots >8 letters but themeLongSlots=${declared} — undeclared long fill`);
        }
      }
    }
  }

  if (errors > 0) {
    console.error(`validate-templates: ${errors} error(s) across ${count} template(s)`);
    return 1;
  }
  console.log(`validate-templates: OK (${count} templates)`);
  return 0;
}
