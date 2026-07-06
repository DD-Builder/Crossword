import { describe, expect, it } from 'vitest';
import { validatePuzzle, assertValid } from './validate/validator';
import { MINI_FIXTURE } from './fixtures.test-data';
import type { Puzzle } from './types.ts';

const clone = (): Puzzle => structuredClone(MINI_FIXTURE);

const errorsOf = (p: Puzzle) => validatePuzzle(p).filter((x) => x.level === 'error');

describe('validatePuzzle', () => {
  it('accepts the valid fixture', () => {
    expect(errorsOf(MINI_FIXTURE)).toEqual([]);
    expect(() => assertValid(MINI_FIXTURE)).not.toThrow();
  });

  it('flags asymmetric block patterns', () => {
    const p = clone();
    p.grid = ['#SPA#', 'SHONE', 'TONER', 'ARENA', '#ESTX'];
    expect(errorsOf(p).some((e) => e.message.includes('symmetric'))).toBe(true);
  });

  it('flags clue/grid answer mismatches', () => {
    const p = clone();
    p.clues.across[0]!.answer = 'SPY';
    expect(errorsOf(p).some((e) => e.message.includes('≠ grid answer'))).toBe(true);
  });

  it('flags missing clues', () => {
    const p = clone();
    p.clues.down = p.clues.down.slice(1);
    expect(errorsOf(p).some((e) => e.message.includes('No clue for'))).toBe(true);
  });

  it('flags orphan clues with no slot', () => {
    const p = clone();
    p.clues.across.push({ num: 99, answer: 'XYZ', clue: 'Nothing', stars: 1, category: 'wordplay' });
    expect(errorsOf(p).some((e) => e.message.includes('no matching slot'))).toBe(true);
  });

  it('flags answers leaking into clue text', () => {
    const p = clone();
    p.clues.across[1]!.clue = 'It shone brightly';
    expect(errorsOf(p).some((e) => e.message.includes('leaks'))).toBe(true);
  });

  it('flags inflected answer leaks', () => {
    const p = clone();
    p.clues.down[1]!.clue = 'A pone, pluralized'; // PONES via stem PONE
    expect(errorsOf(p).some((e) => e.message.includes('leaks'))).toBe(true);
  });

  it('flags duplicate answers', () => {
    const p = clone();
    // Turn 8-Across EST into SPA's duplicate? Simplest: corrupt the grid so
    // two slots read the same. Change row4 EST → SPA.
    p.grid = ['#SPA#', 'SHONE', 'TONER', 'ARENA', '#SPA#'];
    const errs = errorsOf(p);
    expect(errs.some((e) => e.message.includes('duplicates'))).toBe(true);
  });

  it('flags bad stars and categories', () => {
    const p = clone();
    (p.clues.across[0] as { stars: number }).stars = 9;
    (p.clues.down[0] as { category: string }).category = 'vibes';
    const errs = errorsOf(p);
    expect(errs.some((e) => e.message.includes('stars'))).toBe(true);
    expect(errs.some((e) => e.message.includes('category'))).toBe(true);
  });

  it('flags theme entries missing from the grid', () => {
    const p = clone();
    p.theme = { name: 'Test', entries: ['MISSING'] };
    expect(errorsOf(p).some((e) => e.message.includes('Theme entry'))).toBe(true);
  });

  it('flags disconnected grids', () => {
    const p = clone();
    p.grid = ['SPA##', 'HON##', 'O##ER', '##ENA', '##EST'];
    expect(errorsOf(p).some((e) => e.message.includes('connected'))).toBe(true);
  });

  it('flags bad dates and difficulty', () => {
    const p = clone();
    p.date = 'July 4';
    p.difficulty = 12;
    const errs = errorsOf(p);
    expect(errs.some((e) => e.message.includes('YYYY-MM-DD'))).toBe(true);
    expect(errs.some((e) => e.message.includes('difficulty'))).toBe(true);
  });
});
