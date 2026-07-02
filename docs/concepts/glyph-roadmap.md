# Glyph Roadmap

**Last Updated**: 2026-07-03

Which glyph pack backs each scenario CATEGORY, what is reused today, and what art is still a GAP to backfill. The generator is glyph-agnostic (the solver never reads a glyph), so this is a CONTENT map, not an engine dependency: a scenario category with a `glyphPack` renders its values as art; a category without one is text-only and reads perfectly well. See [../architecture/generator/pipeline.md](../architecture/generator/pipeline.md) (scenario catalog) and [ui-shell.md](ui-shell.md).

## How a category becomes glyph-backed

- Set `glyphPack: "<pack>"` on the template category. Each `value.id` MUST be a real slug in that pack; the generator emits `value.glyph = "<pack>.<id>"`.
- The slug is the SVG filename stem with kebab hyphens dropped (`bell-pepper.svg` -> `bellpepper`, `candle-making.svg` -> `candlemaking`), so a value id is the hyphen-free stem. `glyphPath` throws on an unknown ref, and `tests/contract/scenario-glyphs.test.ts` fails the build if any glyph-backed value does not resolve to a shipped file - the guard for this whole map.
- PARTIAL packs: a single value may carry its own optional `glyph` override (a `"<pack>.<id>"` ref, or `""` to stay text) independent of the category `glyphPack`. This wires the values a partly-backfilled pack DOES cover while the rest of the column reads as text - `weekend-market.bloom` does exactly this with the 2-of-6 `flowers` pack. The contract test resolves these overrides too.
- TEXT-ONLY BY DESIGN: the ANCHOR (a person name) reads as text. A NUMERIC axis reads as text UNLESS its magnitudes are the sequential run 1..6, in which case the `abstract` numerals (`num1`..`num6`) back it (community-garden.plot, starliner-crew.shift); a non-sequential numeric axis like a dollar price stays text.

## Packs backing scenarios today

Backfilled 2026-07-03: `crafts`, `flowers` (partial), `spaceship`, plus the `abstract` numerals now wired to numbered/position categories and sequential numeric axes.

| Pack | Backs (scenario.category) | Notes |
| --- | --- | --- |
| `crafts` | weekend-market.craft | BACKFILLED: candlemaking, carpentry, gardening, painting, pottery, soapmaking (6/6) |
| `food` | food-truck-festival.dish, weekend-market.produce | dish = pizza/burger/sushi/fries/toast/seafood; produce = bread/cheese/egg/baguette/cookie/donut (2 scenarios) |
| `flowers` | weekend-market.bloom (PARTIAL, per-value) | BACKFILLED but only 2/6: jasmine + sunflower wired via per-value `glyph`; tulips/daisies/lilies/poppies stay text until 4 more flowers land |
| `spaceship` | starliner-crew.vessel | BACKFILLED: enterprise/greenship/orangeship/saucer/spacerover/spaceshuttle (6/6). The old text-only `deck` was repurposed into a `vessel` category (the spaceship glyphs are VESSEL types, not decks) |
| `abstract` | food-truck-festival.pitch, community-garden.plot, starliner-crew.shift | numerals num1..num6 back numbered positions AND sequential numeric axes (plot/shift aligned to 1..6) |
| `drinks` | food-truck-festival.drink | non-alcoholic subset (coffee/juice/soda/tea/milk/water) - wholesome |
| `vegetables` | community-garden.vegetable | carrot, potato, corn, cabbage, spinach, beet |
| `color` | community-garden.ribbon | the rosette colour (blue/red/green/yellow/purple/orange) |
| `occupation` | starliner-crew.role | PARTIAL reuse: occupation slugs stand in for crew roles (astronomer -> Navigator, biologist -> Botanist, surgeon -> Medic, scientist -> Science Officer, captain, engineer) |
| `flags` | categories.country (dimension source; not yet in a scenario) | 271-flag pack, curated subset in `datasets/categories.json` |

## Per-scenario category map

Legend: GLYPH = renders from a shipped pack; TEXT = text-only (anchor, or a non-sequential numeric axis); PARTIAL = some values glyph-backed, the rest text.

| Scenario | Category | kind | glyphPack | Status |
| --- | --- | --- | --- | --- |
| weekend-market | name (anchor) | nominal | - | TEXT (person) |
| weekend-market | craft | nominal | `crafts` | GLYPH |
| weekend-market | price | numeric | - | TEXT (dollars, non-sequential) |
| weekend-market | produce | nominal | `food` | GLYPH |
| weekend-market | bloom | nominal | per-value | PARTIAL (`flowers`: jasmine + sunflower; 4 blooms text) |
| food-truck-festival | vendor (anchor) | nominal | - | TEXT (person) |
| food-truck-festival | dish | nominal | `food` | GLYPH |
| food-truck-festival | price | numeric | - | TEXT (dollars, non-sequential) |
| food-truck-festival | drink | nominal | `drinks` | GLYPH |
| food-truck-festival | pitch | nominal | `abstract` | GLYPH (numerals num1..num6) |
| community-garden | grower (anchor) | nominal | - | TEXT (person) |
| community-garden | vegetable | nominal | `vegetables` | GLYPH |
| community-garden | plot | numeric | `abstract` | GLYPH (numerals 1..6) |
| community-garden | bloom | nominal | - | TEXT (dahlias/marigolds/... - flowers pack too small) |
| community-garden | ribbon | nominal | `color` | GLYPH |
| starliner-crew | crew (anchor) | nominal | - | TEXT (person) |
| starliner-crew | role | nominal | `occupation` | GLYPH (partial reuse) |
| starliner-crew | shift | numeric | `abstract` | GLYPH (numerals 1..6) |
| starliner-crew | vessel | nominal | `spaceship` | GLYPH (repurposed from deck) |
| starliner-crew | cargo | nominal | - | TEXT (no cargo pack yet) |

## Gap backlog (remaining art to backfill)

1. `flowers` (SHORT: 2/6) - has only jasmine + sunflower, so weekend-market.bloom wires those two per-value and community-garden.bloom stays fully text. Add ~4 more (e.g. rose, tulip, daisy, lily, poppy, marigold) for a full 6-value column, then flip both blooms to a category `glyphPack`. Highest ROI.
2. `cargo` (or a generic sci-fi pack) - starliner-crew.cargo (ore/ice/grain/alloy/relics/spores) is the last text-only ATTRIBUTE in the batch. A space pack could also enrich role beyond the occupation-pack stand-ins.

Everything else in the batch is now glyph-backed. Numbered/position categories (pitch) and sequential numeric axes (plot, shift) are covered by the `abstract` numerals (num1..num6) - there is no separate "markers" pack to build. Until a pack lands, a category stays text-only - fully playable, just unillustrated.

## Rendering note

Glyph-backed values render in the grid ROW header (the draggable source) and in the win-screen answer summary. Because every value is a row header in exactly one category-pair block, every glyph is seen during play; column headers stay text (narrow phone columns). So adding a pack lights up its category everywhere with zero engine change.

## See also

- [../architecture/generator/pipeline.md](../architecture/generator/pipeline.md) - scenario catalog + per-date selection.
- [ui-shell.md](ui-shell.md) - Glyph component, the notes grid, the answer summary.
- [../architecture/contracts/schemas.md](../architecture/contracts/schemas.md) - ScenarioTemplate + GlyphManifest.
