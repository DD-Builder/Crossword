import { describe, expect, it } from 'vitest';
import { pickClue } from './assemble.ts';
import { rngFrom } from '../rng.ts';
import type { BankEntry } from '../types.ts';

const entry = (clues: [string, number, number][]): BankEntry => ({
  answer: 'SHORE',
  score: 70,
  categories: ['geography'],
  tags: [],
  clues: clues.map(([text, difficulty, stars]) => ({
    text,
    difficulty: difficulty as 1 | 2 | 3 | 4 | 5,
    stars: stars as 1 | 2 | 3 | 4 | 5,
  })),
});

describe('pickClue — craft first', () => {
  const e = entry([
    ['Beach edge', 1, 1], // flat, easy
    ['Where the waves break', 2, 4], // witty, still easy
    ['Line drawn in the sand?', 5, 5], // devious
  ]);

  it('Monday picks the wittiest gettable clue, not the flattest tier-match', () => {
    const c = pickClue(e, 1, rngFrom('mon'));
    expect(c.text).toBe('Where the waves break'); // not "Beach edge"
  });

  it('easy days never exceed tier+1 difficulty (stays gettable)', () => {
    for (let i = 0; i < 20; i++) {
      const c = pickClue(e, 1, rngFrom(`mon-${i}`));
      expect(c.difficulty).toBeLessThanOrEqual(2);
    }
  });

  it('Saturday can reach the devious high-craft clue', () => {
    const c = pickClue(e, 5, rngFrom('sat'));
    expect(c.text).toBe('Line drawn in the sand?');
  });

  it('falls back to a placeholder when an entry has no clues', () => {
    const c = pickClue({ ...e, clues: [] }, 1, rngFrom('x'));
    expect(c.text).toContain('letters');
  });

  it('prefers higher stars among same-difficulty clues', () => {
    const flat = entry([['Dull', 1, 1], ['Sparkles', 1, 4]]);
    expect(pickClue(flat, 1, rngFrom('a')).text).toBe('Sparkles');
  });
});
