// Grade-leveling for kids content (build-time). There is no perfect free grade
// map for arbitrary words, so we combine the signals that actually track child
// vocabulary: the New Dale–Chall list (words familiar to 4th-graders — our
// kid-safety gate and a strong "grade ≤ 4" signal), word length, and a syllable
// estimate. General adult frequency is deliberately NOT used — it ranks
// "government" above "cat", which is backwards for kids.
//
// Grades are 0 (Kindergarten) … 5 (fifth grade). The scale is monotonic and
// tunable: what matters is that K gets the shortest, most familiar words with
// the simplest clues, and older grades unlock longer/rarer words and wittier
// clues — never the reverse.

import { daleChall } from 'dale-chall';

export const DALE_CHALL = new Set(daleChall.map((w) => w.toUpperCase()));

/** Rough syllable count — vowel groups, with a silent-e nudge. */
function syllables(w) {
  const s = w.toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return 1;
  let n = (s.match(/[aeiouy]+/g) ?? []).length;
  if (s.endsWith('e') && n > 1) n -= 1;
  return Math.max(1, n);
}

/** Is this word kid-safe enough to ever show a child? (Familiar, or short and
 * plain.) Proper-noun-ish / very long unfamiliar words are rejected upstream. */
export function kidSafe(word) {
  const w = word.toUpperCase();
  return DALE_CHALL.has(w) || w.length <= 4; // short words are almost always fine
}

/** Grade level (0–5) a word's *vocabulary* suits. Familiar (Dale–Chall) words
 * are graded gently by length — HOUSE and APPLE are kindergarten sight words,
 * not "grade 2" just for having five letters. Unfamiliar words start higher.
 * A third-plus syllable nudges it up. */
export function wordGrade(word) {
  const w = word.toUpperCase();
  const L = w.length;
  let g;
  if (DALE_CHALL.has(w)) {
    g = L <= 4 ? 0 : L <= 5 ? 1 : L <= 6 ? 2 : L <= 7 ? 3 : 4;
  } else {
    g = L <= 5 ? 3 : L <= 6 ? 4 : 5; // common-but-not-familiar → older grades
  }
  if (syllables(w) >= 3) g += 1;
  return Math.min(5, Math.max(0, g));
}

/** The youngest grade a clue's *solve-difficulty tier* suits. A gimme (tier 1)
 * is fine for the littlest solvers; wittier/harder clues are gated to older
 * grades. (Reading level of individual clue words is deliberately NOT gated —
 * length is a poor proxy for it: a five-year-old reads "purring pet" fine.) */
function tierFloor(difficulty) {
  return [0, 0, 1, 3, 4, 5][Math.min(5, Math.max(1, difficulty))];
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

/** Reading grade of the clue's *text* — independent of how hard the answer is to
 * deduce. The thing that makes a clue too old for a little kid is usually a
 * reference they can't have: a name, place, or title. A capitalized word whose
 * lowercase form isn't familiar vocabulary is exactly that (the sentence's first
 * word is capitalized by grammar, so it only counts when it's *also* unfamiliar —
 * "Charteris creation" trips on Charteris, "First number" does not on First).
 * A long unfamiliar word raises it more mildly. */
function clueTextGrade(text) {
  // Dotted abbreviations (N.C., U.S., Mt.) read as adult shorthand and slip past
  // the word scan below (their letters strip to a sub-3 stub), so catch them here.
  if (/[A-Z]\.[A-Z]\.?/.test(text) || /\b(Mt|St|Ft|Dr|Ave|Rd)\.\s/.test(text)) return 3;
  const words = text.match(/[A-Za-z][A-Za-z.'-]*/g) ?? [];
  let g = 0;
  for (const raw of words) {
    const low = raw.toLowerCase().replace(/[^a-z]/g, '');
    if (low.length < 3) continue;
    const known = familiar(low);
    const capitalized = /^[A-Z]/.test(raw);
    if (capitalized && !known && raw !== 'I') g = Math.max(g, 3); // a proper-noun reference
    else if (!known && low.length >= 8) g = Math.max(g, 2); // a long, unfamiliar word
  }
  return g;
}

/** Youngest grade a clue suits: the harder of its solve-difficulty tier and its
 * text's reading level. The answer's vocabulary is graded separately (entry
 * `grade`) and gated separately by the loader, so it is NOT folded in — otherwise
 * a five-letter sight word like HOUSE could never carry a kindergarten clue and
 * the littlest grids would fail to fill. A clue may suit several grades; this is
 * the youngest. */
export function clueGrade(answer, clueText, difficulty) {
  return Math.min(5, Math.max(tierFloor(difficulty), clueTextGrade(clueText)));
}

export const GRADE_LABELS = ['Kindergarten', '1st grade', '2nd grade', '3rd grade', '4th grade', '5th grade'];
