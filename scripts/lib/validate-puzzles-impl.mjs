// Hand-authored puzzle library gate. Reuses the runtime validator so the
// same rules apply everywhere, then adds library-level checks (unique ids,
// date/difficulty consistency with the weekday convention).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validatePuzzle } from '../../src/core/validate/validator.ts';

function* jsonFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* jsonFiles(p);
    else if (name.endsWith('.json')) yield p;
  }
}

export function validatePuzzles(dir) {
  let errors = 0;
  let count = 0;
  const seenIds = new Set();

  const fail = (where, msg) => {
    console.error(`  ✗ ${where}: ${msg}`);
    errors++;
  };

  for (const file of jsonFiles(dir)) {
    let puzzles;
    try {
      puzzles = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      fail(file, `bad JSON: ${e.message}`);
      continue;
    }
    if (!Array.isArray(puzzles)) puzzles = [puzzles];

    for (const puzzle of puzzles) {
      count++;
      const where = `${file.split('/').slice(-2).join('/')}:${puzzle.id ?? '?'}`;
      if (!puzzle.id) { fail(where, 'missing id'); continue; }
      if (seenIds.has(puzzle.id)) fail(where, 'duplicate puzzle id');
      seenIds.add(puzzle.id);

      // Kids minis may have unchecked cells (friendlier shapes); everything
      // else follows standard construction rules.
      const relaxed = puzzle.kind === 'kids';
      const problems = validatePuzzle(puzzle, {
        symmetry: !relaxed,
        fullyChecked: !relaxed,
        minLen: 3,
      });
      for (const p of problems) {
        if (p.level === 'error') fail(where, `[${p.where}] ${p.message}`);
        else console.warn(`  ⚠ ${where}: [${p.where}] ${p.message}`);
      }

      // Library convention: weekday puzzles carry a difficulty matching the
      // Mon(1)…Sun(7) scale.
      if (puzzle.kind === 'daily' || puzzle.kind === 'mini') {
        if (!Number.isInteger(puzzle.weekday) || puzzle.weekday < 1 || puzzle.weekday > 7) {
          fail(where, `library ${puzzle.kind} needs weekday 1–7, got ${puzzle.weekday}`);
        }
      }
    }
  }

  if (errors > 0) {
    console.error(`validate-puzzles: ${errors} error(s) across ${count} puzzle(s)`);
    return 1;
  }
  console.log(`validate-puzzles: OK (${count} puzzles)`);
  return 0;
}
