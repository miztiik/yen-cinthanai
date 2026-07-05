# UI Shell

**Last Updated**: 2026-07-05

Screens, components, glyphs, tokens. Mid-tier Android portrait (~390x844). Tailwind for chrome only; canvas/board internals excluded. Glyph packs are auto-discovered from the asset tree (the GlyphManifest; 12+ and growing). Visual clarity (colour-is-one-signal), not a11y tooling.

## Screens

- Landing: PLAY (one tap; first-ever = Easy cold-open; a returning player resumes their last tier while today's puzzle for it is unsolved, else PLAY advances to the next unsolved tier today so it always lands on a PLAYABLE puzzle rather than resuming a solved board's result card - only when EVERY tier is solved today does PLAY reopen the last result; `nextPlayableTier` in `lib/scoring.ts`), gear, flame+best, and a colour-coded difficulty pill (ascending TierMeter bars + the tier NAME in its standardized colour, which tracks the tier PLAY will launch) bound directly under PLAY as one CTA cluster; tapping it opens the difficulty sheet (pick any tier to replay/review). No separate "more puzzles" drawer, no tier picker screen, no tutorial. The single-line "Yen Cinthanai" wordmark is a container-query lockup (fits one line phone-to-desktop) in thin uppercase Josefin Sans with the cross-app rainbow gradient.
- Board: a single centered header island (back | difficulty | timer/attempts | hints), grouped by hairline dividers so the chrome never sprays across the wide desktop board; a day-nav strip below the header (prev/next-day carets flanking the current-day label - "Today" or e.g. "Sun 29 Jun") moves between the shipped days, next disabled at today (never future) and prev at the oldest shipped day (see Route grammar; switching difficulty keeps the current day); story cold-open + numbered clue list; the cross-out grid is the primary deduction surface - the GridMatrix full staircase on desktop (>=lg), the GridMap navigator + NotesGrid one-block editor on phone; the token SlotBoard + pool appear only for a shared-cardinality category; thumb-zone reset/check. RESET clears the token placements AND the cross-out marks (ticks + manual-X); a spent attempt cap shows the fail card whose RETRY restores a full attempt budget and restarts the clock (which freezes while the fail card is up). The difficulty readout is the same tappable colour-coded badge (its tier NAME shown from sm+, plus a hover title; word-less only on the tight phone header, where the sheet teaches the names), so difficulty is switchable in-place - lossless, since each (date,tier,shape) keeps its own save slot.
- End-card (held = screenshot): bag phrase + time/wrong/hints + streak + spoiler-safe bar + SHARE. Hero = gold tint + crown.
- Fail-card: encourage phrase + progress + reveal(opt-in)/retry.
- Settings: Sound, Appearance, Display, Data (sound mute-default; the Display group toggles color / glyphs / text labels, mirrored by the in-puzzle display sheet - see Board).
- Stats: a bento grid (bounded max-w-3xl, phone-to-desktop) - a flame day-streak hero tile, best + solved, a solve-time sparkline, a 7-day weekday calendar (a won day is a filled dot carrying a star, a missed day a quiet outline - never a scold, today ringed for orientation), and a gold stars-earned tile. One `StatTile` primitive; hierarchy from tile size + one gold accent, not decoration. No shame UI.
- Shape-drawer: tier + shape, behind PLAY, own route (clean back). Grid (the story matrix) is the only live shape; the seating-row/round-table positional engine is retired (matrix-only, Row 9d) - see [../architecture/generator/pipeline.md](../architecture/generator/pipeline.md).

## Route grammar

The whole URL surface is `/` (landing), `/stats`, `/settings`, and the play routes. The canonical play route is DATE-FIRST: `/play/<date>/<tier>` (`<date>` = `YYYY-MM-DD` UTC, `<tier>` in easy|standard|sharp|expert), aligned with the served file `puzzles/<date>-<tier>.json` and the save slot key `<date>|<tier>|<shapeId>` (`state/save.svelte::dayKey`). `/play/<tier>` and bare `/play` are retained ALIASES meaning "today's <tier>" / "today's next playable tier"; on load the Board resolves the day and unfurls the address bar to the dated form via `lib/router.svelte::syncLocation` (a `replaceState` that touches only the address bar - no remount, no BACK trap). Parsing (`lib/play-route.ts::parsePlay`) is order-tolerant; the builder (`playPath`) is always date-first. A dated link to a day the shipped bank no longer holds (aged past the rolling window, or a future date) falls back to the newest puzzle for that tier with a quiet notice - never a hard error. `TODAY` is UTC everywhere (loader, Stats, save), so the dated permalink is device-clock-independent and offline/share-stable. Day-to-day movement plus the "which day am I on" label live on the Board (see Screens).

