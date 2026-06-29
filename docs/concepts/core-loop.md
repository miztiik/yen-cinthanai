# Core Loop

**Last Updated**: 2026-06-29

The verb, cadence, shapes, and tiers of yen-cinthanai - the rules that do not change per screen. Frozen v1 spec; tuning numbers live in [difficulty-and-scoring.md](difficulty-and-scoring.md).

## The verb

Drag a token into a slot to commit a deduction; the pool runs dry, clues glow, the board locks when every slot is correct. Tap-token-then-tap-slot is the mobile-equal fallback. One verb across every shape and tier.

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

One headline puzzle per day = the ritual + the shared artifact. PLAY is one tap, resumes last-played. Four tiers (Easy/Standard/Sharp/Expert) and shapes live in a "more puzzles" drawer; the front door never asks the player to choose. Daily reset 00:00 UTC.

## First 60 seconds (Easy grid cold-open)

3 entities x 2 nominal categories, bijective, clue types eq+ends only. Move one is a single eq one token satisfies. Player wins by ~34s; the verb is taught by playing, no tutorial screen. Mixed cardinality and indirect clues graduate at Standard+.

## Hints

Free and unlimited but they cost the brag: any hint excludes the day from best-time and stamps "hints" on the share. Hint reveals the next forced step (hintTrace), not a random cell. Tier hint caps: Easy unlimited, Standard 2, Sharp 1, Expert 0.

## See also

- [difficulty-and-scoring.md](difficulty-and-scoring.md) - tier dials, scorer, stars, streak, copy.
- [ui-shell.md](ui-shell.md) - screens and components.
- [../architecture/contracts/schemas.md](../architecture/contracts/schemas.md) - manifest/save/bank/share.
- [../../TODO/2026-06-29-system-design.md](../../TODO/2026-06-29-system-design.md) - plan-doc.
