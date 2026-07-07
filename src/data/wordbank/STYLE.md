# Clue Style Guide

Every clue in this repo is an **original composition written for this
project**. Never copy a clue from a published crossword. Read this before
writing or editing any bank entry or puzzle.

## Voice

The bar is the best of the great dailies: clever beats hard, and **wit
beats obscurity every time**. A solver should finish a clue and smile,
not sigh. No grievance politics of any flavor, no depressing news-cycle
material, no brand-slogan regurgitation. Timeless over trendy, playful
over show-offy.

## The rules

1. **Difficulty lives in the wording, not the trivia.** A hard clue is a
   clever angle on a thing people know ("It has teeth but never eats" →
   ZIPPER), not a footnote from a specialist's almanac.
2. **"?" marks a pun or misdirection** ("Current events? → TIDES").
   Use it honestly: if the surface reading is straight, no question mark.
3. **Fill-in-the-blank** clues are fine at difficulty 1–2, sparingly above.
4. **Abbreviated answers signal it** with "Abbr." or an abbreviated word in
   the clue ("Rail stop: Abbr." → STA).
5. **Plural answer ⇒ plural clue**; tense and part of speech must match.
6. **Never leak the answer**: no form of the answer word (or its obvious
   stem) may appear in its clue. The validator enforces a stem check;
   don't fight it, rewrite the clue.
7. **Crosswordese is a spice, not a stew.** ERNE, ANOA, ESNE score ≤30
   and appear only when a corner truly needs them.
8. **Difficulty tiers** (each len-4+ entry needs ≥2 tiers):
   - d1 (Mon): straight definition. "Glowed" → SHONE
   - d2 (Tue): light color. "Where the tide checks in" → SHORE
   - d3 (Wed): trivia with a wink, mild misdirection.
   - d4 (Fri): real misdirection; the surface reading is a decoy.
   - d5 (Sat): devious but fair — every word earns its place.
9. **Stars (1–5)** rate the clue's craft: how satisfying the aha is.
   A d1 clue can be 1★ ("Glowed") or 3★ if it sparkles. d4–d5 clues
   should be 3–5★; if a hard clue isn't clever, cut it.
10. **Categories** (exactly these): `geography`, `entertainment`,
    `history`, `arts-literature`, `science-nature`, `sports-leisure`,
    `wordplay`. Pick the category of the *clue's angle*, not the word
    itself — SHORE clued via tides is geography; clued via "Jersey ___"
    is entertainment.

## Liveliness — even on Monday

Easy ≠ dull. A Monday clue must be *gettable*, but it should still have a
pulse. The enemy is the flat dictionary definition. Before you write a clue,
ask: "Is this the phrasing a solver has seen a hundred times?" If so, find a
fresher angle — same difficulty, more life.

Techniques that add life without adding difficulty:

- **Be specific and vivid.** Trade the generic label for a concrete image.
  - EGO — dull: "Sense of self." lively: "It can be inflated or bruised."
  - TRAILER — dull: "Movie preview." lively: "Sneak peek at the multiplex."
  - MUG — dull: "Cocoa holder." lively: "It might say 'World's Best Dad'."
- **Clue by example** with "e.g.", "for one", or "say". This is friendly and
  fresh at any level. TEA → "Earl Grey, for one." ERA → "The Jurassic, for one."
- **Colloquial / spoken** clues in quotes signal a phrase. AYE → "'___, Captain!'"
- **A light "?" pun**, used *sparingly* on easy days (one or two a grid), is a
  gift. AVOCADO → "Guac's main squeeze?" ECLIPSE → "When the moon steals the
  show?" HINGE → "Swinging joint?"
- **Cross-reference the world**, not the dictionary. ESTONIA — dull: "Baltic
  republic north of Latvia." lively: "Tallinn's nation."
- **Mind the surface.** The clue should read as a natural phrase, not a lookup.

## Difficulty is re-cluing, not re-answering

The *same answer* carries a different clue by weekday — the grid and fill stay
solvable; only the wording's slyness changes. Keep this ladder in mind:

| answer | Mon (straight, lively) | Wed (a wink) | Sat (devious, fair) |
|--------|------------------------|--------------|---------------------|
| SHORE | "Where the waves break" | "Jersey ___" | "Line you might draw in the sand?" |
| ICE | "Rink surface" | "It breaks at parties" | "Cold shoulder?" |
| NET | "Tennis divider" | "Bottom line, after costs" | "Catch-all?" |

Monday earns its smile through freshness and specificity; Saturday earns it
through misdirection the surface hides. Never reach for obscurity to make a
clue "hard" — reach for a cleverer angle on a thing people already know.

## Entry shape

```jsonc
{ "answer": "ZIPPER", "score": 78,          // 1–100 fill quality
  "categories": ["science-nature"], "tags": ["household", "invention"],
  "clues": [
    { "text": "Jacket fastener", "difficulty": 1, "stars": 1 },
    { "text": "It has teeth but never eats", "difficulty": 4, "stars": 5 }
  ] }
```

`score` guide: 85–100 lively everyday words and grid-friendly gems;
60–84 solid fill; 40–59 fine but dull; ≤30 crosswordese tax bracket.

## Tags worth using

Seasonal/cultural: `christmas`, `halloween`, `thanksgiving`, `summer`,
`winter`, `spring`, `july4`, `olympics`, `worldcup`, `election`,
`valentines`, `newyear`. Topical: `food`, `music`, `movies`, `sports`,
`science`, `animals`, `travel`, `tech`, `books`, `art`, `history`,
`nature`, `school`. Tags drive themed-puzzle selection — tag generously
but honestly.
