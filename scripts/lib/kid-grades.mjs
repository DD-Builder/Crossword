// Kid-safety screening for the kids content pipeline (build-time). There is no
// single difficulty ladder for kids anymore — kids puzzles are one merged pool,
// rated with the same 1–5 difficulty/stars fields as the grown-up bank, and
// selected by the same craft-weighted `pickClue` at a fixed easy tier. What
// this module still does is answer two build-time questions:
//   1. Is this WORD ok to ever show a child? (`kidSafe`)
//   2. Does this CLUE TEXT read like an adult reference — a name, place, or
//      title a kid can't have? (`looksLikeReference`) Such a clue gets its
//      difficulty bumped up in the authoring script so the Kids tier's low
//      `clueCap` excludes it, the same lever that keeps Monday gettable.

import { daleChall } from 'dale-chall';

export const DALE_CHALL = new Set(daleChall.map((w) => w.toUpperCase()));

/** Is this word kid-safe enough to ever show a child? (Familiar, or short and
 * plain.) Proper-noun-ish / very long unfamiliar words are rejected upstream. */
export function kidSafe(word) {
  const w = word.toUpperCase();
  return DALE_CHALL.has(w) || w.length <= 4; // short words are almost always fine
}

/** Is a clue word familiar vocabulary? Checks the Dale–Chall list, forgiving the
 * regular inflections it doesn't list separately — so "bakers"/"baker's" counts
 * as the familiar "baker", not a mystery proper noun. */
function familiar(low) {
  const U = low.toUpperCase();
  if (DALE_CHALL.has(U)) return true;
  for (const [suf, keep] of [['S', 1], ['ES', 2], ['ED', 2], ['ING', 3], ['ER', 2], ['LY', 2]]) {
    if (U.length - keep >= 2 && U.endsWith(suf) && DALE_CHALL.has(U.slice(0, -keep))) return true;
  }
  return false;
}

/** Does this clue read like an adult reference — a name, place, or title a kid
 * can't have? A capitalized word whose lowercase form isn't familiar vocabulary
 * is exactly that (the sentence's first word is capitalized by grammar, so it
 * only counts when it's *also* unfamiliar — "Charteris creation" trips on
 * Charteris, "First number" does not on First). Dotted abbreviations (N.C.,
 * Mt.) and long unfamiliar words trip it too. */
export function looksLikeReference(text) {
  if (/[A-Z]\.[A-Z]\.?/.test(text) || /\b(Mt|St|Ft|Dr|Ave|Rd)\.\s/.test(text)) return true;
  const words = text.match(/[A-Za-z][A-Za-z.'-]*/g) ?? [];
  for (const raw of words) {
    const low = raw.toLowerCase().replace(/[^a-z]/g, '');
    if (low.length < 3) continue;
    const known = familiar(low);
    const capitalized = /^[A-Z]/.test(raw);
    if (capitalized && !known && raw !== 'I') return true;
    if (!known && low.length >= 8) return true;
  }
  return false;
}
