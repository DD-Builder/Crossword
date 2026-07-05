import { describe, expect, it } from 'vitest';
import {
  deriveSlots,
  isConnected,
  isFullyChecked,
  isSymmetric,
  minSlotLength,
  slotAnswer,
  templateToGrid,
} from './grid.ts';
import { MINI_FIXTURE } from './fixtures.test-data';

const GRID = MINI_FIXTURE.grid;

describe('deriveSlots', () => {
  it('numbers slots NYT-style', () => {
    const info = deriveSlots(GRID, 3);
    const across = info.slots.filter((s) => s.dir === 'across').map((s) => s.num);
    const down = info.slots.filter((s) => s.dir === 'down').map((s) => s.num);
    expect(across).toEqual([1, 4, 6, 7, 8]);
    expect(down).toEqual([1, 2, 3, 4, 5]);
  });

  it('reads answers from the grid', () => {
    const info = deriveSlots(GRID, 3);
    const answers = info.slots.map((s) => slotAnswer(GRID, s)).sort();
    expect(answers).toEqual(
      ['ANENT', 'ARENA', 'ERA', 'EST', 'PONES', 'SHONE', 'SHORE', 'SPA', 'STA', 'TONER'].sort(),
    );
  });

  it('maps every white cell to its across and down slots', () => {
    const info = deriveSlots(GRID, 3);
    expect(info.cellSlots[1]![1]).toEqual(['4-across', '1-down']);
    expect(info.cellSlots[0]![1]).toEqual(['1-across', '1-down']);
  });

  it('rejects ragged grids', () => {
    expect(() => deriveSlots(['AB', 'A'])).toThrow(/Ragged/);
  });
});

describe('grid predicates', () => {
  it('detects symmetry', () => {
    expect(isSymmetric(GRID)).toBe(true);
    expect(isSymmetric(['#AB', 'CDE', 'FGH'])).toBe(false);
  });

  it('detects connectivity', () => {
    expect(isConnected(GRID)).toBe(true);
    // Two islands split by a block column.
    expect(isConnected(['A#B', 'A#B', 'A#B'])).toBe(false);
  });

  it('detects unchecked cells', () => {
    expect(isFullyChecked(GRID, 3)).toBe(true);
    // 3x3 open grid: every slot len 3, all checked.
    expect(isFullyChecked(['ABC', 'DEF', 'GHI'], 3)).toBe(true);
  });

  it('computes min slot length', () => {
    expect(minSlotLength(GRID)).toBe(3);
  });
});

describe('templateToGrid', () => {
  it('places blocks', () => {
    expect(templateToGrid(3, [[0, 0], [2, 2]])).toEqual(['#..', '...', '..#']);
  });
  it('rejects out-of-bounds blocks', () => {
    expect(() => templateToGrid(3, [[3, 0]])).toThrow(/out of bounds/);
  });
});
