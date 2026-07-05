# UI Shell

**Last Updated**: 2026-07-05

Screens, components, glyphs, tokens. Mid-tier Android portrait (~390x844). Tailwind for chrome only; canvas/board internals excluded. Glyph packs are auto-discovered from the asset tree (the GlyphManifest; 12+ and growing). Visual clarity (colour-is-one-signal), not a11y tooling.

## Screens

- Landing: PLAY (one tap; first-ever = Easy cold-open, else resumes the last-played tier), gear, flame+best, and a colour-coded difficulty badge (the ascending-bars TierMeter) bound directly under PLAY as one CTA cluster. Tapping the badge opens the difficulty sheet. No separate "more puzzles" drawer, no tier picker screen, no tutorial. The single-line "Yen Cinthanai" wordmark is a container-query lockup (fits one line from phone to desktop).
- Board: back | difficulty badge | timer | hints; story cold-open + numbered clue list; the cross-out grid (GridMap navigator + NotesGrid one-block editor) is the primary deduction surface; the token SlotBoard + pool appear only for a shared-cardinality category; thumb zone reset/check. The tier readout is the same tappable colour-coded difficulty badge (word-less; the level name is taught in the sheet), so difficulty is switchable in-place - lossless, since each (date,tier,shape) keeps its own save slot.
- End-card (held = screenshot): bag phrase + time/wrong/hints + streak + spoiler-safe bar + SHARE. Hero = gold tint + crown.
- Fail-card: encourage phrase + progress + reveal(opt-in)/retry.
- Settings: Audio, Look, Data, Credits (4 groups, sound mute-default).
- Stats: flame/best/solved, sparkline, 7-day dots (x=skip). No shame UI.
- Shape-drawer: tier + shape, behind PLAY, own route (clean back). Grid (the story matrix) is the only live shape; the seating-row/round-table positional engine is retired (matrix-only, Row 9d) - see [../architecture/generator/pipeline.md](../architecture/generator/pipeline.md).

## Feedback (transform/opacity)

satisfy ring+check 180ms; violate slash+shake 120ms; near amber pulse; locked solid. Easy names clue, Standard count, Sharp/Expert binary. reduced-motion -> opacity-only. Colour never alone.

## Clue glyphs

eq A=B | neq A/B | ends [A.]/[.A] | adjacent A-B | distance A>k>B | before A>>B | opposite A<>B | between A-|-B. Text under glyph teaches vocab; generator uses only types with a legible glyph.

## Story-first clues (Expand)

A story-first manifest (has `story`) swaps the glyph ClueChip strip for TEXT. StoryPanel renders the narrative cold-open; ClueList renders a numbered `<ol>` of full-sentence clues (glyphs/flags decorate the board axis headers only, never the clue language). Each ClueRow carries a trailing check-dot the player taps to strike that clue - a manual, reversible bookkeeping mark (clues start bright; never required, never nagged; LOCAL this session, persisted in Row 7 via `DayState.notes.struckClues`). A satisfied clue may ALSO auto-dim, but only on the soft feedback dials (easy realtime-names, standard count-wrong); sharp/expert (binary-check/submit-binary) never auto-dim so withheld feedback cannot leak. The soft-dial set is config-driven (`config/ui.json [clue].autoDimFeedback`); the chrome labels live in `config/copy.json [clues]`. Legacy (no-story) manifests keep the glyph ClueChip strip. Layout is chrome-only: a pull-down disclosure on phone, an always-open side panel to the right of the board on desktop. a11y: semantic `<ol><li>`, each dot a labelled `<button aria-pressed>`, visible focus ring, keyboard reachable, a polite live region announces each strike. See `src/lib/clues.ts` + `src/components/{StoryPanel,ClueList,ClueRow}.svelte`.

## Glyph assets (no inline SVG)

Every icon ships as a file under `frontend/public/assets/glyphs/<pack>/<name>.svg`, referenced `"pack.slug"`. Icons come from MANY sources (varied size/weight/paint - NOT all monochrome currentColor), so the UI normalizes them visually with the Puck (below), never by assuming one paint model. The manifest `glyphs/index.json` is GENERATED every build by `tools/bake_glyphs.py` (GlyphManifest v2: auto-discovers every folder + svg; `slug` = the `pack.slug` id, `file` = the descriptive kebab filename, `label` = derived). `src/lib/glyphs.ts::glyphPath`/`glyphLabel` resolve base-aware (`/yen-cinthanai/`); `Glyph.svelte` is the ONLY image renderer - components reference ids, never inline SVG. See [../architecture/contracts/schemas.md](../architecture/contracts/schemas.md) GlyphManifest v2.

