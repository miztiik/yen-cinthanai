# Generator Pipeline

**Last Updated**: 2026-07-02

Build-time only (tools/, Python, CI). Pipes and filters, one Pydantic model per arrow, JSONL log to `.logs/build-<date>.jsonl`. No runtime backend; no in-browser solver in v1 (WASM allowed later if it enriches play).

## Story-first served bank (the shipped bank)

The served daily bank (`frontend/public/puzzles/<date>-<tier>.json` + `index.json`) is DERIVED from the story-first matrix generator (`generate_story`) for ALL FOUR tiers - the served puzzle IS the story-first master (narrative + full-sentence clues; solutions ship in the manifest by design). The bank-build CLI's served-puzzle writer (`write_puzzle`) calls `generate_story(date, tier, variant=1)`, emits canonical one-line JSON with `exclude_none` (NO null optionals), and records `sha = sha256(canonical text)` in the BankIndex so a rebuild is byte-identical. `shapeId` is always `grid` (the story matrix); `schemaVersion` stays `1` (the story-first fields are additive optionals - Expand phase).

Per-tier dimension budget comes from `config/tiers.json` (`categories`, subject first); the tier's `band` + `indir` (indirection budget) drive acceptance. EASY declares `indir = [0, 0]` - the all-direct tutorial: the variety/share cap is exempt and any indirect clue is rejected, so easy emits an all-eq grid (in band, zero-guess). Standard/sharp/expert keep the share cap (they declare a non-zero indirection budget). Numeric (numDiff/threshold) + compound (oneOf/oneEachOf/ifThen) clues are tier-gated by each `clueTemplate.minTier`. Acceptance requires: in band, zero-guess (the forced trace reaches every non-anchor cell), eq present + a single-clue eq opener, and (when the tier gates one in) a numeric clue - see `_story_acceptable`.

The classic seating/grid/round-table CP-SAT engine (`generate` -> `to_manifest`, shape-registry driven) is RETAINED and unit-tested (reversibility + the shape seam), but the served bank no longer uses it. The daily bot is add-only: an existing dated file is FROZEN (re-hashed, never regenerated) unless `--force`; the one-time story-first migration reseeded the whole served range with `--force`.

## Stages

```text
config/tiers.toml + config/dials.toml + glyph manifest + date
  -> bake_glyphs.py walks the asset tree -> GlyphManifest (every build)
  -> date-seed picks DIMENSIONS from the manifest packs + values from the full pool
  -> seed (PRNG + CP-SAT seed) -> sample full bijective solution
  -> enumerate clues true under solution -> select weighted subset
  -> verify uniqueness -> prune to minimal -> template clueText
  -> emit PuzzleManifest + sha256 -> ADD-ONLY into BankIndex (existing dated files frozen)
```

## Auto-discovered dimensions + add-only freeze

Puzzle DIMENSIONS are derived from the GlyphManifest packs (every `<pack>/` folder except the structural `abstract` seat-numerals), and which folders + values fill a tier are DATE-SEEDED from the full pool - so a new collection folder joins the rotation with no code change, and each day draws a different slice (diversity). `config/dials.toml [tier.X]` carries only `shape` + `nominal`/`shared` counts; `build_categories` reads the manifest, not a hardcoded category list. The solver is glyph-agnostic, so selection never changes uniqueness/difficulty - only the skin. Puzzles are ADD-ONLY: an existing dated file is FROZEN (never regenerated), so expanding packs can't invalidate a shipped puzzle; `--force` overrides for a one-time migration.

## CP-SAT model (4x3 bijective grid)

Vars `x[c][k]` = position of value k in category c, domain 0..3; `AddAllDifferent` per category; position is identity. Clauses: eq `==`, neq `!=`, ends `in {0,N-1}`, adjacent `|d|=1`, distance:k `|d|=k`, before `<`. Determinism: `num_search_workers=1`, fixed `random_seed`.

## Uniqueness + prune

solve -> sol1; forbid that exact assignment via reified bools, Not(And); re-solve must be INFEASIBLE (2-solve cap). seed = `sha256(date + ":" + tier)[:8]`. Prune: shuffle, drop each clue if remainder stays unique, to fixpoint = minimal. Canonical JSON (sort_keys, ASCII) -> sha; CI rebuild must match.

## Pins (tools/requirements.txt)

python 3.12 | ortools 9.15.6755 | pydantic 2.11 | pytest 8.3. Config baked to public/config/*.json by tools/bake_config.py (one build language).

## CI (.github/workflows/daily.yml)

cron `0 0 * * *` + dispatch -> setup-python -> backfill the last 7 days easy/standard/sharp/expert (STORY-FIRST via the served-puzzle writer, add-only; existing dated files frozen, never future) -> vite build base /yen-cinthanai/ (prebuild rebakes the GlyphManifest) -> Pages. Past days commit back; bank accretes.

## See also

- [../contracts/schemas.md](../contracts/schemas.md) - manifest/bank output.
- [../../concepts/difficulty-and-scoring.md](../../concepts/difficulty-and-scoring.md) - reject-if-out-of-band.
- [../../how-to/ship-to-github-pages.md](../../how-to/ship-to-github-pages.md) - deploy.