### Design rationale

The URL is a contract read by the player (bookmark/share) and by the next build (resolve). Date-first makes the URL speak the bank's own key language (`date` + `tier`), the only two source-of-truth segments; `puzzleId`/`scenarioId`/`shapeId`/`file` stay derived and never appear in the URL. The dated permalink is the offline-stable form: a bookmarked dated link resolves from a stale cached bank index, whereas the bare alias dereferences through the device clock and can hard-fail at the UTC day boundary offline. Authority: User (day navigation + linkable dated URL), Carmack (canonicalize via replaceState; UTC determinism), Fowler (additive grammar; aliases grandfathered).

### Rejected alternatives

- Tier-only URL `/play/<tier>` as canonical - not linkable to a specific day and inverts the date-first layout the served files + save key already use. Kept only as an alias. (User)
- Opaque `puzzleId` in the URL (`/play/<tier>/<puzzleId>`) - a second source of truth that rots against the bank index when ids re-mint; no reverse id->file index exists. (Fowler)
- Hash routing (`#/play/...`) - uglier share URLs, murkier service-worker navigation; the existing `404.html` SPA mirror already boots history deep links. (Carmack)

## Feedback (transform/opacity)

satisfy ring+check 180ms; violate slash+shake 120ms; near amber pulse; locked solid. Easy names clue, Standard count, Sharp/Expert binary. reduced-motion -> opacity-only. Colour never alone.

## Clue glyphs

eq A=B | neq A/B | ends [A.]/[.A] | adjacent A-B | distance A>k>B | before A>>B | opposite A<>B | between A-|-B. Text under glyph teaches vocab; generator uses only types with a legible glyph.

## Story-first clues (Expand)

A story-first manifest (has `story`) swaps the glyph ClueChip strip for TEXT. StoryPanel renders the narrative cold-open; ClueList renders a numbered `<ol>` of full-sentence clues (glyphs/flags decorate the board axis headers only, never the clue language). Each ClueRow carries a trailing check-dot the player taps to strike that clue - a manual, reversible bookkeeping mark (clues start bright; never required, never nagged; LOCAL this session, persisted in Row 7 via `DayState.notes.struckClues`). A satisfied clue may ALSO auto-dim, but only on the soft feedback dials (easy realtime-names, standard count-wrong); sharp/expert (binary-check/submit-binary) never auto-dim so withheld feedback cannot leak. The soft-dial set is config-driven (`config/ui.json [clue].autoDimFeedback`); the chrome labels live in `config/copy.json [clues]`. Legacy (no-story) manifests keep the glyph ClueChip strip. Layout is chrome-only: a pull-down disclosure on phone, an always-open side panel to the right of the board on desktop. a11y: semantic `<ol><li>`, each dot a labelled `<button aria-pressed>`, visible focus ring, keyboard reachable, a polite live region announces each strike. See `src/lib/clues.ts` + `src/components/{StoryPanel,ClueList,ClueRow}.svelte`.

## Glyph assets (no inline SVG)

Every icon ships as a file under `frontend/public/assets/glyphs/<pack>/<name>.svg`, referenced `"pack.slug"`. Icons come from MANY sources (varied size/weight/paint - NOT all monochrome currentColor), so the UI normalizes them visually with the Puck (below), never by assuming one paint model. The manifest `glyphs/index.json` is GENERATED every build by `tools/bake_glyphs.py` (GlyphManifest v2: auto-discovers every folder + svg; `slug` = the `pack.slug` id, `file` = the descriptive kebab filename, `label` = derived). `src/lib/glyphs.ts::glyphPath`/`glyphLabel` resolve base-aware (`/yen-cinthanai/`); `Glyph.svelte` is the ONLY image renderer - components reference ids, never inline SVG. See [../architecture/contracts/schemas.md](../architecture/contracts/schemas.md) GlyphManifest v2.

## Puck (the circular normalizer) + drag magnet

