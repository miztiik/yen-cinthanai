# Persisted Schemas

**Last Updated**: 2026-07-02

Typed, versioned contracts. Save is the only migrating surface (installed-player consequence); manifest/bank/share are bundle-shipped (rewrite-in-place). Pydantic source of truth at build; TS readers at runtime. See CLAUDE.md sec 11.

## PuzzleManifest v2

Matrix-only (F1) and story-first: the seating-row/round-table positional engine is RETIRED (Row 9d contract close), so `shapeId` is always `grid`. The story block is REQUIRED and the old boolean `ordinal` flag is replaced by `kind` + `anchor`.

Fields: schemaVersion(=2), puzzleId(=UTC date, the seed), tier, shapeId(=grid), templateRev, entities[], categories{n,list[]}, constraints[], solution, hintTrace[], plus the REQUIRED story block scenarioId, story, subjectNoun, variant. AttributeCategory = {id, label, kind(nominal|ordinal|numeric), anchor(bool - exactly one category is the identity axis), cardinality(bijective|shared), values[{id, glyph, label, magnitude?, phrase?, refPhrase?}], unit?, glyphPack?}. Constraint = {id, type(eq|neq|numDiff|threshold|oneOf|oneEachOf|ifThen), operands[{cat,value}], params, clueText, renderHint}. Operands never name an entity directly, so clues stay shape-agnostic. The optional fields (category unit/glyphPack, value magnitude/phrase/refPhrase) are OMITTED when unset - the emit uses `exclude_none`, so a present-null is a bug and the schema rejects it. Worked 4x3 example: a narrated matrix of four guests, each with a drink and a pet; "the guest with tea also has the cat" (eq) and "the guest with coffee does not have the cat" (neq) -> unique. The anchor axis (anchor:true, e.g. the guest name) is the identity - value i sits in slot i, so it renders as a fixed header, not a fillable column. hintTrace ends when all slots forced. Category ids/values are auto-discovered + date-seeded from the GlyphManifest (below); the solver is glyph-agnostic, so which packs/values get picked never changes uniqueness/difficulty.

## GlyphManifest v2

`frontend/public/assets/glyphs/index.json`, GENERATED every build by `tools/bake_glyphs.py` from the asset tree (never hand-kept - a hand list goes stale with dangling refs). Bundle-shipped, rewrite-in-place, no migration.
`{ schemaVersion:2, generatedAt, packs:{ <pack>:{ <slug>:{ file, label } } } }`
Auto-discovering: every `<pack>/` dir is a puzzle DIMENSION, every `<name>.svg` a value, so a new collection folder joins the next build with no code change. `slug` = the `pack.slug` reference id (`[a-z0-9]+`, kebab hyphens dropped: `bell-pepper` -> `bellpepper`); `file` = the descriptive filename kept lowercase-kebab (our convention); `label` = derived. `generatedAt` is provenance only - excluded from any gameplay/determinism hash (mirrors `BankIndex.builtAt`). The bake fails on a non-kebab filename or a slug collision. `lib/glyphs.ts::glyphPath`/`glyphLabel` resolve `pack.slug` -> file + label; generators select values by FILENAME, never dict order.

## Save v1

```text
{ schemaVersion, days{dayKey->DayState}, hero{bestMs,date}, streak{count,lastDate,skipsLeft}, settings{sound,volume,theme,palette,reducedMotion,puckSize,display{color,glyphs,labels}} }
DayState = { date, tier, shapeId, status, placements, attempts, solveMs, hintsUsed, stars, notes? }
```

