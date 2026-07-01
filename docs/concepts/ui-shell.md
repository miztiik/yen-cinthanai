# UI Shell

**Last Updated**: 2026-06-30

Screens, components, glyphs, tokens. Mid-tier Android portrait (~390x844). Tailwind for chrome only; canvas/board internals excluded. Glyph packs are auto-discovered from the asset tree (the GlyphManifest; 12+ and growing). Visual clarity (colour-is-one-signal), not a11y tooling.

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

Every icon ships as a file under `frontend/public/assets/glyphs/<pack>/<name>.svg`, referenced `"pack.slug"`. Icons come from MANY sources (varied size/weight/paint - NOT all monochrome currentColor), so the UI normalizes them visually with the Puck (below), never by assuming one paint model. The manifest `glyphs/index.json` is GENERATED every build by `tools/bake_glyphs.py` (GlyphManifest v2: auto-discovers every folder + svg; `slug` = the `pack.slug` id, `file` = the descriptive kebab filename, `label` = derived). `src/lib/glyphs.ts::glyphPath`/`glyphLabel` resolve base-aware (`/yen-cinthanai/`); `Glyph.svelte` is the ONLY image renderer - components reference ids, never inline SVG. See [../architecture/contracts/schemas.md](../architecture/contracts/schemas.md) GlyphManifest v2.

## Puck (the circular normalizer) + drag magnet

Heterogeneous-source icons are normalized by seating each inside ONE standard circle - the Puck - so the eye groups by the repeated outer shape, not the mismatched interiors. Token, filled slot, and seat are all Pucks. Size is config-driven (`config/ui.toml [puck]`, no hardcoded px) and a player setting `puckSize` (small | medium | large, Settings > Look) scales the circle AND the inner glyph together (safe-area inset < 0.707 so the glyph never touches the rim); the Board provides it to every Puck via context. The state ring (selected/satisfy/violate/near/locked) lives in the border so it never reflows the grid. Dragging eases the puck toward the nearest valid slot centre once within capture range (`[snap]`: radius_factor x diameter + ease) and highlights that slot - a near-enough release snaps home (forgiving on a phone); capture/ease are pure + unit-tested, transform/opacity only, and tap-token-then-tap-slot stays the fallback. Two interaction invariants keep the drag honest on real devices: the glyph `<img>` is non-draggable (`draggable=false` + `-webkit-user-drag:none`, `Glyph.svelte` + `app.css`) so the browser's native image-drag can never hijack the pointer-drag on a laptop, and an OS-reclaimed pointer (`pointercancel` - scroll/zoom takeover, palm-reject) aborts the drag cleanly (no tap, no drop, capture + lifted chrome released) so a token never sticks mid-drag on touch.

## Components (metadata-driven)

Puck (the universal circular frame), Token, Slot, SlotBoard, Pool, ClueChip, HUDBar, ActionBar, ResultCard, ShareBar, StatTile, SettingsRow (+ BottomSheet primitive). No per-screen bespoke; one Puck is the single circle used by token + filled slot + seat.

## Tailwind tokens

colors bg/surface/ink/accent/satisfy/violate/near/gold (CSS vars, palette-swappable); space 4-32, targets >=48; radii 8/16; motion 120/180 transform+opacity. Config-driven (D16).

## See also

- [core-loop.md](core-loop.md) | [difficulty-and-scoring.md](difficulty-and-scoring.md) | [../architecture/runtime/stack-and-bundle.md](../architecture/runtime/stack-and-bundle.md)
