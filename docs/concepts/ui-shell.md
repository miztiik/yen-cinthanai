# UI Shell

**Last Updated**: 2026-06-29

Screens, components, glyphs, tokens. Mid-tier Android portrait (~390x844). Tailwind for chrome only; canvas/board internals excluded. Six glyph packs ship (household, creatures, abstract, shapes, food, colour). Visual clarity (colour-is-one-signal), not a11y tooling.

## Screens

- Landing: PLAY (one tap, resumes last), gear, flame+best, "more puzzles" drawer handle. No tier picker, no tutorial.
- Board: back | tier | timer | hints | gear; scroll clue strip; category-header grid (entity=row, slot=cell); pool empties per column; thumb zone hint/check/reset. Seating reuses frame.
- End-card (held = screenshot): bag phrase + time/wrong/hints + streak + spoiler-safe bar + SHARE. Hero = gold tint + crown.
- Fail-card: encourage phrase + progress + reveal(opt-in)/retry.
- Settings: Audio, Look, Data, Credits (4 groups, sound mute-default).
- Stats: flame/best/solved, sparkline, 7-day dots (x=skip). No shame UI.
- Shape-drawer: tier + shape, behind PLAY, own route (clean back); grid/seating/round-table all live.

## Feedback (transform/opacity)

satisfy ring+check 180ms; violate slash+shake 120ms; near amber pulse; locked solid. Easy names clue, Standard count, Sharp/Expert binary. reduced-motion -> opacity-only. Colour never alone.

## Clue glyphs

eq A=B | neq A/B | ends [A.]/[.A] | adjacent A-B | distance A>k>B | before A>>B | opposite A<>B | between A-|-B. Text under glyph teaches vocab; generator uses only types with a legible glyph.

## Glyph assets (no inline SVG)

Every icon ships as a 24x24 currentColor file under `frontend/public/assets/glyphs/<pack>/<id>.svg`, referenced as `"pack.id"` (e.g. `household.tea`). Registry `glyphs/index.json` maps ref -> POSIX path; `config/glyphpacks.toml` holds labels only, file derived from the registry (no hardcoded paths, CLAUDE.md #6). `src/lib/glyphs.ts::glyphPath` resolves base-aware (`/yen-cinthanai/`); `Glyph.svelte` is the ONLY glyph renderer - components reference ids, never inline SVG.

## Components (11, metadata-driven)

TokenChip, Slot, SlotBoard, Pool, ClueChip, HUDBar, ActionBar, ResultCard, ShareBar, StatTile, SettingsRow (+ BottomSheet primitive). No per-screen bespoke.

## Tailwind tokens

colors bg/surface/ink/accent/satisfy/violate/near/gold (CSS vars, palette-swappable); space 4-32, targets >=48; radii 8/16; motion 120/180 transform+opacity. Config-driven (D16).

## See also
- [core-loop.md](core-loop.md) | [difficulty-and-scoring.md](difficulty-and-scoring.md) | [../architecture/runtime/stack-and-bundle.md](../architecture/runtime/stack-and-bundle.md)
