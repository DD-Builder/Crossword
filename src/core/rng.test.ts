import { describe, expect, it } from 'vitest';
import { fnv1a, mulberry32, rngFrom } from './rng.ts';

describe('fnv1a', () => {
  it('is stable across calls', () => {
    expect(fnv1a('mini|2026-07-06')).toBe(fnv1a('mini|2026-07-06'));
  });
  it('differs across inputs', () => {
    expect(fnv1a('mini|2026-07-06')).not.toBe(fnv1a('mini|2026-07-07'));
    expect(fnv1a('mini|2026-07-06')).not.toBe(fnv1a('full|2026-07-06'));
  });
});

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('int stays in range', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
  });

  it('shuffle is a permutation and deterministic', () => {
    const r1 = rngFrom('shuffle-test');
    const r2 = rngFrom('shuffle-test');
    const a = r1.shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    const b = r2.shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('pick returns undefined only for empty arrays', () => {
    const r = mulberry32(1);
    expect(r.pick([])).toBeUndefined();
    expect([10, 20, 30]).toContain(r.pick([10, 20, 30]));
  });
});
