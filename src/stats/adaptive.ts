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

/** Synchronous weights for generation call-sites; safe empty default until
 * the profile loads (first generation after boot may be unweighted — fine). */
let weightsSync: Record<string, number> = {};
export function adaptiveWeights(): Record<string, number> {
  return weightsSync;
}

export async function primeAdaptive(): Promise<void> {
  const profile = await getProfile();
  weightsSync = profile.weights;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

export async function refreshProfile(): Promise<Profile> {
  const clues = await getAll<ClueRow>('clues');
  const byCat = new Map<Category, ClueRow[]>();
  for (const cat of CATEGORIES) byCat.set(cat, []);
  for (const row of clues) byCat.get(row.category)?.push(row);

  const categories: Profile['categories'] = {};
  const affinity = new Map<Category, number>();

  for (const [cat, rows] of byCat) {
    if (rows.length === 0) continue;
    const solvedRows = rows.filter((r) => r.msToSolve !== null);
    const accuracy = rows.length > 0
      ? rows.filter((r) => !r.revealed && r.wrongLetters === 0).length / rows.length
      : 0;
    const medianMs = median(solvedRows.map((r) => r.msToSolve!));
    categories[cat] = { solved: solvedRows.length, accuracy, medianMs };

    // Affinity blends competence (accuracy) and engagement (share of clues
    // seen). Enjoyment is inferred gently — never punished.
    affinity.set(cat, accuracy * 0.7 + Math.min(1, rows.length / 60) * 0.3);
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

  // Tier nudge: recent 10 solves' hint+error pressure vs. none.
  const recent = clues.slice(-120);
  const pressure = recent.length > 0
    ? recent.reduce((a, r) => a + (r.revealed ? 1 : 0) + Math.min(1, r.hintTiers.length * 0.5) + Math.min(1, r.wrongLetters * 0.34), 0) / recent.length
    : 0;
  const tierNudge = Math.min(0.5, Math.max(-0.5, 0.25 - pressure)); // breeze → +, struggle → −

  const hintReliance = clues.length > 0
    ? clues.reduce((a, r) => a + r.hintTiers.length, 0) / clues.length
    : 0;

  const profile: Profile = {
    id: 'main',
    updatedAt: Date.now(),
    totalClues: clues.length,
    categories,
    weights,
    tierNudge,
    hintReliance,
  };
  await put('profile', profile);
  cached = profile;
  weightsSync = weights;
  return profile;
}
