import { describe, expect, it } from 'vitest';
import { matchTheme, themeAffinity, themeTokens } from './themer.ts';
import type { BankEntry } from '../types.ts';

const entry = (answer: string, categories: BankEntry['categories'], tags: string[]): BankEntry => ({
  answer,
  score: 60,
  categories,
  tags,
  clues: [{ text: 'x', difficulty: 1, stars: 1 }],
});

const BANK: BankEntry[] = [
  entry('TINSEL', ['entertainment'], ['christmas', 'winter']),
  entry('SLEIGH', ['history'], ['christmas', 'winter']),
  entry('CAROL', ['arts-literature'], ['christmas', 'music']),
  entry('BEACH', ['geography'], ['summer', 'travel']),
  entry('SURF', ['sports-leisure'], ['summer']),
  entry('ATOM', ['science-nature'], ['science']),
  entry('SONATA', ['arts-literature'], ['music']),
];

describe('themeTokens', () => {
  it('folds synonyms onto canonical tags', () => {
    const tokens = themeTokens('Santa and yuletide cheer');
    expect(tokens.has('christmas')).toBe(true);
  });

  it('handles plural folding', () => {
    const tokens = themeTokens('beaches');
    expect(tokens.has('beache') || tokens.has('beach')).toBe(true);
  });
});

describe('themeAffinity', () => {
  it('rewards multi-tag matches over single-tag matches', () => {
    const tokens = themeTokens('christmas songs');
    const carol = themeAffinity(BANK[2]!, tokens);   // christmas + music tags
    const tinsel = themeAffinity(BANK[0]!, tokens);  // christmas tag only
    const sonata = themeAffinity(BANK[6]!, tokens);  // music tag only
    expect(carol).toBeGreaterThan(tinsel);
    expect(tinsel).toBeGreaterThanOrEqual(sonata);
    expect(sonata).toBeGreaterThan(0);
  });

  it('gives zero for unrelated entries', () => {
    const tokens = themeTokens('christmas');
    expect(themeAffinity(BANK[5]!, tokens)).toBe(0);
  });
});

describe('matchTheme', () => {
  it('surfaces the right seeds for a seasonal theme', () => {
    const match = matchTheme('christmas', BANK);
    expect(match.seeds.slice(0, 3)).toEqual(
      expect.arrayContaining(['TINSEL', 'SLEIGH', 'CAROL']),
    );
  });

  it('respects minLen', () => {
    const match = matchTheme('summer vacation', BANK, { minLen: 5 });
    expect(match.seeds).toContain('BEACH');
    expect(match.seeds).not.toContain('SURF');
  });

  it('reports low confidence for thin coverage', () => {
    const match = matchTheme('quantum chromodynamics', BANK);
    expect(match.confidence).toBeLessThan(0.3);
  });
});
