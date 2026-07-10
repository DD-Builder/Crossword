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

// pickClue is now a craft-WEIGHTED random pick (softmax): better clues stay far
// likelier, but the same answer no longer always yields the same clue — so these
// assert the *distribution* over many seeded picks, not one deterministic winner.
// The rng is seeded, so every proportion below is reproducible, not flaky.
function tally(pick: (rng: ReturnType<typeof rngFrom>) => { text: string }, n = 400): Map<string, number> {
  const counts = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const t = pick(rngFrom(`s-${i}`)).text;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return counts;
}

describe('pickClue — craft-weighted, with variety', () => {
  const e = entry([
    ['Beach edge', 1, 1], // flat, easy
    ['Where the waves break', 2, 4], // witty, still easy
    ['Line drawn in the sand?', 5, 5], // devious
  ]);

  it('Monday overwhelmingly favors the wittiest gettable clue over the flat one', () => {
    const c = tally((rng) => pickClue(e, 1, rng));
    expect(c.get('Where the waves break') ?? 0).toBeGreaterThan(c.get('Beach edge') ?? 0);
    expect(c.get('Where the waves break') ?? 0).toBeGreaterThan(320); // ~4:1+ preference
  });

  it('easy days never exceed tier+1 difficulty (stays gettable)', () => {
    for (let i = 0; i < 50; i++) {
      const c = pickClue(e, 1, rngFrom(`mon-${i}`));
      expect(c.difficulty).toBeLessThanOrEqual(2);
    }
  });

  it('mixes it up: over many picks it does not always return the same clue', () => {
    const distinct = new Set([...tally((rng) => pickClue(e, 2, rng)).keys()]);
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('Saturday overwhelmingly reaches the devious high-craft clue', () => {
    const c = tally((rng) => pickClue(e, 5, rng));
    expect(c.get('Line drawn in the sand?') ?? 0).toBeGreaterThan(360);
  });

  it('falls back to a placeholder when an entry has no clues', () => {
    const c = pickClue({ ...e, clues: [] }, 1, rngFrom('x'));
    expect(c.text).toContain('letters');
  });

  it('prefers higher stars among same-difficulty clues (most of the time)', () => {
    const flat = entry([['Dull', 1, 1], ['Sparkles', 1, 4]]);
    const c = tally((rng) => pickClue(flat, 1, rng));
    expect(c.get('Sparkles') ?? 0).toBeGreaterThan(360);
  });

  it('nudges toward the preferred register without forcing it', () => {
    const e2: BankEntry = {
      answer: 'ICE', score: 70, categories: ['science-nature'], tags: [],
      clues: [
        { text: 'Rink surface', difficulty: 1, stars: 3, register: 'classic' },
        { text: 'What breaks at parties', difficulty: 1, stars: 3, register: 'modern' },
      ],
    };
    const modern = tally((rng) => pickClue(e2, 1, rng, { register: 'modern' }));
    const classic = tally((rng) => pickClue(e2, 1, rng, { register: 'classic' }));
    // Majority (not all) go to the matching register — a nudge, not a lock.
    expect(modern.get('What breaks at parties') ?? 0).toBeGreaterThan(260);
    expect(classic.get('Rink surface') ?? 0).toBeGreaterThan(260);
    expect(modern.get('Rink surface') ?? 0).toBeGreaterThan(0); // still shows sometimes
  });

  it('rotates among comparable gems, reusing one only if it must', () => {
    const twoGems = entry([['Gem A', 1, 4], ['Gem B', 1, 4]]);
    // With one gem marked recent, the fresh one of equal craft wins the vast majority.
    const c = tally((rng) => pickClue(twoGems, 1, rng, { recent: new Set(['Gem A']) }));
    expect(c.get('Gem B') ?? 0).toBeGreaterThan(360);
    // A standout gem still usually shows over a dull fresh clue (craft > rotation).
    const mixed = entry([['Dull', 1, 1], ['Sparkles', 1, 4]]);
    const m = tally((rng) => pickClue(mixed, 1, rng, { recent: new Set(['Sparkles']) }));
    expect(m.get('Sparkles') ?? 0).toBeGreaterThan(m.get('Dull') ?? 0);
  });
});
