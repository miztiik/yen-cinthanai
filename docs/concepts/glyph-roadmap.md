# Glyph Roadmap

**Last Updated**: 2026-07-02

Which glyph pack backs each scenario CATEGORY, what is reused today, and what art is still a GAP to backfill. The generator is glyph-agnostic (the solver never reads a glyph), so this is a CONTENT map, not an engine dependency: a scenario category with a `glyphPack` renders its values as art; a category without one is text-only and reads perfectly well. See [../architecture/generator/pipeline.md](../architecture/generator/pipeline.md) (scenario catalog) and [ui-shell.md](ui-shell.md).

## How a category becomes glyph-backed

- Set `glyphPack: "<pack>"` on the template category. Each `value.id` MUST be a real slug in that pack; the generator emits `value.glyph = "<pack>.<id>"`.
- The slug is the SVG filename stem with kebab hyphens dropped (`bell-pepper.svg` -> `bellpepper`), so a value id is the hyphen-free stem. `glyphPath` throws on an unknown ref, and `tests/contract/scenario-glyphs.test.ts` fails the build if any glyph-backed value does not resolve to a shipped file - the guard for this whole map.
- TEXT-ONLY BY DESIGN (never a gap): the ANCHOR (a person name) and every NUMERIC axis (a price / plot / watch number) read as text. Only nominal ATTRIBUTE categories are glyph candidates.

## Packs reused today (EXISTING - no backfill needed)

| Pack | Backs (scenario.category) | Notes |
| --- | --- | --- |
| `food` | food-truck-festival.dish | pizza, burger, sushi, fries, toast, seafood |
| `drinks` | food-truck-festival.drink | non-alcoholic subset (coffee/juice/soda/tea/milk/water) - wholesome |
| `vegetables` | community-garden.vegetable | carrot, potato, corn, cabbage, spinach, beet |
| `color` | community-garden.ribbon | the rosette colour (blue/red/green/yellow/purple/orange) |
| `occupation` | starliner-crew.role | PARTIAL reuse: occupation slugs stand in for crew roles (astronomer -> Navigator, biologist -> Botanist, surgeon -> Medic, scientist -> Science Officer, captain, engineer) |
| `flags` | categories.country (dimension source; not yet in a scenario) | 271-flag pack, curated subset in `datasets/categories.json` |

## Per-scenario category map

Legend: EXISTING = renders today from a shipped pack; TEXT = text-only by design (anchor / numeric); GAP = a nominal category that would benefit from art once a pack exists.

| Scenario | Category | kind | glyphPack | Status |
| --- | --- | --- | --- | --- |
| weekend-market | name (anchor) | nominal | - | TEXT (person) |
| weekend-market | craft | nominal | - | GAP -> `crafts` |
| weekend-market | price | numeric | - | TEXT (numeric) |
| weekend-market | produce | nominal | - | GAP -> `produce` |
| weekend-market | bloom | nominal | - | GAP -> `flowers` |
| food-truck-festival | vendor (anchor) | nominal | - | TEXT (person) |
| food-truck-festival | dish | nominal | `food` | EXISTING |
| food-truck-festival | price | numeric | - | TEXT (numeric) |
| food-truck-festival | drink | nominal | `drinks` | EXISTING |
| food-truck-festival | pitch | nominal | - | GAP -> `markers` (low) |
| community-garden | grower (anchor) | nominal | - | TEXT (person) |
| community-garden | vegetable | nominal | `vegetables` | EXISTING |
| community-garden | plot | numeric | - | TEXT (numeric) |
| community-garden | bloom | nominal | - | GAP -> `flowers` |
| community-garden | ribbon | nominal | `color` | EXISTING |
| starliner-crew | crew (anchor) | nominal | - | TEXT (person) |
| starliner-crew | role | nominal | `occupation` | EXISTING (partial) |
| starliner-crew | shift | numeric | - | TEXT (numeric) |
| starliner-crew | deck | nominal | - | GAP -> `spaceship` |
| starliner-crew | cargo | nominal | - | GAP -> `spaceship` (or `cargo`) |

## Gap backlog (packs to backfill, highest value first)

1. `flowers` - backs weekend-market.bloom AND community-garden.bloom (TWO scenarios). Needs >= 6 slugs to cover the largest tier: roses, tulips, daisies, lilies, irises, poppies, dahlias, marigolds, zinnias, asters, peonies, cosmos. Highest ROI.
2. `crafts` - weekend-market.craft: candles, pottery, jam, soap, honey, prints.
3. `produce` - weekend-market.produce (grocery-stall goods): bread, cheese, eggs, apples, plums, olives. Partly overlaps `food`/`vegetables` but the set is distinct enough to warrant its own pack.
4. `spaceship` - starliner-crew.deck + .cargo (the sci-fi gap): deck zones (fore/aft/core/ring/dorsal/keel) and cargo types (ore/ice/grain/alloy/relics/spores), or a generic space pack (rocket, planet, satellite, robot, alien, ...) that could also enrich role beyond the occupation-pack stand-ins.
5. `markers` (low) - the small numbered/ordinal labels (pitch, and optionally plot/shift badges). Text already reads fine; a numerals/marker pack is polish, not need.

Backfill order is `flowers` first (unblocks the most categories). Until a pack lands, the category stays text-only - fully playable, just unillustrated.

## Rendering note

Glyph-backed values render in the grid ROW header (the draggable source) and in the win-screen answer summary. Because every value is a row header in exactly one category-pair block, every glyph is seen during play; column headers stay text (narrow phone columns). So adding a pack lights up its category everywhere with zero engine change.

## See also

- [../architecture/generator/pipeline.md](../architecture/generator/pipeline.md) - scenario catalog + per-date selection.
- [ui-shell.md](ui-shell.md) - Glyph component, the notes grid, the answer summary.
- [../architecture/contracts/schemas.md](../architecture/contracts/schemas.md) - ScenarioTemplate + GlyphManifest.