`dayKey = "date|tier|shapeId"` (save.svelte `dayKey()`), so playing several tiers/shapes the same calendar day keeps a slot each instead of overwriting one. The map key is DERIVED from each DayState's own date/tier/shapeId on read, so an older date-only save (key == date) normalizes transparently to the composite key with NO version bump (schemaVersion stays 1; the value fields are the source of truth, the incoming key is never trusted). `shapeId` is the tolerant field across the matrix-only retirement: new days always write `grid`, but a day saved before the seating/round-table retirement may still carry `seating-row`/`round-table`, so those legacy values are accepted on READ (READABLE_SHAPES) and the day is kept - Save does NOT bump (stays 1), so an installed player's old save keeps loading. PAR thresholds live in config/tiers; stars computed from solveMs/hints/wrong. `settings.puckSize` (small|medium|large; scales the Puck via config/ui.toml) is additive - absent in older saves, it defaults to `medium` on read (minor migration via the settings spread-merge). `settings.display` (color/glyphs/labels; the in-puzzle display mode) is likewise additive - absent in older saves it deep-merges to the default `{true,true,true}` on read and is clamped so at least one of glyphs/labels stays on (schemaVersion stays 1). Read path: parse -> on throw seed fresh -> version<1 migrate chain -> validate (rebuild days by derived dayKey, bad day dropped, hero/streak survive) -> prune only on QuotaExceededError oldest-first by DATE portion, today never pruned -> hand to runes. Streak stays per calendar date (recordWin keys on day.date). Streak forgiveness on new day.

## BankIndex v1

`{ schemaVersion, generatedSeed, builtAt, puzzles:[{date,tier,shapeId,file,sha}] }` at public/puzzles/index.json. sha = canonical-JSON sha256; rebuild must match (determinism gate).

## ShareCard v1

`{ schemaVersion, date, tier, shapeGlyph, status, moves, wrong, solveMs, hintsUsed, streak }`. No placements/solution/entities; contract test asserts no leak; shape-agnostic bar.

## Machine-checkable schemas

Every surface above also has a formal JSON Schema (Draft 2020-12) under `schemas/`, and a compliance gate (`tools/test_schemas.py`) validates every real config + persisted/bundle JSON against it on each `pytest tools` run. The Pydantic models (build-time) and the TS interfaces (runtime) stay the authored source of truth; the schemas are the language-agnostic, machine-checkable mirror. `jsonschema` is a build-time-only dep (not shipped, 0 bundle cost).

- Persisted / bundle: `schemas/puzzle-manifest.schema.json`, `bank-index.schema.json`, `save.schema.json`, `glyph-manifest.schema.json`, `share-card.schema.json`.
- Authoring inputs: `schemas/categories.schema.json`, `scenario-template.schema.json`.
- Config: `schemas/config/<name>.schema.json` for each of tiers, dials, budgets, copy, ui, shapes, glyphpacks, palettes, retention.

Tolerance (faithful but forgiving): the manifest schema is now strict v2 - story-first is REQUIRED (scenarioId/story/subjectNoun/variant), every category carries `kind` + `anchor`, `shapeId` is `grid`, and the retired `ordinal` flag is gone; a pre-pivot v1 manifest no longer validates (the whole served bank was reseeded to v2). Every story-first optional is OMITTED when unset - the served/daily emit uses `exclude_none`, so a present-null is REJECTED (a null signals a real emit bug). The save schema still accepts a v0 (pre-versioned, date-keyed, no `puckSize`) and a v1 save, and a v1 DayState may carry a retired `shapeId` (seating-row/round-table) so an installed player's old save keeps loading. Only PuzzleManifest bumped (1 -> 2); BankIndex/Save/ShareCard stay 1 and GlyphManifest stays 2.

Evolution log (why-changed-what, kept inside each schema): every schema carries a top-level `evolution` array - an ignored custom keyword, so the schema stays valid - shaped `[ { version, date, change, why } ]` tracking the surface's history (e.g. Save's `puckSize` + `notes` additions, GlyphManifest v1 -> v2). The gate asserts it is present and its versions are non-decreasing. The PuzzleManifest bumped 1 -> 2 at the story-first contract close (Row 9d): its `evolution` array carries the v2 entry (story-first required, `ordinal` dropped for `kind`+`anchor`, seating/round-table retired). Any future `schemaVersion` bump appends its entry here in the same commit.

## See also

- [../generator/pipeline.md](../generator/pipeline.md) - emits manifest+bank.
- [../../concepts/difficulty-and-scoring.md](../../concepts/difficulty-and-scoring.md) - stars/par.
- [../runtime/stack-and-bundle.md](../runtime/stack-and-bundle.md) - readers + repo.
- `schemas/` + `tools/test_schemas.py` - the formal JSON Schemas + compliance gate.
