# Persisted Schemas

**Last Updated**: 2026-06-29

Typed, versioned contracts. Save is the only migrating surface (installed-player consequence); manifest/bank/share are bundle-shipped (rewrite-in-place). Pydantic source of truth at build; TS readers at runtime. See CLAUDE.md sec 11.

## PuzzleManifest v1

Fields: schemaVersion, puzzleId(=UTC date, the seed), tier, shapeId, templateRev, entities[], categories{n,list[]}, constraints[], solution, hintTrace[]. AttributeCategory = {id,label,ordinal,cardinality(bijective|shared),values[{id,glyph,label}]}. Constraint = {id,type,operands[{cat,value}],params,clueText,renderHint}. Operands never name an entity directly, so clues stay shape-agnostic. Worked 4x3 example: tea-far-left, tea=cat, coffee-next-tea, coffee<milk, cat/fish distance 2, cola=bird, cola-far-right -> unique. hintTrace ends when all slots forced.

## Save v1

```
{ schemaVersion, days{date->DayState}, hero{bestMs,date}, streak{count,lastDate,skipsLeft}, settings{sound,volume,theme,palette,reducedMotion} }
DayState = { date, tier, shapeId, status, placements, attempts, solveMs, hintsUsed, stars }
```
PAR thresholds live in config/tiers; stars computed from solveMs/hints/wrong. Read path: parse -> on throw seed fresh -> version<1 migrate chain -> validate (bad day dropped, hero/streak survive) -> prune only on QuotaExceededError oldest-first, today never pruned -> hand to runes. Streak forgiveness on new day.

## BankIndex v1
`{ schemaVersion, generatedSeed, builtAt, puzzles:[{date,tier,shapeId,file,sha}] }` at public/puzzles/index.json. sha = canonical-JSON sha256; rebuild must match (determinism gate).

## ShareCard v1
`{ schemaVersion, date, tier, shapeGlyph, status, moves, wrong, solveMs, hintsUsed, streak }`. No placements/solution/entities; contract test asserts no leak; shape-agnostic bar.

## See also
- [../generator/pipeline.md](../generator/pipeline.md) - emits manifest+bank.
- [../../concepts/difficulty-and-scoring.md](../../concepts/difficulty-and-scoring.md) - stars/par.
- [../runtime/stack-and-bundle.md](../runtime/stack-and-bundle.md) - readers + repo.
