/** Derived stats for the dashboard — reads solves/clues from IndexedDB and
 * shapes them for rendering. */

import { getAll } from './db.ts';
import type { ClueRow, SolveRow } from './events.ts';
import type { Category } from '../core/types.ts';
import { CATEGORIES, CATEGORY_LABELS } from '../core/types.ts';

export interface CategoryStat {
  category: Category;
  label: string;
  seen: number;
  cleanRate: number;   // solved with no wrong letters / no reveal
  medianMs: number;
  hintRate: number;
}

export interface DashboardData {
  totalSolves: number;
  totalFlawless: number;
  totalClues: number;
  totalTimeMs: number;
  avgStars: number;
  byWeekday: { weekday: number; count: number; medianMs: number }[];
  bySize: { size: number; count: number; bestMs: number; medianMs: number }[];
  categories: CategoryStat[];
  hourHistogram: number[];   // 24 buckets
  hintTierUsage: number[];   // index 0 unused, tiers 1..6
  recentSolves: SolveRow[];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

export async function dashboardData(): Promise<DashboardData> {
  const [solves, clues] = await Promise.all([
    getAll<SolveRow>('solves'),
    getAll<ClueRow>('clues'),
  ]);

  const completed = solves.filter((s) => s.activeMs > 0);
  completed.sort((a, b) => b.completedAt - a.completedAt);

  const byWeekday = Array.from({ length: 8 }, (_, weekday) => ({ weekday, count: 0, times: [] as number[] }));
  for (const s of completed) {
    if (s.difficulty >= 1 && s.difficulty <= 7) {
      byWeekday[s.difficulty]!.count++;
      byWeekday[s.difficulty]!.times.push(s.activeMs);
    }
  }

  const sizes = new Map<number, number[]>();
  for (const s of completed) {
    const list = sizes.get(s.size) ?? [];
    list.push(s.activeMs);
    sizes.set(s.size, list);
  }

  const catRows = new Map<Category, ClueRow[]>();
  for (const cat of CATEGORIES) catRows.set(cat, []);
  for (const c of clues) catRows.get(c.category)?.push(c);

  const categories: CategoryStat[] = [];
  for (const cat of CATEGORIES) {
    const rows = catRows.get(cat)!;
    if (rows.length === 0) continue;
    const clean = rows.filter((r) => !r.revealed && r.wrongLetters === 0).length;
    const solvedMs = rows.filter((r) => r.msToSolve !== null).map((r) => r.msToSolve!);
    categories.push({
      category: cat,
      label: CATEGORY_LABELS[cat],
      seen: rows.length,
      cleanRate: clean / rows.length,
      medianMs: median(solvedMs),
      hintRate: rows.reduce((a, r) => a + r.hintTiers.length, 0) / rows.length,
    });
  }
  categories.sort((a, b) => b.seen - a.seen);

  const hourHistogram = Array.from({ length: 24 }, () => 0);
  for (const s of completed) hourHistogram[s.hourOfDay] = (hourHistogram[s.hourOfDay] ?? 0) + 1;

  const hintTierUsage = Array.from({ length: 7 }, () => 0);
  for (const c of clues) {
    for (const tier of c.hintTiers) {
      if (tier >= 1 && tier <= 6) hintTierUsage[tier] = (hintTierUsage[tier] ?? 0) + 1;
    }
  }

  return {
    totalSolves: completed.length,
    totalFlawless: completed.filter((s) => s.flawless).length,
    totalClues: clues.length,
    totalTimeMs: completed.reduce((a, s) => a + s.activeMs, 0),
    avgStars: completed.length > 0
      ? completed.reduce((a, s) => a + s.avgStars, 0) / completed.length
      : 0,
    byWeekday: byWeekday.map((w) => ({ weekday: w.weekday, count: w.count, medianMs: median(w.times) })),
    bySize: [...sizes.entries()]
      .map(([size, times]) => ({ size, count: times.length, bestMs: Math.min(...times), medianMs: median(times) }))
      .sort((a, b) => a.size - b.size),
    categories,
    hourHistogram,
    hintTierUsage,
    recentSolves: completed.slice(0, 12),
  };
}
