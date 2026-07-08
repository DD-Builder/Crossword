/** The light-touch adaptive layer. Derives a small profile from solve
 * history and exposes clamped category weights (0.9–1.15) that nudge —
 * never steer — generated puzzles toward what the player enjoys.
 * Deterministic dailies never consume these. */

import type { Category } from '../core/types.ts';
import { CATEGORIES } from '../core/types.ts';
import { get, getAll, put } from './db.ts';
import type { ClueRow } from './events.ts';

export interface Profile {
  id: 'main';
  updatedAt: number;
  totalClues: number;
  /** Per-category: solve count, accuracy, median ms (unaided solves only). */
  categories: Record<string, { solved: number; accuracy: number; medianMs: number }>;
  /** Clamped multipliers fed to the generator. */
  weights: Record<string, number>;
  /** -0.5 … +0.5 clue-tier nudge from recent pace vs. expectations. */
  tierNudge: number;
  hintReliance: number; // hints per solved clue, 0..
}

const EMPTY: Profile = {
  id: 'main',
  updatedAt: 0,
  totalClues: 0,
  categories: {},
  weights: {},
  tierNudge: 0,
  hintReliance: 0,
};

let cached: Profile | null = null;

export async function getProfile(): Promise<Profile> {
  if (cached) return cached;
  cached = (await get<Profile>('profile', 'main')) ?? EMPTY;
  return cached;
}

/** Synchronous snapshots for generation call-sites; safe defaults until the
 * profile loads (first generation after boot may be unadapted — fine). */
let weightsSync: Record<string, number> = {};
let tierNudgeSync = 0;
export function adaptiveWeights(): Record<string, number> {
  return weightsSync;
}
/** Recent-pace clue-difficulty nudge in −0.5…+0.5 (breeze → +, struggle → −). */
export function adaptiveTierNudge(): number {
  return tierNudgeSync;
}

export async function primeAdaptive(): Promise<void> {
  const profile = await getProfile();
  weightsSync = profile.weights;
  tierNudgeSync = profile.tierNudge;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** Recency weight for the clue at index `i` of `n` (rows are chronological, so
 * the newest is `n-1`). Halves every RECENCY_HALF_LIFE clues, so the profile
 * tracks the player's *current* skill instead of their all-time average. */
const RECENCY_HALF_LIFE = 80;
function recencyWeight(i: number, n: number): number {
  return 2 ** (-(n - 1 - i) / RECENCY_HALF_LIFE);
}

/** Pure profile computation from the raw clue history — the whole adaptive model
 * with no IO, so it's unit-testable. `refreshProfile` wraps it with storage. */
export type ProfileData = Omit<Profile, 'id' | 'updatedAt'>;
export function computeProfile(clues: ClueRow[]): ProfileData {
  const n = clues.length;
  const byCat = new Map<Category, { row: ClueRow; w: number }[]>();
  for (const cat of CATEGORIES) byCat.set(cat, []);
  clues.forEach((row, i) => byCat.get(row.category)?.push({ row, w: recencyWeight(i, n) }));

  const categories: Profile['categories'] = {};
  const affinity = new Map<Category, number>();

  for (const [cat, entries] of byCat) {
    if (entries.length === 0) continue;
    const solvedRows = entries.map((e) => e.row).filter((r) => r.msToSolve !== null);
    // Recency-weighted accuracy: recent wins/losses dominate the estimate.
    const wTotal = entries.reduce((a, e) => a + e.w, 0);
    const wWins = entries.reduce(
      (a, e) => a + (!e.row.revealed && e.row.wrongLetters === 0 ? e.w : 0), 0);
    const accuracy = wTotal > 0 ? wWins / wTotal : 0;
    const medianMs = median(solvedRows.map((r) => r.msToSolve!));
    categories[cat] = { solved: solvedRows.length, accuracy, medianMs };

    // Affinity blends competence (accuracy) and engagement (share of clues
    // seen). Enjoyment is inferred gently — never punished.
    affinity.set(cat, accuracy * 0.7 + Math.min(1, entries.length / 60) * 0.3);
  }

  // Convert affinities to clamped multipliers around 1.0.
  const values = [...affinity.values()];
  const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const weights: Record<string, number> = {};
  if (values.length >= 3 && clues.length >= 40) {
    for (const [cat, a] of affinity) {
      const delta = a - mean;
      weights[cat] = Math.min(1.15, Math.max(0.9, 1 + delta * 0.4));
    }
  }

  // Tier nudge: recent solves' hint+error pressure vs. none.
  const recent = clues.slice(-120);
  const pressure = recent.length > 0
    ? recent.reduce((a, r) => a + (r.revealed ? 1 : 0) + Math.min(1, r.hintTiers.length * 0.5) + Math.min(1, r.wrongLetters * 0.34), 0) / recent.length
    : 0;
  const tierNudge = Math.min(0.5, Math.max(-0.5, 0.25 - pressure)); // breeze → +, struggle → −

  const hintReliance = clues.length > 0
    ? clues.reduce((a, r) => a + r.hintTiers.length, 0) / clues.length
    : 0;

  return { totalClues: n, categories, weights, tierNudge, hintReliance };
}

export async function refreshProfile(): Promise<Profile> {
  const clues = await getAll<ClueRow>('clues');
  const profile: Profile = { id: 'main', updatedAt: Date.now(), ...computeProfile(clues) };
  await put('profile', profile);
  cached = profile;
  weightsSync = profile.weights;
  tierNudgeSync = profile.tierNudge;
  return profile;
}
