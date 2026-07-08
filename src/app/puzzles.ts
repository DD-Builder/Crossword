/** Puzzle resolution: route params → a concrete Puzzle. Dailies come from
 * the hand-authored library (date-keyed rotation); generated puzzles come
 * from the fill engine (worker for big grids, sync for minis). */

import type { RouteCtx } from './router.ts';
import type { GridTemplate, Puzzle } from '../core/types.ts';
import { deriveSlots, templateToGrid } from '../core/grid.ts';
import { generatePuzzle } from '../core/generator/puzzle-gen.ts';
import { knobsFor, weekdayOf } from '../core/generator/difficulty.ts';
import { matchTheme } from '../core/generator/themer.ts';
import { fnv1a } from '../core/rng.ts';
import {
  bankEntries, fullBank, kidsBank, kidsEntries, libraryPuzzles, mainBank, templatesBySize,
} from '../data/loader.ts';
import { adaptiveClueTier, adaptiveScoreFloor, adaptiveWeights } from '../stats/adaptive.ts';
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
  let pool = templatesBySize(size, knobs.maxOpenness).filter((t) => !t.themeSlotMin);
  // Large American grids are necessarily more open (openness 5) than an easy
  // day's cap allows. Grid openness is a fill/aesthetic property, not a clue
  // difficulty — so when the openness cap excludes every template at this size,
  // relax it. The clue tier (knobs.clueTier) still carries the difficulty.
  if (pool.length === 0) {
    pool = templatesBySize(size, 5).filter((t) => !t.themeSlotMin);
  }
  // Prefer fully-checked NYT-standard American grids (~16% black) — the shipped
  // curated+authored bank now fills them at every size. Lattice grids (34%
  // black) are kept only as a fallback if no American template exists.
  const american = pool.filter((t) => !t.lattice);
  return american.length > 0 ? american : pool;
}

/** Slot lengths that actually exist in a template pool. A theme entry can
 * only be seeded if some template has a slot of its exact length — seeding a
 * 6-letter word into a grid whose slots are 3/5/7 (or into a 5×5) is
 * impossible and dooms the fill. */
function placeableLengths(pool: GridTemplate[]): Set<number> {
  const lens = new Set<number>();
  for (const t of pool) {
    for (const s of deriveSlots(templateToGrid(t.size, t.blocks), 3).slots) {
      lens.add(s.cells.length);
    }
  }
  return lens;
}

/** Kids grade (from the picker) → a numeric level 0 (Kindergarten) … 5. Grades
 * 6–8 in the picker reuse the fifth-grade pool (the deepest kid-safe tier). */
export function gradeToNum(grade: string): number {
  if (grade === 'K') return 0;
  const n = Number(grade);
  return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 0;
}

/** Generate a themed puzzle: seed the theme words that can actually fit, and
 * if that fill can't be completed, fall back to a puzzle whose *fill* is still
 * biased toward the theme's categories (via categoryWeights) but carries no
 * hard-seeded entries. Guarantees a themed-flavored puzzle every time. */
async function generateThemed(
  base: Parameters<typeof generatePuzzle>[0],
  themeName: string,
  candidateSeeds: string[],
  kidsGrade: number | null = null,
): Promise<Puzzle> {
  const size = base.templates[0]?.size ?? 5;
  const lens = placeableLengths(base.templates);
  const seeds = candidateSeeds.filter((s) => lens.has(s.length)).slice(0, size >= 11 ? 4 : 2);
  if (seeds.length > 0) {
    try {
      return await generateAsync({ ...base, theme: { name: themeName, entries: seeds } }, kidsGrade);
    } catch {
      // exact seeding couldn't fill — degrade to category-biased fill below
    }
  }
  return generateAsync(base, kidsGrade);
}

