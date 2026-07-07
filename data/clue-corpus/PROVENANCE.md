# Clue corpus — provenance, license posture & how it is used

This directory holds a **build-time-only** reference corpus of established
crossword clue↔answer pairs. It is scaffolding for authoring — **nothing here
ships to the browser**, and no clue is committed to `src/` verbatim.

## Source

- **`doshea/nyt_crosswords`** — https://github.com/doshea/nyt_crosswords —
  every New York Times crossword since 1977 as JSON (`YYYY/MM/DD.json`), cloned
  2026-07-07. 14,547 puzzles, ~1.23M clue/answer pairs.
- Each puzzle also carries `dow` (day of week), which we use directly as a
  difficulty signal (NYT's Mon→Sat ramp): Mon=1 … Sat=5, Sun=3.

## License posture — personal use, learn-and-transform

The underlying clues are NYT-authored and **not** offered under a reuse license.
This corpus is used here as a **reference base to learn from**, for **personal
use**, per the project owner's explicit direction:

> "Take and learn from that base, and if we ever decide to monetize this game
> for other than personal use, then we can create our own bank."

Accordingly:

- The raw archive (`raw/`) and the distilled `index.json` are **git-ignored**
  (see `.gitignore`) — the copyrighted corpus is never committed to this repo.
- `scripts/author-clues.mjs` runs a **keep / improve / rewrite** transformation
  so the clues that land in `src/data/wordbank/authored-*.json` are edited into
  this project's own voice (`src/data/wordbank/STYLE.md`), not verbatim copies.
- If this game is ever monetized beyond personal use, the authored bank is
  rebuilt from scratch as fully original content and this corpus is dropped.

## Pipeline

1. **Clone** the archive (git-ignored):
   ```
   git clone --depth 1 https://github.com/doshea/nyt_crosswords.git \
     data/clue-corpus/raw/nyt_crosswords
   ```
2. **Ingest** → `index.json` (git-ignored), `{ ANSWER: { n, clues:[{text,count,dow,diff}] } }`:
   ```
   node scripts/ingest-corpus.mjs
   ```
3. **Author** → transformed, validated clues into `src/data/wordbank/authored-*.json`:
   ```
   node scripts/author-clues.mjs
   ```
