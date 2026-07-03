# Generator Pipeline

**Last Updated**: 2026-07-03

Build-time only (tools/, Python, CI). Pipes and filters, one Pydantic model per arrow, JSONL log to `.logs/build-<date>.jsonl`. No runtime backend; no in-browser solver in v1 (WASM allowed later if it enriches play).

## Story-first served bank (the shipped bank)

The served daily bank (`frontend/public/puzzles/<date>-<tier>.json` + `index.json`) is DERIVED from the story-first matrix generator (`generate_story`) for ALL FOUR tiers - the served puzzle IS the story-first master (narrative + full-sentence clues; solutions ship in the manifest by design). The bank-build CLI's served-puzzle writer (`write_puzzle`) calls `generate_story(date, tier, variant=1)`, emits canonical one-line JSON with `exclude_none` (NO null optionals), and records `sha = sha256(canonical text)` in the BankIndex so a rebuild is byte-identical. `shapeId` is always `grid` (the story matrix); `schemaVersion` is `2` (the contract close made the story fields REQUIRED and replaced the boolean `ordinal` flag with `kind` + `anchor` - Contract phase).

Per-tier dimension budget comes from `config/tiers.json` (`categories`, subject first); the tier's `band` + `indir` (indirection budget) drive acceptance. EASY declares `indir = [0, 0]` - the all-direct tutorial: the variety/share cap is exempt and any indirect clue is rejected, so easy emits an all-eq grid (in band, zero-guess). Standard/sharp/expert keep the share cap (they declare a non-zero indirection budget). Numeric (numDiff/threshold) + compound (oneOf/oneEachOf/ifThen) clues are tier-gated by each `clueTemplate.minTier`. Acceptance requires: in band, zero-guess (the forced trace reaches every non-anchor cell), eq present + a single-clue eq opener, and (when the tier gates one in) a numeric clue - see `_story_acceptable`.

The legacy seating-row/round-table positional CP-SAT engine (`generate` -> `to_manifest`, the shape registry, and the ends/adjacent/distance/before/opposite/between clue branches) is RETIRED at v2 - matrix-only (F1): one engine (`generate_story` -> `to_story_manifest`), one skin (`grid`). The daily bot is add-only: an existing dated file is FROZEN (re-hashed, never regenerated) unless `--force`; the v2 contract close reseeded the whole served range with `--force`.

## Scenario catalog (per-date variety + per-tier coherence)

The narrative comes from a CATALOG of authored scenario templates under `datasets/templates/*.json` (12 live scenarios: weekend-market, food-truck-festival, community-garden and starliner-crew, plus the anti-clustering batch science-fair / harbor-regatta / film-festival / observatory-night / orchestra-tuning / county-fair / newsroom-deadline / costume-parade - deliberately spread across settings and tones), indexed by `datasets/templates/manifest.json`. Each template is self-contained: `subjectNoun` + anchor `subjectCategory`, five categories (the anchor person first, then four attributes - one of them a `numeric` axis positioned at index <= 2 so the standard 3-category slice still carries it), per-value `phrase`/`refPhrase`, and the full `clueTemplates` set (eq/neq/numDiff/threshold/oneOf/oneEachOf/ifThen). An optional per-category `glyphPack` makes a category glyph-backed (value id == the hyphen-dropped pack slug -> `value.glyph = "<pack>.<id>"`); a category with no `glyphPack` is text-only, and a single value may override with its own `glyph` (a `"<pack>.<id>"` ref, or `""` to stay text-only) so a partly-backfilled pack can decorate the values it covers while the rest read as text.

- **Manifest-driven catalog** (`corpus.load_scenario_manifest`): `datasets/templates/manifest.json` is the catalog INDEX - `{ schemaVersion, scenarios: [{ id, file, title, tone, kind, status }] }`. `status` is `"live"` or `"build"`; `tone`/`kind` are free-form editorial tags. The loader fails fast if a listed `file` is missing, if a `file` is not `"<id>.json"`, if an id is duplicated, or if any `*.json` template on disk (except the manifest) is unlisted - so the manifest and the directory can never silently drift.
- **Per-date selection** (`corpus.scenario_path_for_date`): a stable hash of the date over the sorted LIVE ids picks ONE scenario per date - `sorted(live)[sha256(date)[:8] % len(live)]`. Only `status=="live"` scenarios rotate. Consecutive dates vary while the same date always resolves to the same scenario, so all four tiers of a date share one scenario (sliced per tier) and a rebuild stays byte-identical.
- **Build / live staging** (`corpus.scenario_path_by_id`): a `"build"` scenario is authorable + testable via `generate.py --scenario <id>` (which resolves ANY catalogued id, live or build) but is kept OUT of the live daily rotation. So a new template can be iterated - generated, played, tuned - without touching the served bank; flip its `status` to `"live"` to promote it. The reference golden masters under `datasets/**` are pinned to weekend-market via `generate.py --story --scenario weekend-market`.
- **Per-tier narrative coherence** (`translator.render_story`): the template `narrativeTemplate` is SETTING FLAVOR ONLY - it never names a category. The renderer fills the flavor (`{n}` + one date-seeded pick per flavor pool) and then APPENDS a premise + match-line generated from the non-anchor categories actually PRESENT at that tier ("Each cook has a different dish and price. Using the clues, match every cook to their dish and price."). So easy (2 cats) never reads a clue to match a dimension it does not have, and expert (5 cats) lists them all.

## Incremental verification (verifiedSha dirty-tracking)

Fully verifying every scenario at every tier is O(catalog size) - it does not scale as the catalog grows toward ~100 scenarios. Verification is therefore INCREMENTAL and content-addressed (`tools/verify_scenarios.py`): each catalogued scenario carries an optional `verifiedSha` stamp in `datasets/templates/manifest.json` recording the content-address at which it last passed, and a scenario is re-verified only when that address changes. CI verifies only the CHANGED scenarios - bounded regardless of catalog size.

