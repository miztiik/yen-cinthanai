# Core Loop

**Last Updated**: 2026-07-05

The verb, cadence, shapes, and tiers of yen-cinthanai - the rules that do not change per screen. Frozen v1 spec; tuning numbers live in [difficulty-and-scoring.md](difficulty-and-scoring.md).

## The verb

Tap a cross-out grid cell to cycle it: blank -> X (a negative guess) -> tick (the positive guess, shown as the glyph) -> blank. Ticking auto-X's the rest of that row and column (the bijective elimination), and the board locks when the ticks reconstruct the one solution. Click, tap, and Enter/Space are the same verb on mouse, touch, and keyboard. The token board (drag a token into a slot) survives only for a shared-cardinality category. One verb across every tier.

## The abstraction (one engine, many skins)

Every puzzle reduces to: entities + slots (a topology) + typed constraints + exactly one solution. Position is not special - it is an ordinal category. Seating, grid, ranking, scheduling all fall out of one structure.

| Type | Topology | Constraints | v1 |
| --- | --- | --- | --- |
| Seating row | linear | adjacency, ends, left/right-of | yes |
| Logic grid | N cats x M entities | eq, neq, distance, conditional | yes |
| Round table | circular | wraps, opposite, between | yes (v2) |
| Ranking / scheduling / pairing | ordered / time-grid / partition | before-after, capacity, group | later |

The hard part is the solver-driven generator (uniqueness + minimal-clue prune), not the UI. See [../architecture/generator/pipeline.md](../architecture/generator/pipeline.md).

## Cadence

One headline puzzle per day = the ritual + the shared artifact. PLAY is one tap: the first-ever play opens the Easy cold-open, otherwise it resumes the player's last-played tier (persisted in `settings.lastTier`). The four tiers (Easy/Standard/Sharp/Expert) are difficulty DIALS of the one game, not separate modes; they are chosen from a colour-coded difficulty sheet reached from a badge under PLAY or from the board - there is no separate "more puzzles" drawer, and the front door never asks the player to choose. Daily reset 00:00 UTC.

## First 60 seconds (Easy grid cold-open)

3 entities x 2 nominal categories, bijective, clue types eq+ends only. The first grid block is already open; the player taps a cell to eliminate (X), then a second tap on the forced cell confirms it (tick) and fires the auto-X cascade - the verb is taught by playing, no tutorial screen. Player wins by ~34s. Mixed cardinality and indirect clues graduate at Standard+.

## Hints

Free and unlimited but they cost the brag: any hint excludes the day from best-time and stamps "hints" on the share. Hint reveals the next forced step (hintTrace), not a random cell. Tier hint caps: Easy unlimited, Standard 2, Sharp 1, Expert 0.

## See also

- [difficulty-and-scoring.md](difficulty-and-scoring.md) - tier dials, scorer, stars, streak, copy.
- [ui-shell.md](ui-shell.md) - screens and components.
- [../architecture/contracts/schemas.md](../architecture/contracts/schemas.md) - manifest/save/bank/share.
