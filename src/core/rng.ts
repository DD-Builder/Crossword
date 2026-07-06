/** Deterministic PRNG utilities — dailies must hash to the same puzzle on
 * every device, so all generation randomness flows through these. */

/** FNV-1a 32-bit hash of a string → uint32. */
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, n). */
  int(n: number): number;
  /** Pick a random element (undefined for empty arrays). */
  pick<T>(arr: readonly T[]): T | undefined;
  /** Fisher–Yates shuffle, in place; returns the array. */
  shuffle<T>(arr: T[]): T[];
}

/** mulberry32 — tiny, fast, good-enough distribution for puzzle jitter. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    pick: (arr) => (arr.length === 0 ? undefined : arr[Math.floor(next() * arr.length)]),
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = arr[i]!;
        arr[i] = arr[j]!;
        arr[j] = tmp;
      }
      return arr;
    },
  };
}

/** Seed an Rng from any string, e.g. "mini|2026-07-06". */
export function rngFrom(key: string): Rng {
  return mulberry32(fnv1a(key));
}
