# Fill wordlist — provenance & license

`collaborative.dict` is the **Crossword Nexus Collaborative Word List**, filtered
to A–Z answers of length 3–15 (`WORD;score`, score ≈ 10–75, higher = better fill
quality).

- **Source**: https://github.com/Crossword-Nexus/collaborative-word-list
  (`xwordlist.dict`, `main` branch), downloaded 2026-07-07.
- **License**: MIT (see `LICENSE`) — free to use, modify, and redistribute with
  the copyright notice retained. Copyright (c) 2021 Crossword-Nexus.
- **Entries**: 509,173 (filtered from 567,657).

## How it is used — answers only, never clues

This list supplies **answers + fill-quality scores** so the grid filler can
complete fully-checked American grids (the curated bank alone is too small).
**No clue is ever taken from any external source** — every clue in this project
is an original composition (see `src/data/wordbank/STYLE.md`).

It is **build-time only**: loaded by the node authoring/smoke scripts
(`scripts/generate-fill.mjs`, `scripts/author-fulls.mjs`) via
`scripts/lib/bank-node.mjs` `loadFillWordlist()`. It is **not** under `src/` and
is **never bundled into the browser app** — shipped dailies are pre-built JSON,
and live in-browser generation uses only the curated bank.

## Regenerating

```
curl -L https://raw.githubusercontent.com/Crossword-Nexus/collaborative-word-list/main/xwordlist.dict \
  | node scripts/filter-wordlist.mjs > data/fill-wordlist/collaborative.dict
```
