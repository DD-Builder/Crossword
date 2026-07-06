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