Heterogeneous-source icons are normalized by seating each inside ONE standard circle - the Puck - so the eye groups by the repeated outer shape, not the mismatched interiors. Token, filled slot, and seat are all Pucks. The logic-grid AXIS HEADERS reuse the same idea through a static, context-free sibling, `GlyphSeat` (a fixed circle + the medium Puck inset), on BOTH axes of BOTH grids (GridMatrix + NotesGrid), so a column of animals or crops aligns identically to the rows regardless of each SVG's own artboard margins - the same no-mix `glyphComplete` gate applies (an axis shows seats only when EVERY value has art, else text). Size is config-driven (`config/ui.toml [puck]`, no hardcoded px) and a player setting `puckSize` (small | medium | large, Settings > Look) scales the circle AND the inner glyph together (safe-area inset < 0.707 so the glyph never touches the rim); the Board provides it to every Puck via context. The state ring (selected/satisfy/violate/near/locked) lives in the border so it never reflows the grid. Dragging eases the puck toward the nearest valid slot centre once within capture range (`[snap]`: radius_factor x diameter + ease) and highlights that slot - a near-enough release snaps home (forgiving on a phone); capture/ease are pure + unit-tested, transform/opacity only, and tap-token-then-tap-slot stays the fallback. Two interaction invariants keep the drag honest on real devices: the glyph `<img>` is non-draggable (`draggable=false` + `-webkit-user-drag:none`, `Glyph.svelte` + `app.css`) so the browser's native image-drag can never hijack the pointer-drag on a laptop, and an OS-reclaimed pointer (`pointercancel` - scroll/zoom takeover, palm-reject) aborts the drag cleanly (no tap, no drop, capture + lifted chrome released) so a token never sticks mid-drag on touch.

## Components (metadata-driven)

Puck (the universal circular frame), GlyphSeat (the Puck principle at header scale - seats a value glyph in a fixed circle so a logic-grid axis of heterogeneous-source art aligns identically regardless of source SVG), Token, Slot, SlotBoard, Pool, GridMap, NotesGrid, GridCell, ClueChip, StoryPanel, ClueList, ClueRow, ActionBar, ResultCard, ShareBar, StatTile, SettingsRow (+ BottomSheet primitive). No per-screen bespoke; one Puck is the single circle used by token + filled slot + seat. Story-first manifests render StoryPanel + ClueList (text) + the cross-out grid (GridMap + NotesGrid) as the primary surface; the token SlotBoard + Pool remain only for a shared-cardinality column.

## Tailwind tokens

colors bg/surface/ink/accent/satisfy/violate/near/gold (CSS vars, palette-swappable); space 4-32, targets >=48; radii 8/16; motion 120/180 transform+opacity. Config-driven (D16).

## Ambient shell + difficulty badge

The whole-app background is a fixed, composited two-layer aurora (app.css): layer A (`body::before`) slowly transform-drifts; layer B (`html::before`) is a warmer bloom set whose OPACITY cross-fades over minutes so the palette appears to shift imperceptibly - transform + opacity only, so an animation that runs forever costs the compositor ~nothing (never `background-position` / `@property`-stop / `filter`, which repaint a full-viewport layer every frame). Both layers are token-tied (restyle on a palette swap); the timing (`driftSeconds` / `shiftSeconds` / `shiftDepth`) is config-driven in `config/ui.json [ambient]`, applied by `lib/ambient.ts` as CSS custom properties; reduced-motion zeroes it to a static warm field.

Difficulty is a colour-coded `TierMeter` (ascending bars, `rank` filled in the tier's colour) - the bar COUNT carries the level. The badge shows the tier NAME alongside the bars wherever there is room (the landing pill; the board header island from sm+) plus a hover `title`; the word is dropped only on the tight phone board header, where the aria-label + the sheet's names carry it for a screen reader (colour never alone). It is chrome (tokenized `<span>` bars, the ResultCard progress-bar precedent), NOT a glyph icon, so Holy Law #10 is untouched. Order + per-tier colour live in `config/ui.json [difficulty]`; the colours are the cross-app STANDARDIZED difficulty ramp (green #22c55e -> yellow #eab308 -> orange #f97316 -> red #ef4444, shared with the sibling app). The `DifficultyPicker` sheet lists every tier as name + bars. The wordmark face (Josefin Sans, thin, uppercase) and its rainbow gradient are likewise standardized with the sibling app.

## See also

- [core-loop.md](core-loop.md) | [difficulty-and-scoring.md](difficulty-and-scoring.md) | [../architecture/runtime/stack-and-bundle.md](../architecture/runtime/stack-and-bundle.md)