- **Content-address** = `scenario_fingerprint(id) = sha256( canonical-JSON(template) + generator_fingerprint() )`, where `generator_fingerprint()` is the sha256 of the concatenated bytes of `tools/{generate,corpus,translator,models}.py` + `config/{tiers,dials}.json`. The stamp invalidates when either the scenario TEMPLATE changes its MEANING (the template is canonicalized first, so re-indenting the file does not invalidate it) or any GENERATOR source that can alter what the scenario generates changes. The fingerprint deliberately EXCLUDES `verify_scenarios.py` and the test files (they do not affect the generated output), and `manifest.json` itself (so writing a stamp never perturbs a fingerprint). It is stable across the author's machine and CI because the repo commits LF (`git autocrlf=input`).
- **`verify_one(id)`** is the shared verification primitive: it generates the scenario at EVERY tier and asserts the story-first invariants - P1 zero-guess (`len(hintTrace) == non-anchor bijective cells`), difficulty in the tier band, `schemaVersion == 2`, an eq toehold, a numeric clue when the tier gates one in, a byte-identical deterministic rebuild, and per-tier narrative coherence (easy omits every sliced-out label, expert names every present one). It is reused by both the `--check`/`--stamp` CLI and the incremental gate `test_scenario_incremental_verify` in `tools/test_quality.py` (which SKIPS a stamp-current scenario and fully verifies a stale one), so `pytest tools -q` no longer scales with catalog size once the catalog is stamped. Its mechanism is covered by `tools/test_verify_scenarios.py`.
- **Author step**: after adding or editing a scenario template - or changing any generator source - run `python -m tools.verify_scenarios --stamp` from the repo root. It verifies every STALE live scenario and writes its current fingerprint into the manifest (atomic - a scenario that fails verification raises and nothing is written; idempotent - a re-stamp with nothing changed is byte-identical). Commit the stamped `datasets/templates/manifest.json` alongside the change. `python -m tools.verify_scenarios --check` is the read-only counterpart (exit nonzero on any failure). A new or changed scenario is auto-covered with no test edit: its stamp is absent or stale, so it verifies; every other scenario stays skipped.

## Stages

```text
config/tiers.json + config/dials.json + glyph manifest + date
  -> bake_glyphs.py walks the asset tree -> GlyphManifest (every build)
  -> date-seed picks DIMENSIONS from the manifest packs + values from the full pool
  -> seed (PRNG + CP-SAT seed) -> sample full bijective solution
  -> enumerate clues true under solution -> select weighted subset
  -> verify uniqueness -> prune to minimal -> template clueText
  -> emit PuzzleManifest + sha256 -> ADD-ONLY into BankIndex (existing dated files frozen)
```

## Auto-discovered dimensions + add-only freeze

Puzzle DIMENSIONS are derived from the GlyphManifest packs (every `<pack>/` folder except the structural `abstract` numerals), and which folders + values fill a tier are DATE-SEEDED from the full pool - so a new collection folder joins the rotation with no code change, and each day draws a different slice (diversity). Per-tier dimension counts come from `config/tiers.json` (`categories`, subject first); `build_story_categories` reads the manifest, not a hardcoded category list. The solver is glyph-agnostic, so selection never changes uniqueness/difficulty - only the skin. Puzzles are ADD-ONLY: an existing dated file is FROZEN (never regenerated), so expanding packs can't invalidate a shipped puzzle; `--force` overrides for a one-time migration.

## CP-SAT model (bijective matrix)

Vars `x[c][k]` = slot of value k in category c, domain 0..N-1; `AddAllDifferent` per category; the anchor axis is the identity (value i -> slot i). Matrix-only clue vocabulary: eq `==`, neq `!=`, numDiff (reified magnitude-at-slot, directed or `abs`), threshold (`atleast`/`atmost` bound), and the compound oneOf/oneEachOf/ifThen (reified selectors + `AddImplication`). The retired positional clues (ends/adjacent/distance/before/opposite/between) are gone with the seating engine. Determinism: `num_search_workers=1`, fixed `random_seed`.

## Uniqueness + prune

solve -> sol1; forbid that exact assignment via reified bools, Not(And); re-solve must be INFEASIBLE (2-solve cap). seed = `sha256(date + ":" + tier + ":" + variant)[:8]` (the story path is variant-addressed). Prune: shuffle, drop each clue if remainder stays unique, to fixpoint = minimal. Canonical JSON (sort_keys, ASCII) -> sha; CI rebuild must match.

## Pins (tools/requirements.txt)

python 3.12 | ortools 9.15.6755 | pydantic 2.11 | pytest 8.3. Config baked to public/config/*.json by tools/bake_config.py (one build language).

## CI (.github/workflows/daily.yml)

cron `0 0 * * *` + dispatch -> setup-python -> backfill the last 7 days easy/standard/sharp/expert (STORY-FIRST via the served-puzzle writer, add-only; existing dated files frozen, never future) -> vite build base /yen-cinthanai/ (prebuild rebakes the GlyphManifest) -> Pages. Past days commit back; bank accretes.

## See also

- [../contracts/schemas.md](../contracts/schemas.md) - manifest/bank output.
- [../../concepts/difficulty-and-scoring.md](../../concepts/difficulty-and-scoring.md) - reject-if-out-of-band.
- [../../concepts/glyph-roadmap.md](../../concepts/glyph-roadmap.md) - scenario category -> glyph pack map + backfill gaps.
- [../../how-to/ship-to-github-pages.md](../../how-to/ship-to-github-pages.md) - deploy.
