import { describe, expect, it } from 'vitest';
import { computeProfile } from './adaptive.ts';
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