## Puck (the circular normalizer) + drag magnet

Heterogeneous-source icons are normalized by seating each inside ONE standard circle - the Puck - so the eye groups by the repeated outer shape, not the mismatched interiors. Token, filled slot, and seat are all Pucks. Size is config-driven (`config/ui.toml [puck]`, no hardcoded px) and a player setting `puckSize` (small | medium | large, Settings > Look) scales the circle AND the inner glyph together (safe-area inset < 0.707 so the glyph never touches the rim); the Board provides it to every Puck via context. The state ring (selected/satisfy/violate/near/locked) lives in the border so it never reflows the grid. Dragging eases the puck toward the nearest valid slot centre once within capture range (`[snap]`: radius_factor x diameter + ease) and highlights that slot - a near-enough release snaps home (forgiving on a phone); capture/ease are pure + unit-tested, transform/opacity only, and tap-token-then-tap-slot stays the fallback. Two interaction invariants keep the drag honest on real devices: the glyph `<img>` is non-draggable (`draggable=false` + `-webkit-user-drag:none`, `Glyph.svelte` + `app.css`) so the browser's native image-drag can never hijack the pointer-drag on a laptop, and an OS-reclaimed pointer (`pointercancel` - scroll/zoom takeover, palm-reject) aborts the drag cleanly (no tap, no drop, capture + lifted chrome released) so a token never sticks mid-drag on touch.

## Components (metadata-driven)

Puck (the universal circular frame), Token, Slot, SlotBoard, Pool, GridMap, NotesGrid, GridCell, ClueChip, StoryPanel, ClueList, ClueRow, ActionBar, ResultCard, ShareBar, StatTile, SettingsRow (+ BottomSheet primitive). No per-screen bespoke; one Puck is the single circle used by token + filled slot + seat. Story-first manifests render StoryPanel + ClueList (text) + the cross-out grid (GridMap + NotesGrid) as the primary surface; the token SlotBoard + Pool remain only for a shared-cardinality column.

## Tailwind tokens

colors bg/surface/ink/accent/satisfy/violate/near/gold (CSS vars, palette-swappable); space 4-32, targets >=48; radii 8/16; motion 120/180 transform+opacity. Config-driven (D16).

## Ambient shell + difficulty badge

The whole-app background is a fixed, composited two-layer aurora (app.css): layer A (`body::before`) slowly transform-drifts; layer B (`html::before`) is a warmer bloom set whose OPACITY cross-fades over minutes so the palette appears to shift imperceptibly - transform + opacity only, so an animation that runs forever costs the compositor ~nothing (never `background-position` / `@property`-stop / `filter`, which repaint a full-viewport layer every frame). Both layers are token-tied (restyle on a palette swap); the timing (`driftSeconds` / `shiftSeconds` / `shiftDepth`) is config-driven in `config/ui.json [ambient]`, applied by `lib/ambient.ts` as CSS custom properties; reduced-motion zeroes it to a static warm field.

Difficulty is a colour-coded `TierMeter` (a row of ascending bars, `rank` filled in the tier's token colour) - the bar COUNT carries the level so the word is dropped from the badge (colour never alone; the aria-label + the sheet's names carry it for a screen reader). It is chrome (tokenized `<div>`/`<span>` bars, the ResultCard progress-bar precedent), NOT a glyph icon, so Holy Law #10 is untouched. Order + per-tier colour live in `config/ui.json [difficulty]`. The `DifficultyPicker` sheet (bottom on phone, centered on desktop) lists every tier as name + bars and hands the pick back to the caller, which loads that tier's puzzle.

## See also

- [core-loop.md](core-loop.md) | [difficulty-and-scoring.md](difficulty-and-scoring.md) | [../architecture/runtime/stack-and-bundle.md](../architecture/runtime/stack-and-bundle.md)
