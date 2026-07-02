# Persisted Schemas

**Last Updated**: 2026-07-02

Typed, versioned contracts. Save is the only migrating surface (installed-player consequence); manifest/bank/share are bundle-shipped (rewrite-in-place). Pydantic source of truth at build; TS readers at runtime. See CLAUDE.md sec 11.

## PuzzleManifest v1

Fields: schemaVersion, puzzleId(=UTC date, the seed), tier, shapeId, templateRev, entities[], categories{n,list[]}, constraints[], solution, hintTrace[]. AttributeCategory = {id,label,ordinal,cardinality(bijective|shared),values[{id,glyph,label}]}. Constraint = {id,type,operands[{cat,value}],params,clueText,renderHint}. Operands never name an entity directly, so clues stay shape-agnostic. Worked 4x3 example: tea-far-left, tea=cat, coffee-next-tea, coffee<milk, cat/fish distance 2, cola=bird, cola-far-right -> unique. hintTrace ends when all slots forced. Category ids/values are auto-discovered + date-seeded from the GlyphManifest (below) - a puzzle's dimensions ARE the glyph pack folders; the solver is glyph-agnostic, so which packs/values get picked never changes uniqueness/difficulty.

## GlyphManifest v2

`frontend/public/assets/glyphs/index.json`, GENERATED every build by `tools/bake_glyphs.py` from the asset tree (never hand-kept - a hand list goes stale with dangling refs). Bundle-shipped, rewrite-in-place, no migration.
`{ schemaVersion:2, generatedAt, packs:{ <pack>:{ <slug>:{ file, label } } } }`
Auto-discovering: every `<pack>/` dir is a puzzle DIMENSION, every `<name>.svg` a value, so a new collection folder joins the next build with no code change. `slug` = the `pack.slug` reference id (`[a-z0-9]+`, kebab hyphens dropped: `bell-pepper` -> `bellpepper`); `file` = the descriptive filename kept lowercase-kebab (our convention); `label` = derived. `generatedAt` is provenance only - excluded from any gameplay/determinism hash (mirrors `BankIndex.builtAt`). The bake fails on a non-kebab filename or a slug collision. `lib/glyphs.ts::glyphPath`/`glyphLabel` resolve `pack.slug` -> file + label; generators select values by FILENAME, never dict order.

## Save v1

```text
{ schemaVersion, days{dayKey->DayState}, hero{bestMs,date}, streak{count,lastDate,skipsLeft}, settings{sound,volume,theme,palette,reducedMotion,puckSize} }
DayState = { date, tier, shapeId, status, placements, attempts, solveMs, hintsUsed, stars }
```

`dayKey = "date|tier|shapeId"` (save.svelte `dayKey()`), so playing several tiers/shapes the same calendar day keeps a slot each instead of overwriting one. The map key is DERIVED from each DayState's own date/tier/shapeId on read, so an older date-only save (key == date) normalizes transparently to the composite key with NO version bump (schemaVersion stays 1; the value fields are the source of truth, the incoming key is never trusted). PAR thresholds live in config/tiers; stars computed from solveMs/hints/wrong. `settings.puckSize` (small|medium|large; scales the Puck via config/ui.toml) is additive - absent in older saves, it defaults to `medium` on read (minor migration via the settings spread-merge). Read path: parse -> on throw seed fresh -> version<1 migrate chain -> validate (rebuild days by derived dayKey, bad day dropped, hero/streak survive) -> prune only on QuotaExceededError oldest-first by DATE portion, today never pruned -> hand to runes. Streak stays per calendar date (recordWin keys on day.date). Streak forgiveness on new day.

## BankIndex v1

`{ schemaVersion, generatedSeed, builtAt, puzzles:[{date,tier,shapeId,file,sha}] }` at public/puzzles/index.json. sha = canonical-JSON sha256; rebuild must match (determinism gate).

## ShareCard v1

`{ schemaVersion, date, tier, shapeGlyph, status, moves, wrong, solveMs, hintsUsed, streak }`. No placements/solution/entities; contract test asserts no leak; shape-agnostic bar.

## Machine-checkable schemas

Every surface above also has a formal JSON Schema (Draft 2020-12) under `schemas/`, and a compliance gate (`tools/test_schemas.py`) validates every real config + persisted/bundle JSON against it on each `pytest tools` run. The Pydantic models (build-time) and the TS interfaces (runtime) stay the authored source of truth; the schemas are the language-agnostic, machine-checkable mirror. `jsonschema` is a build-time-only dep (not shipped, 0 bundle cost).

- Persisted / bundle: `schemas/puzzle-manifest.schema.json`, `bank-index.schema.json`, `save.schema.json`, `glyph-manifest.schema.json`, `share-card.schema.json`.
- Authoring inputs: `schemas/categories.schema.json`, `scenario-template.schema.json`.
- Config: `schemas/config/<name>.schema.json` for each of tiers, dials, budgets, copy, ui, shapes, glyphpacks, palettes, retention.

Tolerance (faithful but forgiving): the manifest schema accepts a pre-pivot v1 manifest, a story-first manifest, AND the daily emit that serializes the optional story fields as `null`; the save schema accepts a v0 (pre-versioned, date-keyed, no `puckSize`) and a v1 save. Formalizing the schemas bumps NO schemaVersion.

Evolution log (why-changed-what, kept inside each schema): every schema carries a top-level `evolution` array - an ignored custom keyword, so the schema stays valid - shaped `[ { version, date, change, why } ]` tracking the surface's history (e.g. Save's `puckSize` + `notes` additions, GlyphManifest v1 -> v2). The gate asserts it is present and its versions are non-decreasing. When a future row bumps a `schemaVersion` (e.g. the manifest 1 -> 2) it appends an entry here in the same commit.

## See also

- [../generator/pipeline.md](../generator/pipeline.md) - emits manifest+bank.
- [../../concepts/difficulty-and-scoring.md](../../concepts/difficulty-and-scoring.md) - stars/par.
- [../runtime/stack-and-bundle.md](../runtime/stack-and-bundle.md) - readers + repo.
- `schemas/` + `tools/test_schemas.py` - the formal JSON Schemas + compliance gate.
