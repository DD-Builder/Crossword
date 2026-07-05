/** Wordbank candidate index: per-length bitset masks over (position, letter)
 * so a partial pattern's candidate set is the AND of a few bitsets. */

import type { BankEntry } from '../types.ts';

const A = 'A'.charCodeAt(0);

export interface LengthIndex {
  /** Entries of this length, sorted by score descending. */
  entries: BankEntry[];
  /** masks[pos][letter] — bitset over `entries` of words with `letter` at `pos`. */
  masks: Uint32Array[][];
  /** Bitset words needed to cover entries.length bits. */
  stride: number;
}

export interface BankIndex {
  byLen: Map<number, LengthIndex>;
  byAnswer: Map<string, BankEntry>;
}

export function buildIndex(entries: BankEntry[]): BankIndex {
  const byLenRaw = new Map<number, BankEntry[]>();
  const byAnswer = new Map<string, BankEntry>();
  for (const e of entries) {
    if (byAnswer.has(e.answer)) continue; // dedupe defensively
    byAnswer.set(e.answer, e);
    const list = byLenRaw.get(e.answer.length) ?? [];
    list.push(e);
    byLenRaw.set(e.answer.length, list);
  }

  const byLen = new Map<number, LengthIndex>();
  for (const [len, list] of byLenRaw) {
    list.sort((a, b) => b.score - a.score);
    const stride = Math.ceil(list.length / 32) || 1;
    const masks: Uint32Array[][] = Array.from({ length: len }, () =>
      Array.from({ length: 26 }, () => new Uint32Array(stride)),
    );
    list.forEach((entry, i) => {
      for (let pos = 0; pos < len; pos++) {
        const letter = entry.answer.charCodeAt(pos) - A;
        masks[pos]![letter]![i >> 5] = (masks[pos]![letter]![i >> 5]! | (1 << (i & 31))) >>> 0;
      }
    });
    byLen.set(len, { entries: list, masks, stride });
  }
  return { byLen, byAnswer };
}

/** Candidate bitset for a pattern like "A??T" ('?' or '.' = open). Returns
 * null when the whole length bucket matches (no constraint), else a bitset. */
export function patternBits(idx: LengthIndex, pattern: string): Uint32Array | null {
  let acc: Uint32Array | null = null;
  for (let pos = 0; pos < pattern.length; pos++) {
    const ch = pattern[pos]!;
    if (ch === '?' || ch === '.') continue;
    const mask = idx.masks[pos]![ch.charCodeAt(0) - A]!;
    if (!acc) {
      acc = mask.slice();
    } else {
      for (let w = 0; w < acc.length; w++) acc[w] = (acc[w]! & mask[w]!) >>> 0;
    }
  }
  return acc;
}

export function popcount(bits: Uint32Array): number {
  let count = 0;
  for (let w = 0; w < bits.length; w++) {
    let v = bits[w]!;
    v -= (v >>> 1) & 0x55555555;
    v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
    count += (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
  }
  return count;
}

/** Count candidates matching a pattern (bucket size when unconstrained). */
export function countCandidates(idx: LengthIndex, pattern: string): number {
  const bits = patternBits(idx, pattern);
  return bits ? popcount(bits) : idx.entries.length;
}

/** Iterate candidate entries for a pattern in score-desc order. */
export function* candidates(idx: LengthIndex, pattern: string): Generator<BankEntry> {
  const bits = patternBits(idx, pattern);
  if (!bits) {
    yield* idx.entries;
    return;
  }
  for (let w = 0; w < bits.length; w++) {
    let v = bits[w]!;
    while (v !== 0) {
      const bit = v & -v;
      const i = (w << 5) + (31 - Math.clz32(bit));
      const entry = idx.entries[i];
      if (entry) yield entry;
      v = (v ^ bit) >>> 0;
    }
  }
}
