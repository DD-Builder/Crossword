import { describe, expect, it } from 'vitest';
import { abilityToTier, computeProfile, tierScoreFloor } from './adaptive.ts';
import type { ClueRow } from './events.ts';
import type { Category } from '../core/types.ts';

/** Minimal ClueRow factory — only the fields the adaptive model reads matter. */
function row(partial: Partial<ClueRow> & { category: Category }): ClueRow {
  return {
    puzzleId: 'p', date: '2026-07-08', slotId: '1A', answer: 'CAT', clue: 'Pet',
    stars: 3, lengthChars: 3, msToSolve: 4000, wrongLetters: 0, hintTiers: [],
    revealed: false,
    ...partial,
  };
}

/** A clean (unaided, no errors) solve vs. a struggle (revealed / wrong / hints). */
const clean = (cat: Category): ClueRow => row({ category: cat });
const struggle = (cat: Category): ClueRow =>
  row({ category: cat, revealed: true, wrongLetters: 3, hintTiers: [1, 2], msToSolve: null });

describe('computeProfile — tierNudge (recent pace)', () => {
  it('nudges up when the player is breezing (all clean solves)', () => {
    const clues = Array.from({ length: 40 }, () => clean('wordplay'));
    expect(computeProfile(clues).tierNudge).toBeGreaterThan(0);
  });

  it('nudges down when the player is struggling (reveals + errors + hints)', () => {
    const clues = Array.from({ length: 40 }, () => struggle('wordplay'));
    expect(computeProfile(clues).tierNudge).toBeLessThan(0);
  });

  it('stays within the -0.5…+0.5 clamp', () => {
    const breeze = computeProfile(Array.from({ length: 200 }, () => clean('geography'))).tierNudge;
    const rough = computeProfile(Array.from({ length: 200 }, () => struggle('geography'))).tierNudge;
    expect(breeze).toBeLessThanOrEqual(0.5);
    expect(rough).toBeGreaterThanOrEqual(-0.5);
  });
});

describe('computeProfile — category weights', () => {
  it('is empty until there is enough signal (≥3 categories, ≥40 clues)', () => {
    const clues = Array.from({ length: 10 }, () => clean('wordplay'));
    expect(computeProfile(clues).weights).toEqual({});
  });

  it('favors a strong category over a weak one, within the 0.9–1.15 clamp', () => {
    const clues = [
      ...Array.from({ length: 20 }, () => clean('wordplay')),      // strong
      ...Array.from({ length: 20 }, () => struggle('geography')),  // weak
      ...Array.from({ length: 20 }, () => clean('history')),       // strong-ish
    ];
    const { weights } = computeProfile(clues);
    expect(weights.wordplay).toBeGreaterThan(weights.geography!);
    for (const w of Object.values(weights)) {
      expect(w).toBeGreaterThanOrEqual(0.9);
      expect(w).toBeLessThanOrEqual(1.15);
    }
  });
});

describe('Elo ability rating', () => {
  const cleanAt = (d: 1 | 2 | 3 | 4 | 5): ClueRow => row({ category: 'wordplay', difficulty: d });
  const missAt = (d: 1 | 2 | 3 | 4 | 5): ClueRow =>
    row({ category: 'wordplay', difficulty: d, revealed: true, wrongLetters: 2, msToSolve: null });

  it('rises when the player cleanly solves hard clues', () => {
    const clues = Array.from({ length: 60 }, () => cleanAt(5));
    expect(computeProfile(clues).ability).toBeGreaterThan(1000);
  });

  it('falls when the player misses easy clues', () => {
    const clues = Array.from({ length: 60 }, () => missAt(1));
    expect(computeProfile(clues).ability).toBeLessThan(1000);
  });

  it('a strong player targets a higher tier than a weak one', () => {
    const strong = computeProfile(Array.from({ length: 80 }, () => cleanAt(5))).ability;
    const weak = computeProfile(Array.from({ length: 80 }, () => missAt(1))).ability;
    expect(abilityToTier(strong)).toBeGreaterThan(abilityToTier(weak));
  });

  it('abilityToTier is clamped to 1–5', () => {
    expect(abilityToTier(5000)).toBe(5);
    expect(abilityToTier(-5000)).toBe(1);
  });

  it('score floor loosens as the tier rises (inverse coupling)', () => {
    expect(tierScoreFloor(1)).toBeGreaterThan(tierScoreFloor(5));
  });

  it('recentSuccess reflects the recent clean rate', () => {
    const clues = [
      ...Array.from({ length: 20 }, () => missAt(2)),
      ...Array.from({ length: 20 }, () => cleanAt(2)),
    ];
    // Last 40 rated → 20 clean of 40 = 50%.
    expect(computeProfile(clues).recentSuccess).toBeCloseTo(0.5, 1);
  });

  it('ignores clues with no recorded difficulty', () => {
    const clues = Array.from({ length: 30 }, () => row({ category: 'wordplay' })); // no difficulty
    expect(computeProfile(clues).ability).toBe(1000); // unchanged from start
  });
});

describe('computeProfile — recency weighting', () => {
  it('weights recent solves more than old ones', () => {
    // Old struggles, then a long recent streak of clean solves → accuracy should
    // read high (recent dominates), not ~50%.
    const clues = [
      ...Array.from({ length: 80 }, () => struggle('science-nature')),
      ...Array.from({ length: 80 }, () => clean('science-nature')),
    ];
    // Unweighted this would be exactly 0.5; recency pulls it well above.
    const acc = computeProfile(clues).categories['science-nature']!.accuracy;
    expect(acc).toBeGreaterThan(0.6);
  });
});
