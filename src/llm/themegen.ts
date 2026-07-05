/** LLM-assisted free-text theme generation: ask the configured provider for
 * themed entries + original clever clues, validate hard, build the grid
 * locally, and clue non-theme fill from the bank. One repair round; callers
 * fall back to the local fuzzy engine on failure. */

import type { Category, Clue, Puzzle } from '../core/types.ts';
import { CATEGORIES } from '../core/types.ts';
import { generatePuzzle } from '../core/generator/puzzle-gen.ts';
import { mainBank, templatesBySize } from '../data/loader.ts';
import { themeTitle } from '../app/puzzles.ts';
import { getSettings } from '../storage/settings.ts';
import { complete } from './provider.ts';

export interface ThemeEntryProposal {
  answer: string;
  clue: string;
  category: Category;
  stars: number;
}

const SYSTEM_PROMPT = `You are a veteran crossword constructor writing ORIGINAL entries and clues for a custom themed puzzle. Never reproduce clues from published crosswords. Answer with STRICT JSON only — no prose, no markdown fences.`;

function userPrompt(theme: string, repair?: { failedLengths: number[] }): string {
  const repairNote = repair
    ? `\nPrevious attempt failed to fit. AVOID lengths ${repair.failedLengths.join(', ')}; prefer 4-8 letter answers this time.`
    : '';
  return `Theme: "${theme}"

Propose 16-22 crossword entries that evoke this theme, mixing lengths 4-12 (mostly 4-8). For each: the answer in UPPERCASE A-Z only (no spaces, hyphens, or accents — concatenate multiword phrases), one clever, fair, family-friendly clue you invent yourself (misdirection welcome, obscurity not), a category from exactly this list: ${CATEGORIES.join(', ')}, and stars 1-5 rating the clue's craft.${repairNote}

JSON shape: {"entries":[{"answer":"...","clue":"...","category":"...","stars":3}]}`;
}

/** Hard validation: shape, charset, lengths, dedupe, no answer-in-clue. */
export function validateProposals(raw: unknown): ThemeEntryProposal[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const entries = (raw as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return [];
  const out: ThemeEntryProposal[] = [];
  const seen = new Set<string>();
  for (const item of entries) {
    if (typeof item !== 'object' || item === null) continue;
    const e = item as Record<string, unknown>;
    const answer = typeof e.answer === 'string' ? e.answer.toUpperCase().replace(/[^A-Z]/g, '') : '';
    const clue = typeof e.clue === 'string' ? e.clue.trim() : '';
    const category = CATEGORIES.includes(e.category as Category) ? (e.category as Category) : 'wordplay';
    const stars = Math.min(5, Math.max(1, Math.round(Number(e.stars) || 3)));
    if (answer.length < 3 || answer.length > 15) continue;
    if (clue.length < 4 || clue.length > 160) continue;
    if (clue.toUpperCase().includes(answer)) continue;
    if (seen.has(answer)) continue;
    seen.add(answer);
    out.push({ answer, clue, category, stars });
  }
  return out;
}

async function requestProposals(theme: string, repair?: { failedLengths: number[] }): Promise<ThemeEntryProposal[]> {
  const cfg = getSettings().llm;
  if (!cfg?.apiKey) throw new Error('No AI key configured');
  const text = await complete(
    { system: SYSTEM_PROMPT, user: userPrompt(theme, repair), json: true, maxTokens: 2000 },
    cfg,
  );
  // Tolerate accidental fences or leading prose around the JSON object.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Provider returned no JSON');
  return validateProposals(JSON.parse(match[0]));
}

export async function generateThemedViaLlm(
  theme: string,
  opts: { size: number; difficulty: number; seed: string },
): Promise<Puzzle> {
  let proposals = await requestProposals(theme);
  if (proposals.length < 4) throw new Error('Too few usable theme entries from the provider');

  const attempt = (list: ThemeEntryProposal[]): Puzzle | null => {
    const usable = list
      .filter((p) => p.answer.length <= opts.size)
      .sort((a, b) => b.answer.length - a.answer.length);
    const seedCount = opts.size >= 11 ? 4 : 2;
    const seeds = usable.slice(0, seedCount).map((p) => p.answer);
    if (seeds.length === 0) return null;

    const overrides = new Map<string, { text: string; stars: Clue['stars']; category: Category }>();
    for (const p of usable) {
      overrides.set(p.answer, { text: p.clue, stars: p.stars as Clue['stars'], category: p.category });
    }

    const puzzle = generatePuzzle({
      id: `gen-themed-${opts.seed}`,
      kind: 'themed',
      title: themeTitle(theme),
      difficulty: opts.difficulty,
      templates: templatesBySize(opts.size, 5),
      seedKey: `themed-llm|${theme}|${opts.seed}`,
      theme: { name: theme, entries: seeds },
      restarts: 5,
    }, mainBank());
    if (!puzzle) return null;

    // Apply LLM clues wherever its entries actually landed in the grid.
    for (const dir of ['across', 'down'] as const) {
      for (const clue of puzzle.clues[dir]) {
        const override = overrides.get(clue.answer);
        if (override) {
          clue.clue = override.text;
          clue.stars = override.stars;
          clue.category = override.category;
        }
      }
    }
    return puzzle;
  };

  let puzzle = attempt(proposals);
  if (!puzzle) {
    // One repair round: ask for shorter entries, then retry.
    const failedLengths = [...new Set(proposals.map((p) => p.answer.length).filter((l) => l > 8))];
    proposals = await requestProposals(theme, { failedLengths });
    puzzle = attempt(proposals);
  }
  if (!puzzle) throw new Error('Could not construct a grid around the AI theme entries');
  return puzzle;
}
