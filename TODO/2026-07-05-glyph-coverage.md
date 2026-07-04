# Missing glyph images — coverage map (2026-07-05)

Audited with `python -m tools.audit_glyphs` (read-only; exits non-zero while any category is
`partial`, so it can gate CI). Re-run it after adding art to refresh this map.

## The render contract (no mix)

A grid axis (category) shows **glyph images only when EVERY one of its values has an existing
image**; otherwise the **whole axis falls back to green checks** — never a mix of images and
checks in one column. Enforced at runtime by `glyphComplete()` ([frontend/src/lib/grid.ts](../frontend/src/lib/grid.ts))
+ `glyphExists()` ([frontend/src/lib/glyphs.ts](../frontend/src/lib/glyphs.ts)), applied in
[GridMatrix.svelte](../frontend/src/components/GridMatrix.svelte) and [NotesGrid.svelte](../frontend/src/components/NotesGrid.svelte).
Because the check is against the live glyph registry, **an axis auto-upgrades to images the
moment its missing art is baked in** — no data or code change needed.

## Current state

- 100 scenarios, 500 categories: **116 complete** (all images), **380 text** (all checks by
  design), **4 partial** (would mix → currently render as green checks).
- No broken refs anywhere: every glyph a template references already has a file. The 4 gaps are
  all "one value in the axis has no art", which trips the whole axis to text.

## Images to add (closes all 4 gaps)

### 1. Flowers pack — 3 missing blooms
Pack `frontend/public/assets/glyphs/flowers/` currently has: hibiscus, jasmine, rose, sunflower,
tulips. The three `Bloom` axes each opt one value out because its flower has no art:

| Add file | Ref | Unblocks (scenario / value) | Then set in template |
|---|---|---|---|
| `flowers/lavender.svg` | `flowers.lavender` | apiary-bloom / "Lavender" | `"glyph": "flowers.lavender"` on the `lavender` value |
| `flowers/cosmos.svg` | `flowers.cosmos` | community-garden / "Cosmos" | `"glyph": "flowers.cosmos"` on the `cosmos` value |
| `flowers/poppies.svg` | `flowers.poppies` | weekend-market / "Poppies" | `"glyph": "flowers.poppies"` on the `poppies` value |

(The other five values in each Bloom axis already carry `flowers.*` overrides — these are the
only stragglers.)

### 2. Film-festival "Award" axis — 3 missing prizes
`award` has no `glyphPack`; three values decorate via `medals.gold/silver/bronze`, the other
three are text. Add art for the three uncovered prizes (a rosette/ribbon reads well), e.g. into
the `medals` pack:

| Add file | Ref | Set on value ([datasets/templates/film-festival.json](../datasets/templates/film-festival.json)) |
|---|---|---|
| `medals/audience.svg` | `medals.audience` | `audiencepick` |
| `medals/critics.svg` | `medals.critics` | `criticspick` |
| `medals/debut.svg` | `medals.debut` | `debutprize` |

## Workflow to add art

1. Drop the `.svg`(s) into the pack folder (wash with `python -m tools.wash_svg` if needed; keep
   under the 72 KiB ceiling; single-path, `currentColor`-friendly like the rest of the pack).
2. Set the matching `"glyph": "<ref>"` on the value(s) in the template (table above).
3. `python -m tools.bake_glyphs` (rebuilds the registry) and re-verify + re-stamp any edited
   scenario: `python -m tools.verify_scenarios --stamp`.
4. `python -m tools.audit_glyphs` — the fixed axis drops out of the `partial` list.
5. Regenerate the bank if you want it served immediately: `python -m tools.generate --backfill 11 --force`.
