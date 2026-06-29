# Persisted Schemas

**Last Updated**: 2026-06-30

Typed, versioned contracts. Save is the only migrating surface (installed-player consequence); manifest/bank/share are bundle-shipped (rewrite-in-place). Pydantic source of truth at build; TS readers at runtime. See CLAUDE.md sec 11.

## PuzzleManifest v1

Fields: schemaVersion, puzzleId(=UTC date, the seed), tier, shapeId, templateRev, entities[], categories{n,list[]}, constraints[], solution, hintTrace[]. AttributeCategory = {id,label,ordinal,cardinality(bijective|shared),values[{id,glyph,label}]}. Constraint = {id,type,operands[{cat,value}],params,clueText,renderHint}. Operands never name an entity directly, so clues stay shape-agnostic. Worked 4x3 example: tea-far-left, tea=cat, coffee-next-tea, coffee<milk, cat/fish distance 2, cola=bird, cola-far-right -> unique. hintTrace ends when all slots forced. Category ids/values are auto-discovered + date-seeded from the GlyphManifest (below) - a puzzle's dimensions ARE the glyph pack folders; the solver is glyph-agnostic, so which packs/values get picked never changes uniqueness/difficulty.

## GlyphManifest v2

`frontend/public/assets/glyphs/index.json`, GENERATED every build by `tools/bake_glyphs.py` from the asset tree (never hand-kept - a hand list goes stale with dangling refs). Bundle-shipped, rewrite-in-place, no migration.
`{ schemaVersion:2, generatedAt, packs:{ <pack>:{ <slug>:{ file, label } } } }`
Auto-discovering: every `<pack>/` dir is a puzzle DIMENSION, every `<name>.svg` a value, so a new collection folder joins the next build with no code change. `slug` = the `pack.slug` reference id (`[a-z0-9]+`, kebab hyphens dropped: `bell-pepper` -> `bellpepper`); `file` = the descriptive filename kept lowercase-kebab (our convention); `label` = derived. `generatedAt` is provenance only - excluded from any gameplay/determinism hash (mirrors `BankIndex.builtAt`). The bake fails on a non-kebab filename or a slug collision. `lib/glyphs.ts::glyphPath`/`glyphLabel` resolve `pack.slug` -> file + label; generators select values by FILENAME, never dict order.

## Save v1

```
{ schemaVersion, days{date->DayState}, hero{bestMs,date}, streak{count,lastDate,skipsLeft}, settings{sound,volume,theme,palette,reducedMotion,puckSize} }
DayState = { date, tier, shapeId, status, placements, attempts, solveMs, hintsUsed, stars }
```
PAR thresholds live in config/tiers; stars computed from solveMs/hints/wrong. `settings.puckSize` (small|medium|large; scales the Puck via config/ui.toml) is additive - absent in older saves, it defaults to `medium` on read (minor migration via the settings spread-merge). Read path: parse -> on throw seed fresh -> version<1 migrate chain -> validate (bad day dropped, hero/streak survive) -> prune only on QuotaExceededError oldest-first, today never pruned -> hand to runes. Streak forgiveness on new day.

## BankIndex v1
`{ schemaVersion, generatedSeed, builtAt, puzzles:[{date,tier,shapeId,file,sha}] }` at public/puzzles/index.json. sha = canonical-JSON sha256; rebuild must match (determinism gate).

## ShareCard v1
`{ schemaVersion, date, tier, shapeGlyph, status, moves, wrong, solveMs, hintsUsed, streak }`. No placements/solution/entities; contract test asserts no leak; shape-agnostic bar.

## See also
- [../generator/pipeline.md](../generator/pipeline.md) - emits manifest+bank.
- [../../concepts/difficulty-and-scoring.md](../../concepts/difficulty-and-scoring.md) - stars/par.
- [../runtime/stack-and-bundle.md](../runtime/stack-and-bundle.md) - readers + repo.
