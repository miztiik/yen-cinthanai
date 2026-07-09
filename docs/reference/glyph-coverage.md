# Glyph Coverage

**Last Updated**: 2026-07-09

The single central document for scenario glyphs: which pack backs which category, the exact gap
between the art we ship and what the templates reference, how to close it, and how to keep this
page current. The generator is glyph-agnostic (the solver never reads a glyph), so this is a
CONTENT map, not an engine dependency - a category with art renders its values as pictures; a
category without one reads perfectly well as text.

## Updating this document (for agents)

This page is a snapshot; the LIVE source of truth is the auditor
[../../tools/audit_glyphs.py](../../tools/audit_glyphs.py). It scans BOTH glyph-backed sources -
every scenario template in [../../datasets/templates/](../../datasets/templates/) AND the shared
dimension source [../../datasets/categories.json](../../datasets/categories.json) (a reusable
dimension library not yet wired into the generator, audited so a glyph ref there cannot silently
break) - resolves each value exactly as the generator does, and checks it against the baked
registry [../../frontend/public/assets/glyphs/index.json](../../frontend/public/assets/glyphs/index.json):

```
python -m tools.audit_glyphs        # human report; exits 1 while any category is partial (can gate CI)
python -m tools.audit_glyphs --md   # emits the "Current snapshot" block below - paste it in verbatim
```

When you add art, wire a glyph, or add a scenario: re-run the auditor, replace everything between
the `<!-- audit:begin -->` / `<!-- audit:end -->` markers with the `--md` output, refresh the
"Closing the open gaps now" table for whatever is still partial, and bump the Last Updated date.

## The no-mix render contract (what "gap" means)

A grid axis (one scenario category) shows glyph images ONLY when EVERY one of its values resolves
to a shipped image; otherwise the WHOLE axis falls back to green checks - never a mix of images
and checks in one column. So each category is in exactly one state, and only one is a gap:

- **complete** - every value has art; renders as images. Nothing to do.
- **text** - no value in the TEMPLATE carries a glyph; all green checks (a non-sequential numeric
  axis, or a person anchor). Not a gap. NOTE: the generator overlays a distinct `people` avatar on
  every anchor value at build time (Option B), so an anchor renders as a portrait in play even
  though its template is counted text here.
- **partial** - some values have art and at least one does not; the mix trips the whole axis back
  to text. THIS is the closeable gap: give the straggler(s) art and the axis auto-upgrades to
  images with no code or data change.

Enforced at runtime by `glyphComplete()` / `axisGlyphs()`
([../../frontend/src/lib/grid.ts](../../frontend/src/lib/grid.ts)) and `glyphExists()`
([../../frontend/src/lib/glyphs.ts](../../frontend/src/lib/glyphs.ts)); see
[../concepts/ui-shell.md](../concepts/ui-shell.md) for the Puck / GlyphSeat rendering.

## Current snapshot

<!-- audit:begin - regenerate with: python -m tools.audit_glyphs --md -->

- Scenario templates: 103 scenarios, 515 categories -> complete 123, text 392, partial 0.
- Dimension source (categories.json): 13 dimensions -> complete 3, text 10, partial 0.

No broken references: every glyph a template or dimension names has a shipped file. Each gap above is a value carrying no glyph while its siblings do, which trips the axis to text.

<!-- audit:end -->

## Closing the open gaps now

No open gaps: every glyph-backed axis is `complete` and the audit exits 0. The two former partials
(apiary-bloom + community-garden `bloom`) closed by swapping their one artless straggler
(Lavender / Cosmos) for `poppies`, which the flowers pack already ships - no new art was drawn. The
`flowers` pack is now a stable six-bloom set (hibiscus, jasmine, poppies, rose, sunflower, tulips),
so those two blooms plus weekend-market all render as pictures.

