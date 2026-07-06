import { describe, expect, it } from 'vitest';
import { fromIpuz, toIpuz } from './ipuz';
import { MINI_FIXTURE } from './fixtures.test-data';
import { validatePuzzle } from './validate/validator';

describe('ipuz round-trip', () => {
  it('exports the expected shape', () => {
    const doc = toIpuz(MINI_FIXTURE);
    expect(doc.kind[0]).toContain('crossword');
    expect(doc.dimensions).toEqual({ width: 5, height: 5 });
    expect(doc.puzzle[0]![0]).toBe('#');
    expect(doc.puzzle[0]![1]).toBe(1); // 1-Across/1-Down starts here
    expect(doc.solution[1]![0]).toBe('S');
    expect(doc.clues.Across).toHaveLength(5);
    expect(doc.clues.Down).toHaveLength(5);
  });

  it('round-trips grid, clues, and metadata', () => {
    const back = fromIpuz(toIpuz(MINI_FIXTURE));
    expect(back.grid).toEqual(MINI_FIXTURE.grid);
    expect(back.id).toBe(MINI_FIXTURE.id);
    expect(back.difficulty).toBe(MINI_FIXTURE.difficulty);
    expect(back.clues.across.map((c) => c.answer)).toEqual(
      MINI_FIXTURE.clues.across.map((c) => c.answer),
    );
    expect(back.clues.down.map((c) => [c.clue, c.stars, c.category])).toEqual(
      MINI_FIXTURE.clues.down.map((c) => [c.clue, c.stars, c.category]),
    );
    expect(validatePuzzle(back).filter((p) => p.level === 'error')).toEqual([]);
  });

  it('rejects non-crossword documents', () => {
    const doc = toIpuz(MINI_FIXTURE);
    doc.kind = ['http://ipuz.org/sudoku#1'];
    expect(() => fromIpuz(doc)).toThrow(/Not an ipuz crossword/);
  });
});
