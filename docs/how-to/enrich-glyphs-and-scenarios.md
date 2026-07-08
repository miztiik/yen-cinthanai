# Enrich Glyphs and Scenarios

**Last Updated**: 2026-07-08

How the glyph packs, the scenario templates, and the difficulty tiers fit together - and the exact
steps (plus the traps) for adding new art or a new puzzle. This is the action-oriented guide; for
the live coverage census see [../reference/glyph-coverage.md](../reference/glyph-coverage.md), for
the pack strategy see [../concepts/glyph-roadmap.md](../concepts/glyph-roadmap.md), and for the
generator internals see [../architecture/generator/pipeline.md](../architecture/generator/pipeline.md).

## The model in one picture

Three separate things compose into a puzzle:

```text
glyph packs (art)          scenario template (content)        tiers (config/tiers.json)
frontend/public/assets/    datasets/templates/<id>.json       easy / standard / sharp / expert
  glyphs/<pack>/*.svg        categories[] -> valuePool[]         each = an entity x category size
        |                          |                                        |
        +-- a category sets  glyphPack: "<pack>" ---------------------------+
                                   |
                          the generator slices the template to the tier's size,
                          samples a unique solution, and emits a PuzzleManifest
```

- A **glyph pack** is a folder of SVGs. Each pack is one visual DIMENSION (all the flowers, all the
  clocks). The pack is auto-discovered - drop an SVG in and the next bake registers it. The bake
  (`tools/bake_glyphs.py`) writes the registry `frontend/public/assets/glyphs/index.json`.
- A **scenario template** is the authored CONTENT of one puzzle world (the bakery, the regatta): a
  list of `categories`, each with a `valuePool` of values. A category becomes picture-backed by
  naming a pack (`glyphPack: "<pack>"`); otherwise it reads as text. The solver never looks at a
  glyph - art is pure presentation, so a text category reads perfectly well.
- The **tiers** decide how big the puzzle is. ONE template produces FOUR puzzles of increasing size.

The key seam: a category's `value.id` MUST equal a real slug in the pack it names. The generator
emits `value.glyph = "<pack>.<id>"`, and the build fails loudly if that ref has no shipped file.

## How one template unpacks into four puzzle variations

A template is authored once with **exactly 5 categories** and 6 values each, then the generator
carves it down per tier. From [../../config/tiers.json](../../config/tiers.json):

| Tier | entities (rows) | categories (columns used) | what gets sliced |
| --- | --- | --- | --- |
| easy | 3 | 2 | anchor + first 1 axis |
| standard | 4 | 3 | anchor + first 2 axes |
| sharp | 5 | 4 | anchor + first 3 axes |
| expert | 6 | 5 | all 5 axes |

Mechanics (see `build_story` in [../../tools/generate.py](../../tools/generate.py)):

- **Column slice**: the generator takes the FIRST `categories` entries (`cats[:budget]`), subject
  first. So category ORDER matters - put the glyph-backed axis at index 1 and the numeric axis at
  index 2 so both survive down to the smaller tiers.
- **Row sample**: it date-seeds a pick of `entities` values from each column's pool
  (`rng.sample(pool, min(entities, len(pool)))`), then samples one unique solution grid.
- **Clue gating**: each clue type is unlocked by its `minTier` - `eq`/`neq` from easy, `numDiff`
  from standard, `threshold`/`oneOf`/`oneEachOf` from sharp, `ifThen` at expert. Higher tiers layer
  in indirection (naming operands by attribute, not name) to hit the tier's difficulty band.

So "variations" are not authored per tier; they FALL OUT of one template plus the tier config. A
daily bank serves one puzzle per (date, tier) by date-hashing the `live` scenarios.

## Where the catalog is designed

| File | Role |
| --- | --- |
| `datasets/templates/<id>.json` | One scenario template (narrative + categories + clue templates). |
| `datasets/templates/manifest.json` | The CATALOG index. Every template on disk must be listed; `status: live` enters the daily rotation, `status: build` is staged/testable but out of rotation. |
| `datasets/categories.json` | The shared DIMENSION SOURCE - reusable category pools (fruit, country, hour...). Glyph-audited, but not yet wired into the generator; a library to copy from. |
| `config/tiers.json` | The per-tier sizes and difficulty bands - the knob that turns one template into four puzzles. |
| `frontend/public/assets/glyphs/index.json` | GENERATED registry (never hand-edited). Rebuilt from the asset tree by `tools/bake_glyphs.py`. |

## Enrich: add art to a glyph pack

1. Draw/obtain a VECTOR SVG. Wash it: `python -m tools.wash_svg <file>` (single-path or
   `currentColor`, keep it under the per-file ceiling in
   [../../config/budgets.json](../../config/budgets.json)). A raster PNG cannot be used - the bake
   only walks `*.svg`.
2. Name it lowercase kebab-case and drop it in `frontend/public/assets/glyphs/<pack>/`. A NEW pack
   is just a new folder - no code edits, it auto-discovers.
3. `python -m tools.bake_glyphs` - rebuilds the registry. It FAILS loudly on a non-kebab filename,
   a slug collision, or an oversized SVG.