async function generateAsync(spec: Parameters<typeof generatePuzzle>[0], kidsGrade: number | null = null): Promise<Puzzle> {
  // Minis fill in <100ms — run sync. Bigger grids get one macrotask yield
  // so the "constructing…" frame paints; the fill itself is still fast
  // thanks to heavy-block templates. (A worker handle exists for future
  // heavier generation; today's grids don't need it.)
  const size = spec.templates[0]?.size ?? 5;
  if (size > 7) await new Promise((r) => setTimeout(r, 30));
  // Kids draw from the grade-filtered kid-safe bank (themed kid words + graded
  // Dale–Chall glue), with themed words weighted far above the glue so the grid
  // reads as kid vocabulary. Fully-checked American grids at 9×9+ need the
  // authored+fill tier's density to fill reliably (the curated-only bank can't).
  const isKids = kidsGrade !== null;
  const bank = kidsGrade !== null ? kidsBank(kidsGrade) : size >= 9 ? await fullBank() : mainBank();
  const spec_ = isKids
    ? {
        ...spec,
        // A proper (fully-checked) 5×5 is a demanding fill from the kid-safe
        // bank — give the engine plenty of restarts to land one.
        ...(spec.restarts == null ? { restarts: 14 } : {}),
        fillOptions: { tagWeights: { kid: 10, glue: 0.5 }, ...spec.fillOptions },
      }
    : size >= 9
    ? {
        ...spec,
        // Fully-checked American grids have a lower per-attempt fill rate as
        // they grow (and demanding score floors on easy days tighten it), so
        // scale restarts with size — each attempt picks a fresh template + seed.
        ...(spec.restarts == null ? { restarts: size >= 17 ? 16 : size >= 11 ? 10 : 6 } : {}),
        fillOptions: { tagWeights: { fill: 0.6 }, ...spec.fillOptions },
      }
    : spec;
  const puzzle = generatePuzzle(spec_, bank);
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
    const kind = dailyMatch[1] as 'daily' | 'mini';
    const dateIso = dailyMatch[2]!;
    const weekday = weekdayOf(dateIso);
    // Sunday's Daily is the grand 21×21 — generated deterministically (same grid
    // for everyone via the date seed) rather than pulled from the 15×15 library.
    const sundayGrand = kind === 'daily' && weekday === 7;
    if (!sundayGrand) {
      const puzzle = dailyFor(dateIso, kind);
      if (puzzle) return puzzle;
    }
    // Generation ladder: Sunday reaches for the big grids first; other days fall
    // through library-sized American grids. Walks down until one lands so the
    // daily never 404s.
    const knobs = knobsFor(weekday);
    const sizes = kind === 'mini'
      ? [knobs.miniSize]
      : sundayGrand ? [21, 19, 17, 15] : [15, 13, 11, 9, 7];
    let lastError: unknown = null;
    for (const size of sizes) {
      try {
        return await generateAsync({
          id,
          kind: kind === 'daily' ? 'daily' : 'mini',
          title: kind === 'daily' ? 'The Daily' : 'The Mini',
          date: dateIso,
          difficulty: weekday,
          templates: pickTemplates(size, weekday),
          seedKey: `${kind}|${dateIso}|s${size}`,
          restarts: size >= 17 ? 16 : 8,
          categoryWeights: {}, // dailies are the same for everyone — no adaptive nudge
        });
      } catch (err) {
        lastError = err;
      }
    }
    // Sunday grand grid couldn't fill at any size → fall back to the library 15.
    if (sundayGrand) {
      const lib = dailyFor(dateIso, kind);
      if (lib) return lib;
    }
    throw lastError instanceof Error ? lastError : new Error('Daily generation failed');
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
    const registerParam = query.get('register');
    const register: 'classic' | 'modern' =
      registerParam === 'classic' || registerParam === 'modern' ? registerParam : settings.clueRegister;
    const knobs = knobsFor(difficulty);
    const clueTierParam = Number(query.get('cluetier'));
    const explicitTier = clueTierParam >= 1 && clueTierParam <= 5 ? clueTierParam : undefined;
    // With no explicit clue-tier knob, let the adaptive layer set clue difficulty
    // from the player's ability (Elo, once there's enough history) or recent pace.
    // It also loosens/tightens the fill floor to match. Free Play only; dailies
    // stay deterministic.
    const clueTier = explicitTier ?? (settings.adaptive ? adaptiveClueTier(knobs.clueTier) : undefined);
    const scoreFloor = settings.adaptive && !explicitTier ? adaptiveScoreFloor(knobs.scoreFloor) : undefined;
    return generateAsync({
      id: `gen-free-${seed}`,
      kind: 'generated',
      title: `Free Play ${size}×${size}`,
      difficulty,
      templates: pickTemplates(size, difficulty),
      seedKey: `free|${size}|${difficulty}|${seed}`,
      register,
      ...(clueTier ? { clueTier } : {}),
      ...(scoreFloor !== undefined ? { fillOptions: { scoreFloor } } : {}),
      categoryWeights: settings.adaptive ? adaptiveWeights() : {},
    });
  }

  if (mode === 'kids') {
    const grade = query.get('grade') ?? 'K';
    const theme = query.get('theme') ?? 'animals';
    const g = gradeToNum(grade);
    const match = matchTheme(theme, kidsEntries(), { maxSeeds: 4, minLen: 3 });
    // Every kids puzzle is a PROPER fully-checked crossword built from short,
    // concrete words. The bank is filtered to the player's grade, so a
    // kindergartner only ever sees kindergarten words and clues; themed kid words
    // are weighted far above the glue. Kindergarten gets the block-heavier
    // `t5-kinder` grid (almost all 3-letter words) because the pool of plainly
    // clued longer words a five-year-old can read is thin; older grades get the
    // `t5-kids` pair (3/4/5-letter mix), which fills reliably from the grade-
    // limited bank and leaves room for a hard-seeded theme word.
    const templates = g <= 0
      ? templatesBySize(5, 5).filter((t) => t.id === 't5-kinder')
      : templatesBySize(5, 5).filter((t) => t.id.startsWith('t5-kids'));
    // A single hard seed: two would over-constrain the small grade-limited bank
    // and force the theme-less fallback every time. One places cleanly (grade 2+)
    // and still centers the puzzle on the theme; if even that can't complete, the
    // category-biased fallback keeps the flavor.
    return generateThemed({
      id: `gen-kids-${seed}`,
      kind: 'kids',
      title: `${theme[0]?.toUpperCase()}${theme.slice(1)} (Grade ${grade})`,
      difficulty: g <= 1 ? 1 : g <= 3 ? 2 : 3,
      templates,
      seedKey: `kids|${grade}|${theme}|${seed}`,
      categoryWeights: match.weights,
      fillOptions: { scoreFloor: 40 },
    }, theme, match.seeds.slice(0, 1), g);
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
    return generateThemed({
      id: `gen-themed-${seed}`,
      kind: 'themed',
      title: themeTitle(themeText),
      difficulty,
      templates: pickTemplates(size, difficulty),
      seedKey: `themed|${themeText}|${seed}`,
      categoryWeights: match.weights,
      // Boost the theme's specific tags (keeping the fill-tier demotion).
      fillOptions: { tagWeights: { fill: 0.6, ...match.tagWeights } },
    }, themeText, match.seeds);
  }

  throw new Error(`Unknown generation mode "${mode}"`);
}

export function themeTitle(theme: string): string {
  const t = theme.trim();
  return t.length <= 34 ? `“${t[0]?.toUpperCase()}${t.slice(1)}”` : `“${t.slice(0, 32)}…”`;
}
