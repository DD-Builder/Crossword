import { describe, expect, it } from 'vitest';
import { validateProposals } from './themegen.ts';

describe('validateProposals', () => {
  it('accepts well-formed entries and normalizes answers', () => {
    const out = validateProposals({
      entries: [
        { answer: 'sour dough!', clue: 'Bread with a tangy attitude', category: 'entertainment', stars: 4 },
        { answer: 'LEVAIN', clue: 'Starter culture, to a baker', category: 'science-nature', stars: 3 },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0]!.answer).toBe('SOURDOUGH');
  });

  it('drops malformed, leaking, and duplicate entries', () => {
    const out = validateProposals({
      entries: [
        { answer: 'AB', clue: 'Too short to place', category: 'wordplay', stars: 2 },          // len < 3
        { answer: 'OVEN', clue: 'An oven, plainly', category: 'wordplay', stars: 2 },           // leaks answer
        { answer: 'CRUST', clue: 'Edge of the loaf', category: 'not-a-category', stars: 9 },    // repaired fields
        { answer: 'CRUST', clue: 'Pizza perimeter', category: 'entertainment', stars: 3 },      // duplicate
        { answer: 'THISANSWERISWAYTOOLONGTOFIT', clue: 'Nope', category: 'wordplay', stars: 1 },
        'garbage',
        null,
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.answer).toBe('CRUST');
    expect(out[0]!.category).toBe('wordplay'); // unknown category repaired to fallback
    expect(out[0]!.stars).toBe(5);             // 9 clamped to 5
  });

  it('returns empty for non-object payloads', () => {
    expect(validateProposals(null)).toEqual([]);
    expect(validateProposals('text')).toEqual([]);
    expect(validateProposals({ nope: [] })).toEqual([]);
  });
});
