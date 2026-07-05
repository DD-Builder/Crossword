/** Puzzle resolution: route params → a concrete Puzzle. Dailies come from
 * the hand-authored library (date-keyed rotation); generated puzzles come
 * from the fill engine (worker for big grids, sync for minis). */

import type { RouteCtx } from './router.ts';
import type { GridTemplate, Puzzle } from '../core/types.ts';
import { generatePuzzle } from '../core/generator/puzzle-gen.ts';
import { knobsFor, weekdayOf } from '../core/generator/difficulty.ts';
import { matchTheme } from '../core/generator/themer.ts';
import { fnv1a } from '../core/rng.ts';
import {
  bankEntries, kidsBank, kidsEntries, libraryPuzzles, mainBank, templatesBySize,
} from '../data/loader.ts';
import { adaptiveWeights } from '../stats/adaptive.ts';
import { generateThemedViaLlm } from '../llm/themegen.ts';
import { getSettings } from '../storage/settings.ts';

/** Local date as YYYY-MM-DD (dailies roll at local midnight). */
export function todayIso(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Deterministically select the library puzzle for a date. */
export function dailyFor(dateIso: string, kind: 'daily' | 'mini'): Puzzle | null {
  const weekday = weekdayOf(dateIso);
  const pool = libraryPuzzles()
    .filter((p) => p.kind === kind && p.weekday === weekday)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (pool.length === 0) return null;
  const pick = pool[fnv1a(`${kind}|${dateIso}`) % pool.length]!;
  // Present under a date-specific id so per-date progress/stats stay separate.
  return { ...pick, id: `${kind}-${dateIso}`, date: dateIso };
}

function pickTemplates(size: number, difficulty: number): GridTemplate[] {
  const knobs = knobsFor(difficulty);
  const pool = templatesBySize(size, knobs.maxOpenness);
  return pool.length > 0 ? pool.filter((t) => !t.themeSlotMin) : pool;
}

async function generateAsync(spec: Parameters<typeof generatePuzzle>[0], useKidsBank = false): Promise<Puzzle> {
  // Minis fill in <100ms — run sync. Bigger grids get one macrotask yield
  // so the "constructing…" frame paints; the fill itself is still fast
  // thanks to heavy-block templates. (A worker handle exists for future
  // heavier generation; today's grids don't need it.)
  const size = spec.templates[0]?.size ?? 5;
  if (size > 7) await new Promise((r) => setTimeout(r, 30));
  const puzzle = generatePuzzle(spec, useKidsBank ? kidsBank() : mainBank());
  if (!puzzle) throw new Error('The engine could not fill this grid — try another size or theme.');
  return puzzle;
}

export async function resolvePuzzle(ctx: RouteCtx): Promise<Puzzle> {
  const [id] = ctx.params;
  if (!id) throw new Error('No puzzle specified');

  if (id === 'gen') {
    return resolveGenerated(ctx.query);
  }

  // Date-keyed dailies: daily-2026-07-06 / mini-2026-07-06
  const dailyMatch = id.match(/^(daily|mini)-(\d{4}-\d{2}-\d{2})$/);
  if (dailyMatch) {
    const puzzle = dailyFor(dailyMatch[2]!, dailyMatch[1] as 'daily' | 'mini');
    if (puzzle) return puzzle;
    // Library gap → deterministic generated fallback so the daily never 404s.
    const dateIso = dailyMatch[2]!;
    const weekday = weekdayOf(dateIso);
    const knobs = knobsFor(weekday);
    const size = dailyMatch[1] === 'daily' ? 15 : knobs.miniSize;
    return generateAsync({
      id,
      kind: dailyMatch[1] === 'daily' ? 'daily' : 'mini',
      title: dailyMatch[1] === 'daily' ? 'The Daily' : 'The Mini',
      date: dateIso,
      difficulty: weekday,
      templates: pickTemplates(size, weekday),
      seedKey: `${dailyMatch[1]}|${dateIso}`,
      categoryWeights: {}, // dailies are the same for everyone — no adaptive nudge
    });
  }

  const fromLibrary = libraryPuzzles().find((p) => p.id === id);
  if (fromLibrary) return fromLibrary;
  throw new Error(`Unknown puzzle "${id}"`);
}

async function resolveGenerated(query: URLSearchParams): Promise<Puzzle> {
  const mode = query.get('mode') ?? 'free';
  const size = Number(query.get('size') ?? 5);
  const difficulty = Number(query.get('difficulty') ?? 3);
  const seed = query.get('seed') ?? String(Date.now());
  const settings = getSettings();

  if (mode === 'free') {
    return generateAsync({
      id: `gen-free-${seed}`,
      kind: 'generated',
      title: `Free Play ${size}×${size}`,
      difficulty,
      templates: pickTemplates(size, difficulty),
      seedKey: `free|${size}|${difficulty}|${seed}`,
      categoryWeights: settings.adaptive ? adaptiveWeights() : {},
    });
  }

  if (mode === 'kids') {
    const grade = query.get('grade') ?? 'K';
    const theme = query.get('theme') ?? 'animals';
    const match = matchTheme(theme, kidsEntries(), { maxSeeds: 4, minLen: 3 });
    return generateAsync({
      id: `gen-kids-${seed}`,
      kind: 'kids',
      title: `${theme[0]?.toUpperCase()}${theme.slice(1)} (Grade ${grade})`,
      difficulty: 1,
      templates: templatesBySize(5, 5),
      seedKey: `kids|${grade}|${theme}|${seed}`,
      theme: { name: theme, entries: match.seeds.slice(0, 2) },
      categoryWeights: match.weights,
      fillOptions: { scoreFloor: 45 },
    }, true);
  }

  if (mode === 'themed') {
    const themeText = query.get('theme') ?? '';
    if (!themeText) throw new Error('No theme given');

    // LLM path when a key is configured; graceful local fallback otherwise.
    if (settings.llm?.apiKey) {
      try {
        return await generateThemedViaLlm(themeText, { size, difficulty, seed });
      } catch {
        // fall through to the local engine
      }
    }
    const match = matchTheme(themeText, bankEntries(), { maxSeeds: 5 });
    if (match.seeds.length === 0) {
      throw new Error(
        `Our library doesn't know "${themeText}" well enough yet. ` +
        `Add an AI key in Settings for made-to-order themes, or try a broader topic.`,
      );
    }
    return generateAsync({
      id: `gen-themed-${seed}`,
      kind: 'themed',
      title: themeTitle(themeText),
      difficulty,
      templates: templatesBySize(size, 5),
      seedKey: `themed|${themeText}|${seed}`,
      theme: { name: themeText, entries: match.seeds.slice(0, size >= 11 ? 4 : 2) },
      categoryWeights: match.weights,
    });
  }

  throw new Error(`Unknown generation mode "${mode}"`);
}

export function themeTitle(theme: string): string {
  const t = theme.trim();
  return t.length <= 34 ? `“${t[0]?.toUpperCase()}${t.slice(1)}”` : `“${t.slice(0, 32)}…”`;
}
