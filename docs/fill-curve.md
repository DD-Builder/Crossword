# Fill-success curve vs bank size

The measurement loop behind the fill-tier authoring waves: after every wave,
run `node scripts/generate-fill.mjs --smoke --seeds 50 --json` and append a
row. Authoring stops when American 15×15 holds ≥ 95% at two consecutive
checkpoints (the smoke gates in `generate-fill.mjs` ratchet to match).

American families (`am*`) are fully-checked templates; lattice families
(`lat*`) leave alternate letters unchecked and fill from the curated bank
alone. Rates below are with the production restart ladder (5 attempts,
rising beam/jitter) and `tagWeights: { fill: 0.6 }`.

| checkpoint | bank (3/4/5/6/7/8) | total | am11 | am13 | am15 | notes |
|---|---|---|---|---|---|---|
| baseline (pre-wave, 8 seeds) | 297/612/660/743/444/457 | 3,347 | 0% | 0% | 0% | family split exposes American truth; old mixed smoke passed via lattice |
| wave 1 (+300 len7/8) | 297/612/660/743/594/607 | 3,647 | 0% | 0% | 0% | len7/8 alone doesn't lift American — the binding constraint is len4/5/6 crossing density, confirming the sizing rationale. Waves 2–6 (len4/5/6) are what move the curve. |
| **MIT fill wordlist** | +509,173 answers (Crossword Nexus, build-time) | 3,647 curated + 509k fill | **100%** | **100%** | **100%** | The decisive unlock: a large scored answer list makes fully-checked American 11/13/15 fill at 100% (am15 avg 76ms). buildIndex handles 512k entries in ~0.6s. Curated bank stays the clue-quality tier; the wordlist supplies only answers (all clues original). AC-3/de-beam engine work proved **unnecessary** — the engine just needed candidates. Lattice retired for dailies. |
