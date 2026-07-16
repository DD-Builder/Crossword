/** Heuristic clue-style classification, derived purely from clue text — no
 * wordbank content changes needed. This is a proxy for "what kind of clue is
 * this," not a real constructor-assigned mechanic tag (anagram/hidden-word/
 * etc.); that would require tagging the ~83,000-clue wordbank by hand, a
 * separate content project. Mirrors the heuristic style already used in
 * scripts/audit-clue-quality.mjs (craftScore) and scripts/lib/kid-grades.mjs
 * (looksLikeReference) — regex signals over the clue text, nothing fancier. */

export const CLUE_STYLES = [
  'quoted',
  'fill-in-blank',
  'wordplay-wink',
  'abbreviation',
  'straight-definition',
] as const;

export type ClueStyle = (typeof CLUE_STYLES)[number];

export const CLUE_STYLE_LABELS: Record<ClueStyle, string> = {
  quoted: 'Quoted & pop culture',
  'fill-in-blank': 'Fill-in-the-blank',
  'wordplay-wink': 'Wordplay wink ("?")',
  abbreviation: 'Abbreviations',
  'straight-definition': 'Straight definition',
};

const BLANK_RE = /_{2,}|\bblank\b/i;
const ABBR_RE = /\b[A-Z]{2,}\b|Abbr\.|for short/;

/** Classify a clue's surface style from its text. Order matters — first
 * match wins. Quoted phrases and pop-culture lines outrank a trailing "?"
 * since a quoted clue's skill (cultural recall) is distinct from a cryptic
 * wink, and the two rarely co-occur anyway. */
export function classifyClueStyle(text: string): ClueStyle {
  if (/["']/.test(text)) return 'quoted';
  if (BLANK_RE.test(text)) return 'fill-in-blank';
  if (/\?/.test(text)) return 'wordplay-wink';
  if (ABBR_RE.test(text)) return 'abbreviation';
  return 'straight-definition';
}
