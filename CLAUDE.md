# Riddle Crossword

A local-first crossword puzzle game. Vite + TypeScript, **zero runtime
dependencies** — no framework, no state library. Web first, Capacitor for
iOS later (same path as Math-Warriors).

## Commands

- `npm run dev` — dev server
- `npm test` — Vitest unit tests + all validator scripts
- `npm run build` — validators + production build
- `npm run test:e2e` — Playwright (sandbox Chromium at /opt/pw-browsers)
- `npm run test:all` — everything
- `npm run fill -- --size 15 --seed 3` — offline grid-fill authoring tool

## Architecture rules

- `src/core/**` is **pure**: no DOM, no imports from ui/app/solve/stats/llm.
  Enforced by `scripts/check-boundaries.mjs` (runs in `npm test`).
- Puzzle numbering/slots are always **derived from the grid** via
  `core/grid.ts` — never trusted from clue JSON. `validate-puzzles.mjs`
  recomputes and cross-checks.
- All UI state flows through `solve/session.ts` (solve state machine) and
  small `createStore` observables; views are dumb renderers.
- No `<input>` elements — a document-level keydown dispatcher (`ui/keys.ts`)
  plus a custom soft keyboard handle all typing.
- Theming: components use semantic CSS custom properties from
  `themes/tokens.css` only. Skins override tokens under `[data-skin="…"]`.
- Original content only: every clue and puzzle in `src/data/` is authored
  for this project — never copy clues from published crosswords.

## Content style

See `src/data/wordbank/STYLE.md` before writing or editing any clues.