4. `python -m tools.audit_glyphs` - confirms coverage; then the frontend registry tests
   (`npm --prefix frontend run test -- tests/unit/glyphs.test.ts`).

The **slug** is the filename stem with hyphens dropped: `fire-station.svg` -> `firestation`,
`clock-one.svg` -> `clockone`. That slug is what a template value id must equal.

## Enrich: wire a pack onto a scenario category

Two ways to make a category picture-backed:

- **Whole column** (preferred once the pack covers every value): set `glyphPack: "<pack>"` on the
  category and make every `value.id` a slug in that pack.
- **Per value**: give a single value its own `"glyph": "<pack>.<id>"` (or `""` to force text). Use
  this only when a pack covers SOME values but not all - it lights the covered ones while the rest
  read as text.

## Enrich: add a new scenario template

Copy [../../datasets/templates/bakery.json](../../datasets/templates/bakery.json) - it is the
reference shape - and change the content. Recipe:

1. **Five categories**, subject first: `anchor` (a person, `anchor: true`, text) at index 0; the
   glyph-backed axis at index 1 (`glyphPack: "<pack>"`, ids = slugs); a `numeric` axis at index 2
   (integer `magnitude` per value, for `numDiff`/`threshold`); two more text axes at indices 3-4.
2. **Six values per category** so the template reaches expert (6 rows). The glyph column needs >= 6
   SHIPPED glyphs (see the cap gotcha below).
3. **Clue templates**: `eq`/`neq` (minTier easy), `numDiff` (standard, `appliesTo` the numeric id),
   `threshold`/`oneOf`/`oneEachOf` (sharp), `ifThen` (expert). Keep the narrative flavor-only.
4. **Register it** in `manifest.json` with `status: build`. Author + iterate as build; promote to
   `live` only when it is ready to enter the daily rotation.
5. **Smoke it** at each tier and confirm the difficulty is in band:

   ```python
   import sys; sys.path.insert(0, "tools"); import generate as g; from pathlib import Path
   for t in ("easy", "standard", "sharp", "expert"):
       b = g.build_story("2026-07-01", t, 1, Path("config"),
                         scenario_path=Path("datasets/templates/<id>.json"))
       lo, hi = g.load_config("tiers", Path("config"))[t]["band"]
       print(t, b.d, lo <= b.d <= hi)
   ```

6. **Live only**: a `live` scenario carries a `verifiedSha` build-cache stamp; write it with
   `python -m tools.verify_scenarios --stamp` (re-verifies at every tier). A `build` scenario needs
   no stamp and is not verified by the incremental gate.

## Gotchas to avoid

- **No-mix render**: a column shows pictures ONLY if EVERY value resolves to a shipped glyph; one
  missing straggler drops the WHOLE column back to text. Cover all 6 or none.
- **The under-6 cap**: a glyph column can hold at most as many rows as the pack has glyphs. So a
  pack with < 6 glyphs CANNOT back a full easy->expert column - cap `maxTier` (5 glyphs -> `sharp`,
  4 -> `standard`, 3 -> `easy`), or grow the pack to 6. Prefer growing the pack.
- **Exactly 5 categories**: every template must list 5 (a test asserts it). A tier-capped template
  still needs all 5; its extra axes just stay dormant at the capped tier.
- **Category order is load-bearing**: the glyph axis at index 1 and the numeric axis at index 2, or
  they vanish from the lower tiers.
- **Ids are slugs, not labels**: `value.id` must be the hyphen-free filename stem. `label` is the
  display text and can be anything.
- **Pack collision - one visual idea per pack**: a glyph's job is to say WHICH dimension it is, so
  never reuse another pack's signature icon. Clocks/watches belong to `time`, vehicles to
  `transport`, prizes (medal/ribbon/trophy) to `awards`+`medals`, landmarks/destinations to
  `vacation`. Before drawing a new glyph ask "does this picture already mean something in another
  pack?" - if yes, reuse that pack instead of duplicating the icon.
- **Text by design is fine**: the anchor (a person) and a non-sequential numeric axis (a price)
  read as text on purpose - that is not a gap.
- **Cheap fix first**: to close a coverage gap, point the value at an EXISTING slug before drawing
  new art (that is how the flowers blooms closed - Lavender/Cosmos -> `poppies`).
- **ASCII + kebab + byte ceiling**: filenames lowercase kebab-case; all repo text ASCII (use `->`,
  `>=`); every SVG under `config/budgets.json` `glyphs.max_svg_bytes`. The bake enforces all three.
- **Never hand-edit `index.json`**: it is generated. Change the asset tree and re-bake.

## See also

- [../reference/glyph-coverage.md](../reference/glyph-coverage.md) - the machine-tracked coverage census (complete / text / partial per category).
- [../concepts/glyph-roadmap.md](../concepts/glyph-roadmap.md) - the pack strategy: which packs exist and what to build next.
- [../architecture/generator/pipeline.md](../architecture/generator/pipeline.md) - the build-time generator (slice, solve, render).
- [../concepts/difficulty-and-scoring.md](../concepts/difficulty-and-scoring.md) - the tier bands and scoring.
- [../../CLAUDE.md](../../CLAUDE.md) - the engineering contract (Holy Laws #3, #6, #10).
