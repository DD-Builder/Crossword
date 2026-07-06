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
