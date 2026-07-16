/** Aggregations for the Player Insights view — rating trend, movement, and
 * clue-style/miss breakdowns. All pure functions operating on the same
 * ClueRow history metrics.ts reads, plus one IO-touching entry point
 * (`insightsData`) that mirrors `dashboardData()` in metrics.ts. */

import { getAll } from './db.ts';
import type { ClueRow } from './events.ts';
import {
  type AbilityPoint, computeAbilityTrajectory, displayScore,
} from './adaptive.ts';
import { CLUE_STYLES, CLUE_STYLE_LABELS, classifyClueStyle, type ClueStyle } from './clueStyle.ts';

/** Downsample a trajectory for charting — even index spacing, always keeping
 * the final point so the chart's rightmost edge is always "now." */
export function sampleTrajectory(points: AbilityPoint[], maxSamples = 60): AbilityPoint[] {
  if (points.length <= maxSamples) return points;
  const step = points.length / (maxSamples - 1);
  const sampled: AbilityPoint[] = [];
  for (let i = 0; i < maxSamples - 1; i++) sampled.push(points[Math.floor(i * step)]!);
  sampled.push(points[points.length - 1]!); // always end on "now"
  return sampled;
}

export interface AbilityMovement { fromScore: number; toScore: number; delta: number }

/** Movement over the last `daysBack` days, in the same 0–100 display domain
 * used everywhere else — never diffs raw Elo against a 0–100 chart. Returns
 * null if there's no point old enough to compare against (e.g. brand new). */
export function abilityMovement(points: AbilityPoint[], daysBack: number, now: Date): AbilityMovement | null {
  if (points.length === 0) return null;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - daysBack);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  let from: AbilityPoint | null = null;
  for (const p of points) {
    if (p.date <= cutoffIso) from = p;
    else break;
  }
  if (!from) return null;

  const to = points[points.length - 1]!;
  const fromScore = displayScore(from.ability);
  const toScore = displayScore(to.ability);
  return { fromScore, toScore, delta: toScore - fromScore };
}

export interface ClueStyleStat {
  style: ClueStyle; label: string; seen: number; cleanRate: number; medianMs: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** Best/worst clue *style* (heuristic, from clue text) — aggregated exactly
 * like metrics.ts aggregates by topical category. */
export function styleBreakdown(clues: ClueRow[]): ClueStyleStat[] {
  const byStyle = new Map<ClueStyle, ClueRow[]>();
  for (const s of CLUE_STYLES) byStyle.set(s, []);
  for (const c of clues) byStyle.get(classifyClueStyle(c.clue))!.push(c);

  const stats: ClueStyleStat[] = [];
  for (const style of CLUE_STYLES) {
    const rows = byStyle.get(style)!;
    if (rows.length === 0) continue;
    const clean = rows.filter((r) => !r.revealed && r.wrongLetters === 0).length;
    const solvedMs = rows.filter((r) => r.msToSolve !== null).map((r) => r.msToSolve!);
    stats.push({
      style, label: CLUE_STYLE_LABELS[style], seen: rows.length,
      cleanRate: clean / rows.length, medianMs: median(solvedMs),
    });
  }
  return stats.sort((a, b) => b.seen - a.seen);
}

export interface ClueMissStat {
  clue: string; answer: string; seen: number; missRate: number; medianMs: number;
}

/** Personal "clues you miss most / solve best" — grouped by the exact
 * clue+answer pair (precise; a looser clue-text-only grouping is an easy
 * later variant) so a repeated clue across puzzles/replays is one entry. */
export function clueMissList(
  clues: ClueRow[], minSeen = 2, limit = 10,
): { worst: ClueMissStat[]; best: ClueMissStat[] } {
  const groups = new Map<string, ClueRow[]>();
  for (const c of clues) {
    const key = `${c.clue}::${c.answer}`;
    const list = groups.get(key);
    if (list) list.push(c);
    else groups.set(key, [c]);
  }

  const stats: ClueMissStat[] = [];
  for (const rows of groups.values()) {
    if (rows.length < minSeen) continue;
    const missed = rows.filter((r) => r.revealed || r.wrongLetters > 0).length;
    const solvedMs = rows.filter((r) => r.msToSolve !== null).map((r) => r.msToSolve!);
    stats.push({
      clue: rows[0]!.clue, answer: rows[0]!.answer, seen: rows.length,
      missRate: missed / rows.length, medianMs: median(solvedMs),
    });
  }

  const worst = [...stats].sort((a, b) => b.missRate - a.missRate).slice(0, limit);
  const best = [...stats]
    .filter((s) => s.missRate === 0)
    .sort((a, b) => a.medianMs - b.medianMs)
    .slice(0, limit);
  return { worst, best };
}

export interface InsightsData {
  ratedClues: number;
  trajectory: AbilityPoint[];
  sampledScores: number[]; // displayScore() per sampled trajectory point, for the sparkline
  currentScore: number | null;
  movement7d: AbilityMovement | null;
  movement30d: AbilityMovement | null;
  styles: ClueStyleStat[];
  missList: { worst: ClueMissStat[]; best: ClueMissStat[] };
}

export async function insightsData(now: Date): Promise<InsightsData> {
  const clues = await getAll<ClueRow>('clues');
  const trajectory = computeAbilityTrajectory(clues);
  const sampled = sampleTrajectory(trajectory);

  return {
    ratedClues: trajectory.length,
    trajectory,
    sampledScores: sampled.map((p) => displayScore(p.ability)),
    currentScore: trajectory.length ? displayScore(trajectory[trajectory.length - 1]!.ability) : null,
    movement7d: abilityMovement(trajectory, 7, now),
    movement30d: abilityMovement(trajectory, 30, now),
    styles: styleBreakdown(clues),
    missList: clueMissList(clues),
  };
}
