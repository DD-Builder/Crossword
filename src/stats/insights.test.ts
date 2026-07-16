import { describe, expect, it } from 'vitest';
import {
  abilityMovement, clueMissList, sampleTrajectory, styleBreakdown,
} from './insights.ts';
import { computeAbilityTrajectory, computeProfile, displayScore } from './adaptive.ts';
import type { ClueRow } from './events.ts';
import type { Category } from '../core/types.ts';

function row(partial: Partial<ClueRow> & { category: Category }): ClueRow {
  return {
    puzzleId: 'p', date: '2026-07-08', slotId: '1A', answer: 'CAT', clue: 'Pet',
    stars: 3, lengthChars: 3, msToSolve: 4000, wrongLetters: 0, hintTiers: [],
    revealed: false,
    ...partial,
  };
}
const cleanAt = (d: 1 | 2 | 3 | 4 | 5, date = '2026-07-08'): ClueRow =>
  row({ category: 'wordplay', difficulty: d, date });
const missAt = (d: 1 | 2 | 3 | 4 | 5, date = '2026-07-08'): ClueRow =>
  row({ category: 'wordplay', difficulty: d, revealed: true, wrongLetters: 2, msToSolve: null, date });

describe('computeAbilityTrajectory', () => {
  it('has one point per rated clue, and its final value matches computeProfile', () => {
    const clues = Array.from({ length: 50 }, (_, i) => cleanAt(3, `2026-07-${String((i % 20) + 1).padStart(2, '0')}`));
    const trajectory = computeAbilityTrajectory(clues);
    expect(trajectory.length).toBe(50);
    expect(trajectory[trajectory.length - 1]!.ability).toBeCloseTo(computeProfile(clues).ability, 6);
  });

  it('skips clues with no recorded difficulty', () => {
    const clues = [row({ category: 'wordplay' }), cleanAt(3), row({ category: 'wordplay' })];
    expect(computeAbilityTrajectory(clues).length).toBe(1);
  });
});

describe('sampleTrajectory', () => {
  it('leaves a short trajectory untouched', () => {
    const points = computeAbilityTrajectory(Array.from({ length: 10 }, () => cleanAt(3)));
    expect(sampleTrajectory(points, 60)).toEqual(points);
  });

  it('caps at maxSamples and always keeps the final point', () => {
    const points = computeAbilityTrajectory(Array.from({ length: 500 }, () => cleanAt(3)));
    const sampled = sampleTrajectory(points, 60);
    expect(sampled.length).toBeLessThanOrEqual(60);
    expect(sampled[sampled.length - 1]).toEqual(points[points.length - 1]);
  });
});

describe('abilityMovement', () => {
  it('is null with no history', () => {
    expect(abilityMovement([], 7, new Date('2026-07-15'))).toBeNull();
  });

  it('is null when all history is more recent than the lookback window', () => {
    const points = computeAbilityTrajectory(Array.from({ length: 5 }, () => cleanAt(3, '2026-07-14')));
    expect(abilityMovement(points, 7, new Date('2026-07-15'))).toBeNull();
  });

  it('reports positive movement for an improving streak', () => {
    const clues = [
      ...Array.from({ length: 40 }, () => missAt(3, '2026-06-01')),
      ...Array.from({ length: 40 }, () => cleanAt(5, '2026-07-14')),
    ];
    const points = computeAbilityTrajectory(clues);
    const movement = abilityMovement(points, 7, new Date('2026-07-15'))!;
    expect(movement.delta).toBeGreaterThan(0);
    expect(movement.toScore).toBe(displayScore(points[points.length - 1]!.ability));
  });

  it('reports negative movement for a declining streak', () => {
    const clues = [
      ...Array.from({ length: 40 }, () => cleanAt(5, '2026-06-01')),
      ...Array.from({ length: 40 }, () => missAt(1, '2026-07-14')),
    ];
    const points = computeAbilityTrajectory(clues);
    const movement = abilityMovement(points, 7, new Date('2026-07-15'))!;
    expect(movement.delta).toBeLessThan(0);
  });
});

describe('styleBreakdown', () => {
  it('seen-counts across styles sum to the total clue count', () => {
    const clues: ClueRow[] = [
      row({ category: 'wordplay', clue: '"Bohemian Rhapsody" band' }),
      row({ category: 'wordplay', clue: 'Bright thing that dawns on you?' }),
      row({ category: 'wordplay', clue: 'Domesticated feline' }),
      row({ category: 'wordplay', clue: 'NASA vehicle' }),
    ];
    const stats = styleBreakdown(clues);
    expect(stats.reduce((a, s) => a + s.seen, 0)).toBe(clues.length);
  });
});

describe('clueMissList', () => {
  it('excludes clues seen fewer than minSeen times', () => {
    const clues: ClueRow[] = [row({ category: 'wordplay', clue: 'One-off', answer: 'ONE' })];
    expect(clueMissList(clues, 2).worst).toEqual([]);
  });

  it('orders worst by miss rate descending', () => {
    const clues: ClueRow[] = [
      ...Array.from({ length: 3 }, () => row({ category: 'wordplay', clue: 'Often missed', answer: 'MISS', revealed: true, msToSolve: null })),
      ...Array.from({ length: 3 }, () => row({ category: 'wordplay', clue: 'Rarely missed', answer: 'HIT' })),
    ];
    const { worst } = clueMissList(clues, 2);
    expect(worst[0]!.clue).toBe('Often missed');
    expect(worst[0]!.missRate).toBe(1);
  });
});
