# Generator Pipeline

**Last Updated**: 2026-06-30

Build-time only (tools/, Python, CI). Pipes and filters, one Pydantic model per arrow, JSONL log to `.logs/build-<date>.jsonl`. No runtime backend; no in-browser solver in v1 (WASM allowed later if it enriches play).

## Stages

```
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

solve -> sol1; forbid that exact assignment via reified bools, Not(And); re-solve must be INFEASIBLE (2-solve cap). seed = sha256(date+":"+tier)[:8]. Prune: shuffle, drop each clue if remainder stays unique, to fixpoint = minimal. Canonical JSON (sort_keys, ASCII) -> sha; CI rebuild must match.

## Pins (tools/requirements.txt)

python 3.12 | ortools 9.15.6755 | pydantic 2.11 | pytest 8.3. Config baked to public/config/*.json by tools/bake_config.py (one build language).

## CI (.github/workflows/daily.yml)

cron 0 0 * * * + dispatch -> setup-python -> generate today's easy/standard/sharp/expert (add-only; existing dated files frozen) -> ruff/mypy/pytest + determinism + share-no-leak -> vite build base /yen-cinthanai/ (prebuild rebakes the GlyphManifest) -> Pages. Past days commit back; bank accretes.

## See also
- [../contracts/schemas.md](../contracts/schemas.md) - manifest/bank output.
- [../../concepts/difficulty-and-scoring.md](../../concepts/difficulty-and-scoring.md) - reject-if-out-of-band.
- [../../how-to/ship-to-github-pages.md](../../how-to/ship-to-github-pages.md) - deploy.
