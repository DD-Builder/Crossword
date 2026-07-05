#!/usr/bin/env node
// Grid template gate — every template must be symmetric, connected,
// min-slot-length 3, and fully checked. Real checks land with the template
// data; until templates exist this passes trivially.
import { existsSync, readdirSync } from 'node:fs';

const dir = new URL('../src/data/templates', import.meta.url).pathname;
if (!existsSync(dir) || readdirSync(dir).length === 0) {
  console.log('validate-templates: no templates yet — skipping');
  process.exit(0);
}
const { validateTemplates } = await import('./lib/validate-templates-impl.mjs');
process.exit(validateTemplates(dir));
