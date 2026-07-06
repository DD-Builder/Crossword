# Riddle Crossword

A local-first crossword puzzle game with clever, original clues — daily
puzzles on the traditional Monday→Sunday difficulty ramp, an on-device
puzzle generator, themed puzzles on any topic, a gloriously 90s kids mode,
speed challenges, and a stats engine that learns what you love.

Built web-first with **zero runtime dependencies** (Vite + TypeScript,
no framework), and Capacitor-ready for an iOS App Store release.

**▶ Play it: https://dd-builder.github.io/Crossword/** — deployed from
`main` by `.github/workflows/deploy.yml` (one-time setup: repo Settings →
Pages → Source: "GitHub Actions"). Installable as a PWA: on iPad/iPhone,
Share → *Add to Home Screen* for the full-screen, offline app.

## Play

- **The Daily & The Mini** — date-seeded daily puzzles; Monday is gentle,
  Saturday is diabolical, Sunday is big and themed. Streaks, archive
  calendar, midnight rollover.
- **Free Play** — pick a size (5×5 → 15×15) and difficulty; the engine
  constructs a fresh, symmetric, fully-checked grid on demand.
- **Themed** — seasonal packs (Halloween, the World Cup, back-to-school…)
  or type *any* topic. With your own AI key (Anthropic / OpenAI / Gemini /
  xAI / any OpenAI-compatible endpoint) the app generates bespoke themed
  entries and clues, then builds and verifies the grid locally. Without a
  key it matches your theme against the tagged word bank.
- **Kids Corner** — grade-tuned minis (K–8) with seasonal/event/category
  themes, wrapped in a Lisa Frank-inspired neon-rainbow skin.
- **Speed Challenge** — race par time with a ghost of your personal best.

## Solving

Full hardware-keyboard support (NYT-parity): arrows navigate, Space flips
direction, Tab jumps clues, smart cursor skips filled cells. Touch-first
layout with a custom soft keyboard on phones (no `<input>` elements — no
autocorrect fights). Pencil mode, autocheck, check/reveal ladder, pause,
and **Professor Down's six-tier hint ladder**: category whisper →
warmer/colder → first letter → vowel peek → anagram scramble → reveal.

Every clue carries a 1–5★ craft rating and a Trivial Pursuit-style
category. The stats page tracks solve times by weekday, category accuracy,
hint reliance, streaks, and personal bests — and a clamped, light-touch
adaptive layer nudges *generated* puzzles toward the categories you enjoy
(dailies are identical for everyone).

## Develop

```bash
npm install
npm run dev        # dev server
npm test           # vitest + data validators + boundary checks
npm run test:e2e   # Playwright smoke (solves a real puzzle)
npm run test:all   # everything
```

Authoring tools:

```bash
npm run fill -- --size 15 --seed 3        # offline grid fills
npm run fill -- --smoke                   # wordbank fill-health gate
node scripts/author-minis.mjs             # regenerate the mini library
node scripts/mirror-template.mjs '....#'… # design symmetric templates
```

### Architecture

- `src/core/` — pure engine (grid math, seeded RNG, backtracking filler
  with bitset candidate indexes, validator, .ipuz import/export). No DOM.
- `src/data/` — the original, hand-curated word/clue bank (every clue is
  written for this project), grid templates, and the puzzle library.
  All content is gated by validators that recompute puzzle structure
  from the grid and cross-check every clue.
- `src/solve/` — the solve-state machine, hint ladder, speed mode.
- `src/ui/`, `src/app/` — dumb views over small observable stores.
- `src/stats/` — IndexedDB event store + derived metrics + adaptive layer.
- `src/llm/` — provider-agnostic chat adapter for the theme engine.

### iOS (later)

```bash
npm run ios:init && npm run ios:sync && npm run ios:open
```

The app is a PWA (offline-capable service worker, icons, manifest) and the
same build wraps in Capacitor for the App Store — the path proven by this
repo's sibling, Math-Warriors.
