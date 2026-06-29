# Difficulty and Scoring

**Last Updated**: 2026-06-29

The difficulty scorer, tier bands, stars, streak, and celebration copy. Tunable values live in `config/`; this doc is the contract for what they mean.

## Scorer

```
D = SIZE + DEPTH + INDIR + ENV
SIZE  = entities * categories
DEPTH = len(hintTrace)                  forced deduction steps
INDIR = round(20 * indirect/N)          N = minimal clue count
ENV   = ATT + HINT + FB
  ATT  unlimited=0 3=4 2=8 1=12
  HINT unlimited=0 2=3 1=6 0=10
  FB   realtime-names=0 count=4 binary-check=8 submit-binary=12
```

A generated puzzle whose D is outside the tier band is rejected and reseeded - the calibration gate, not a vibe.

| Tier | band | E x C | N | indir | attempts | hints | feedback | PAR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Easy | 0-13 | 3x2 | 3-4 | 0.0 | unlimited | unlimited | realtime-names | 90s |
| Standard | 14-39 | 4x3 | 5-7 | .25-.40 | 3 | 2 | count-wrong | 240s |
| Sharp | 48-66 | 5x4 | 9-11 | ~0.0 | 2 | 1 | binary-check | 480s |
| Expert | 96-120 | 6x5 | 14-16 | ~1.0 | 1 | 0 | submit-binary | 900s |

Six glyph packs now ship 6 values each (household, creatures, food, colour) plus the
abstract numerals, so the full grids land: Sharp seats 5 on a row across 4 categories;
Expert seats 6 on a round-table across 5 categories. Their D is structurally pinned by
the grid: Sharp ~57 is SIZE+DEPTH driven and its minimal clue set comes out mostly
direct (eq/ends), so INDIR is ~0; Expert ~108 leans on the ring's wrap relations
(adjacent/opposite/between/neq), which are all indirect, so INDIR saturates at 20
(`round(20*indirect/N)` with indirect==N). Standard adds one shared category (binary
team). INDIR is capped at 20 by construction.

## Stars

1 star = solved. 2 = solved + 0 hints. 3 = solved + 0 hints + 0 wrong + solveMs <= PAR. Best-time (hero) ships alongside stars; a hinted solve never sets best-time.

## Streak (forgiving, D13)

skipsLeft = 1, refills each Monday 00:00 UTC. Miss a day with a skip -> burn it, streak holds, no shame UI. Miss with none -> reset to 0. Hero/streak survive day-prune.

## Stuck-moment

Idle 12s pulse next token (free, uncounted); idle 25s glow the clue chip; wrong x2 same slot highlight conflicting clue; wrong x4 offer replay-confidence. Never sell, never timer-wall.

## Copy bags (config/copy.toml)

50 SUCCESS, 50 ENCOURAGE, 10 HERO, <=22 chars, ASCII, spoiler-free. Examples: SUCCESS "Case closed." / "Airtight." / "Checkmate."; ENCOURAGE "So close." / "One swap from glory."; HERO "NEW RECORD - the board bows." The full bags ship in config, not code.

## See also

- [core-loop.md](core-loop.md) - cadence and tiers.
- [../architecture/generator/pipeline.md](../architecture/generator/pipeline.md) - where D is computed.
- [../architecture/contracts/schemas.md](../architecture/contracts/schemas.md) - stars/par in Save.
