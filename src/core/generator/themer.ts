/** Local theme matching: score bank entries against a free-text theme by
 * token overlap with tags, categories, and the answer itself. Used as the
 * offline path for typed-in themes and to pick entries for curated packs. */

import type { BankEntry, Category } from '../types.ts';

/** Small synonym table folding common theme phrasings onto bank tags. */
const TAG_SYNONYMS: Record<string, string[]> = {
  christmas: ['xmas', 'holiday', 'holidays', 'santa', 'noel', 'yule', 'yuletide'],
  halloween: ['spooky', 'scary', 'october', 'ghosts', 'pumpkin'],
  thanksgiving: ['turkey', 'harvest', 'gratitude', 'november', 'pilgrims'],
  summer: ['beach', 'vacation', 'sunshine', 'july', 'august', 'surf'],
  winter: ['snow', 'cold', 'ski', 'frost', 'december', 'january'],
  spring: ['bloom', 'garden', 'april', 'may', 'easter'],
  july4: ['independence', 'fireworks', 'america', 'patriotic', 'fourth'],
  olympics: ['olympic', 'games', 'medals', 'athletes'],
  worldcup: ['soccer', 'football', 'fifa'],
  election: ['voting', 'campaign', 'ballot', 'president'],
  valentines: ['valentine', 'love', 'romance', 'hearts', 'february'],
  newyear: ['resolution', 'january', 'midnight', 'countdown'],
  food: ['cooking', 'baking', 'cuisine', 'kitchen', 'recipes', 'chef', 'eating'],
  music: ['songs', 'bands', 'concert', 'instruments', 'singing'],
  movies: ['film', 'films', 'cinema', 'hollywood', 'oscars'],
  sports: ['athletics', 'teams', 'ballgame'],
  science: ['physics', 'chemistry', 'biology', 'lab', 'space', 'astronomy'],
  animals: ['pets', 'wildlife', 'zoo', 'creatures', 'dogs', 'cats', 'birds'],
  travel: ['trips', 'tourism', 'geography', 'wanderlust', 'passport'],
  tech: ['computers', 'internet', 'gadgets', 'coding', 'digital'],
  books: ['reading', 'novels', 'literature', 'library', 'authors'],
  art: ['painting', 'artists', 'museum', 'sculpture'],
  history: ['ancient', 'historical', 'past', 'empire'],
  nature: ['outdoors', 'plants', 'flowers', 'trees', 'weather'],
  school: ['classroom', 'teachers', 'students', 'education', 'learning'],
};

const CATEGORY_HINTS: Record<Category, string[]> = {
  geography: ['geography', 'maps', 'countries', 'cities', 'places', 'world'],
  entertainment: ['entertainment', 'celebrity', 'tv', 'shows', 'pop'],
  history: ['history', 'historical', 'ancient', 'wars', 'presidents'],
  'arts-literature': ['literature', 'books', 'poetry', 'art', 'writing', 'theology', 'philosophy'],
  'science-nature': ['science', 'nature', 'biology', 'space', 'weather', 'animals'],
  'sports-leisure': ['sports', 'games', 'leisure', 'fitness', 'hobbies'],
  wordplay: ['words', 'puns', 'language', 'puzzles'],
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/** Expand a free-text theme into a weighted set of matchable tokens. */
export function themeTokens(theme: string): Map<string, number> {
  const tokens = new Map<string, number>();
  for (const token of tokenize(theme)) {
    tokens.set(token, 1);
    // singular/plural folding
    if (token.endsWith('s')) tokens.set(token.slice(0, -1), 0.9);
    for (const [tag, syns] of Object.entries(TAG_SYNONYMS)) {
      if (token === tag || syns.includes(token)) tokens.set(tag, 1);
    }
  }
  return tokens;
}

/** Score how strongly an entry matches the theme tokens (0 = unrelated). */
export function themeAffinity(entry: BankEntry, tokens: Map<string, number>): number {
  let score = 0;
  for (const tag of entry.tags) {
    const w = tokens.get(tag);
    if (w) score += 2.5 * w;
  }
  for (const cat of entry.categories) {
    for (const hint of CATEGORY_HINTS[cat] ?? []) {
      const w = tokens.get(hint);
      if (w) score += 0.75 * w;
    }
  }
  const answerLower = entry.answer.toLowerCase();
  for (const [token, w] of tokens) {
    if (token.length >= 4 && answerLower.includes(token)) score += 1.5 * w;
  }
  return score;
}

export interface ThemeMatch {
  /** Seed answers to place first, best matches first. */
  seeds: string[];
  /** Category multipliers to bias the rest of the fill toward the theme. */
  weights: Record<string, number>;
  /** Tag multipliers — the precise theme bias (a soccer theme boosts
   * soccer-tagged answers, not the whole sports-leisure category). */
  tagWeights: Record<string, number>;
  /** 0–1 confidence that the local bank actually covers this theme. */
  confidence: number;
}

export function matchTheme(
  theme: string,
  entries: BankEntry[],
  opts: { maxSeeds?: number; minLen?: number } = {},
): ThemeMatch {
  const tokens = themeTokens(theme);
  const maxSeeds = opts.maxSeeds ?? 6;
  const minLen = opts.minLen ?? 4;

  const scored = entries
    .map((e) => ({ e, s: themeAffinity(e, tokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  const seeds = scored
    .filter((x) => x.e.answer.length >= minLen)
    .slice(0, maxSeeds)
    .map((x) => x.e.answer);

  // Bias the fill toward the theme's actual TAGS, not its broad category —
  // boosting a whole category floods the grid with that category's crosswordese
  // (a soccer theme would pull tennis's ACE/LET from sports-leisure). Only tags
  // that are themselves theme tokens count, so the bias stays on-topic.
  const tagScores = new Map<string, number>();
  for (const { e, s } of scored.slice(0, 40)) {
    for (const t of e.tags) if (tokens.has(t)) tagScores.set(t, (tagScores.get(t) ?? 0) + s);
  }
  const tagWeights: Record<string, number> = {};
  for (const [tag] of [...tagScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)) {
    tagWeights[tag] = 2.2;
  }

  // Keep only a very light category nudge (not enough to flood).
  const catScores = new Map<string, number>();
  for (const { e, s } of scored.slice(0, 40)) {
    for (const c of e.categories) catScores.set(c, (catScores.get(c) ?? 0) + s);
  }
  const weights: Record<string, number> = {};
  const topCat = [...catScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 1);
  for (const [cat] of topCat) weights[cat] = 1.05;

  const confidence = Math.min(1, scored.length / 25);
  return { seeds, weights, tagWeights, confidence };
}