Workflow to close a gap when one reappears (a new template names a value with no art): first try to
point the value at an EXISTING pack slug (the cheap fix - no new art, as the blooms did); only if no
existing glyph fits, wash a new SVG (`python -m tools.wash_svg`, keep it under the per-file ceiling
in [../../config/budgets.json](../../config/budgets.json), single-path/`currentColor` or a washed
illustration like the pack; `flowers/poppies.svg` is the reference shape) -> set the `glyph` ref (or
a category `glyphPack`) on the value -> `python -m tools.bake_glyphs` (rebuilds the registry) ->
`python -m tools.verify_scenarios --stamp` (re-verify edited live scenarios) ->
`python -m tools.audit_glyphs` (the fixed axis drops out of the partial list) -> update the snapshot
above. Not every axis needs bespoke art: when the values have no unique real-world emblem (film
awards), NUMBER them instead - see the `awards` pack under "Packs in play".

## How a category becomes glyph-backed

- Set `glyphPack: "<pack>"` on the template category. Each `value.id` MUST be a real slug in that
  pack; the generator emits `value.glyph = "<pack>.<id>"`. The slug is the SVG filename stem with
  kebab hyphens dropped (`bell-pepper.svg` -> `bellpepper`, `candle-making.svg` -> `candlemaking`).
- Per-value override: a single value may carry its own `glyph` (a `"<pack>.<id>"` ref, or `""` to
  force text) independent of the category `glyphPack`. This lights the values a partly-backfilled
  pack covers while the rest read as text - the three bloom axes do exactly this.
- ANCHOR: the TEMPLATE carries no glyph, but the generator overlays a distinct `people` avatar on
  every anchor value at build time (Option B), so an anchor renders as a portrait in play. A NUMERIC
  axis stays text UNLESS its magnitudes are the sequential run 1..6, in which case the `abstract`
  numerals (`num1`..`num6`) back it. A non-sequential numeric axis (a price, a duration) stays text.
- Build guard: `glyphPath` throws on an unknown ref, and
  [../../frontend/tests/contract/scenario-glyphs.test.ts](../../frontend/tests/contract/scenario-glyphs.test.ts)
  fails the build if any glyph-backed value does not resolve to a shipped file.

## Packs in play, and the gap backlog

Packs backing categories today: `crafts`, `food`, `drinks`, `vegetables`, `color`, `creatures`,
`clothes`, `spaceship`, `occupation`, the `abstract` numerals (sequential 1..6 axes), `awards`
(numbered prize badges - see below), plus `flowers` used as a PARTIAL per-value pack. `flags` and
`offices` are shipped packs not yet wired into a scenario; `medals` (gold/silver/bronze) ships but
is currently unused. For the live per-category status run the auditor - it is not hand-maintained here.

The `awards` pack (award1..award6) is a NUMBERING pattern for axes whose real-world values have no
unique emblem: each glyph is the award-blank rosette compositing an `abstract` numeral, so the
badge NUMBER is the unique mark. film-festival's `award` axis uses it (First..Sixth Prize) in place
of medals + bespoke icons. Reuse it for any "which distinct one" axis that resists a per-value picture.

Art still worth building (each lights up a text-only column; rough ROI order):

1. Finish `flowers` (cosmos, lavender) - closes the two open bloom gaps above. Highest ROI.
2. A `cargo` / sci-fi pack - `starliner-crew.cargo` (ore/ice/grain/alloy/relics/spores) is a
   text-only attribute; a space pack could also enrich crew roles beyond the occupation stand-ins.
3. Attribute categories that read fine as text today but a pack would illustrate: musical
   `instrument`, carnival `mask`, `boat` rig, film `genre`, `tool`, and similar. Until a pack lands
   the column stays text - fully playable, just unillustrated.

## Where glyphs render

Glyph-backed values render in the grid ROW header (the draggable source) and in the win-screen
answer summary. Every value is a row header in exactly one category-pair block, so every glyph is
seen during play; column headers stay text (narrow phone columns). Adding a pack lights up its
category everywhere with zero engine change.

## See also

- [../concepts/ui-shell.md](../concepts/ui-shell.md) - the Puck / GlyphSeat rendering and the `glyphs` display toggle.
- [../architecture/generator/pipeline.md](../architecture/generator/pipeline.md) - the generator's `_value_glyph` resolution this auditor mirrors, and the glyph tooling.
- [../architecture/contracts/schemas.md](../architecture/contracts/schemas.md) - ScenarioTemplate + GlyphManifest schemas.
- [../../tools/audit_glyphs.py](../../tools/audit_glyphs.py) - the auditor (live source of truth for the snapshot above).
