# System Design Plan - yen-cinthanai daily logic-puzzle game

**Last Updated**: 2026-06-29

**Status**: SHIPPED 2026-06-29. P0-P9 merged (PR #1-#10) to master; live at https://miztiik.github.io/yen-cinthanai/. v1 + v2 (3 shapes, 4 tiers, shared-value, live themes) delivered. The master roadmap (section 12) is the single source of truth for status; the "Plan complete" block lists known non-blocking follow-ups. This is a plan-doc: the work ledger, not canonical docs. Spec is distilled to `docs/` (See also).

## See also

- [../CLAUDE.md](../CLAUDE.md) - engineering contract (Holy Laws, schema versioning, test tiers).
- [system-design-DRAFT.md](system-design-DRAFT.md) - the originating brainstorm (4 turns of CSP notes).
- [../docs/how-to/ship-to-github-pages.md](../docs/how-to/ship-to-github-pages.md) - deploy + base-path runbook.
- [../docs/reference/documentation-structure.md](../docs/reference/documentation-structure.md) - where findings land at distill time.
- Implementation spec (distilled): [../docs/concepts/core-loop.md](../docs/concepts/core-loop.md), [../docs/concepts/difficulty-and-scoring.md](../docs/concepts/difficulty-and-scoring.md), [../docs/concepts/ui-shell.md](../docs/concepts/ui-shell.md), [../docs/architecture/contracts/schemas.md](../docs/architecture/contracts/schemas.md), [../docs/architecture/generator/pipeline.md](../docs/architecture/generator/pipeline.md), [../docs/architecture/runtime/stack-and-bundle.md](../docs/architecture/runtime/stack-and-bundle.md).

---

## 1. Product in one paragraph

A daily logic-puzzle with ONE headline board a day: PLAY = one tap, everyone is on the same artifact, that is the ritual and the shareable conversation. The bundle still bakes 4 tiers (Easy, Standard, Sharp, Expert) into a "more puzzles" drawer and lets the player pick a shape (grid, seating row; round-table v2), but the front door never asks them to choose. They drag glyph tokens into slots, the pool empties as they deduce, clues are text + glyph, the board glows on satisfy and shakes on violate. Win or lose, a phrase from a bag of ~50 celebrates or encourages; beating a personal best triggers a hero's welcome. A static held end-card is the screenshot; share is shape-of-struggle, spoiler-safe. Progress, solve-times, streak, hero stats live in localStorage, retained while storage allows (prune only under pressure). History routing returns home in one tap. Plays offline once loaded.

## 2. Core verb (frozen)

"Drag a token into a slot to commit a deduction; the pool runs dry, clues glow, the board locks when every slot is correct." Tap-to-select then tap-slot is the mobile-equal fallback. One verb across every shape and tier.

## 2a. Genre abstraction (one engine, many skins)

Every puzzle reduces to: entities + slots (with a topology) + typed constraints + exactly one solution. Build the CSP engine once, skin it N ways. Position is NOT special - it is just an ordinal category. seating, grid, ranking, scheduling all fall out of one structure.

| Puzzle type | Slot topology | Typical constraints | v1 |
| --- | --- | --- | --- |
| Seating, row | linear sequence | adjacency, left/right-of, not-adjacent, ends | yes |
| Logic grid | N categories x M entities | same-row, exclusion, conditional, distance | yes |
| Round table | circular sequence | adjacency wraps, opposite, between | v2 |
| Race / ranking | ordered sequence | before/after, exact pos, gap | later |
| Scheduling | people x time grid | non-overlap, exactly-one, capacity | later |
| Pairing / grouping | partition into sets | same-group, never-same, size | later |

What is not public off-the-shelf is the solver-driven GENERATOR (uniqueness + minimal-clue pruning); the play surface is mature. That generator is the real build target, not the UI.

## 3. Frozen decisions (from advisor consult + user)

| # | Decision | Choice | Source |
| --- | --- | --- | --- |
| D1 | Shapes v1 | grid + seating-row via a SHAPE REGISTRY; round-table -> v2 (2 entries prove the seam) | review: Fowler/Player |
| D2 | Difficulty | 4 tiers: Easy, Standard, Sharp, Expert | Palm + Player (renamed Casual->Easy) |
| D3 | Cadence | ONE headline puzzle/day (Easy/grid/bijective cold-open); tiers+shapes = optional drawer | review: Palm/Jony/Player |
| D4 | Cardinality | mixed: bijective AND shared-value categories, engine handles both | user |
| D5 | Routing | History API + 404.html SPA fallback (clean URLs, deep links) | user |
| D6 | Component layer | Svelte 5 (~3.5KB) | Carmack + user |
| D7 | Generator | Python 3.12 + OR-Tools CP-SAT, build-time; in-browser solving via WASM allowed where it enriches play | user (WASM ok) |
| D8 | Hints | free + unlimited but COST THE BRAG: any hint -> excluded from hero/best, share stamps "hints" | Palm |
| D9 | Share | yes v1, shape-of-struggle: moves/0-wrong/time/no-hints/streak + shape label, never solution | Palm + Fowler |
| D10 | Audio | SFX mute-by-default, in a settings hub | user |
| D11 | Daily reset | 00:00 UTC, one global daily | user |
| D12 | Theme | 3 glyph packs v1 (household, creatures, abstract), palette-swappable; expands later | user |
| D13 | Streak | forgiving: 1 free skip/week, no shame UI | user |
| D14 | Budget/retention | RICHNESS-FIRST: no fixed shell/bundle cap; optimize (lazy, WASM, compression) only if mid-tier Android drops <60fps; progress retained while storage allows | user |
| D15 | Architecture | Pydantic on 3 boundary contracts; backend = pipes+filters; frontend = Svelte runes (no bus/adapters) | review: Fowler/Carmack |
| D16 | Config | config-driven for tunables (bags, dials, packs, budgets, retention) as pre-baked JSON; no runtime zod; Tailwind CSS | review: Carmack/Fowler |
| D17 | Logging | backend: structured Pydantic JSONL to `.logs/`; frontend: verbosity-gated console telemetry | user |

## 4. Architecture (build pipeline + Svelte runes, config-driven)

Two processes, one contract surface (the static JSON bank). No runtime backend.

```
BUILD TIME (Python, CI)                 RUNTIME (browser, static)
  config/*.toml -> generator             public/puzzles/*.json -> loader
  seed=UTC date -> solver (OR-Tools)         |                      |
  -> uniqueness + prune -> Pydantic          v                      v
  pipeline + JSONL .logs/                runes state -> board/drag/validate/hint
                                          -> save (localStorage) -> celebrate
```

- Backend = Pipes and Filters run once/day in CI: sample-solution -> add-clue -> verify-unique -> prune -> emit. Stages pass typed Pydantic models; swap any stage without touching neighbours. Pydantic stays on the 3 boundary contracts (manifest, bank index, save) - not on five fake "events".
- Frontend = Svelte 5 runes ($state/$derived). Known caller pairs (PuzzleSolved -> celebrate+save) are direct calls, not pub/sub. Loader validates JSON at the boundary only; shapes trust it downstream. One thin save module, no adapter pattern.
- Tunables drive from pre-baked JSON config: tier dials, glyph packs, copy bags, budgets, retention. Speculative config (schema field names, solver internals) stays in code.

## 5. Canonical schemas (versioned; contracts before logic)

Each persisted surface gets a typed schema with a `schemaVersion`. Only SAVE migrates (installed-player consequence per CLAUDE.md sec 11); bank/manifest are bundle-shipped so rewrite-in-place. Mixed cardinality (D4): each category carries `cardinality: bijective|shared` - bijective enforces values.length == entities and pool-depletion; shared allows repeats.

### 5.1 PuzzleManifest (schemaVersion 1)

| Field | Type | Notes |
| --- | --- | --- |
| schemaVersion | int | 1 |
| puzzleId | str | UTC date "2026-06-29" - also the seed |
| tier | enum | easy / standard / sharp / expert |
| shapeId | str | grid / seating-row (round-table v2) - SHAPE REGISTRY key |
| entities | id[] | ["e0".."eN"] (count derives length; no separate grid.entities) |
| categories.n | int | category count |
| categories | AttributeCategory[] | see below | category list (position = an ordinal category) |
| constraints | Constraint[] | see below | the clues |
| solution | map | canonical | entity -> {cat: value} |
| hintTrace | HintStep[] | ordered | {fromClues[id], forces{entity,cat,value}} - drives fog-of-war hints |
| templateRev | int | -> clueTemplateRegistry rev |

- AttributeCategory: { id, label, ordinal:bool, cardinality: bijective|shared, values:[{id, glyph, label}] }. ordinal -> supports adjacency/distance/before-after; nominal -> equality/exclusion only.
- Constraint: { id, type, operands:[ref], clueText, renderHint }. type from the catalog (sec 6c); clueText = templated NL filled from solution (no LLM); renderHint -> board glyph.
- HintStep: { fromClues:[ids], forces:{entity,cat,value} } - the next forced deduction, not a random reveal.

### 5.2 BankIndex (schemaVersion 1)
`{ schemaVersion, generatedSeed, builtAt, puzzles:[{date,tier,shapeId,file,sha}] }`. `sha` proves rebuild determinism; bundle-shipped, no migration.

### 5.3 Save (schemaVersion 1) - the only migrating surface

| Field | Type | Notes |
| --- | --- | --- |
| schemaVersion | int | 1 |
| days | map | date -> DayState; retained while storage allows, prune oldest only under pressure |
| hero | obj | { bestMs, date } |
| streak | obj | { count, lastDate, skipsLeft } (forgiving, D13) |
| settings | obj | sound, volume, theme, palette, reducedMotion (PLAY resumes last-played - no defaultTier/shape) |
| DayState | obj | date, tier, shapeId, status, placements, attempts, solveMs, hintsUsed, stars (1-3; PAR in config) |

Migration: prune oldest days only under storage pressure (hero/streak stats survive even when old puzzle JSON is gone); add field = minor; remove/retype = major + migrateV1toV2 on read. Yesterday's save always loads.

### 5.4 clueTemplateRegistry: ships once per bundle, keyed type+templateRev.

### 5.5 ShareCard (schemaVersion 1) - built ONLY from DayState stats, lands P1
`{ schemaVersion, date, tier, shapeGlyph, status, moves, wrong, solveMs, hintsUsed, streak }`. Zero fields reachable to placements/solution; shape-agnostic so identical bar across grid/seating/round-table. Contract test asserts no solution leak.

## 6. Extensibility - registries (so puzzle variations grow)

| Registry | Holds | v1 entries | Deferred |
| --- | --- | --- | --- |
| Shape | topology, slot rules, ordinal axis, maxEntities, render | grid, seating-row | round-table (v2, N<=6), ranking, scheduling, pairing, group |
| Constraint-type | solver clause + clueText template + glyph | eq, neq, adjacent, distance, before/after, ends, opposite | conditional, capacity, count |
| Glyph/theme pack | glyph -> svg + label | household, creatures, abstract | seasonal packs |

Adding a shape = one Shape entry + needed glyphs; engine and save untouched. This is what answers "evolve to more variations".

## 6a. Difficulty model (multi-dimensional, not entity-count alone)

Difficulty = entity count x clue density x cardinality mix x clue-type indirection x feedback mode x attempt budget. Tiers are presets over these dials; built and tuned as its own scorer, tested apart from the generator.

| Dial | Easy (cold-open) | Standard (headline) | Sharp | Expert |
| --- | --- | --- | --- | --- |
| entities x cats | 3x2 | 4x3 | 5x4 | 6x4-5 |
| clue density | dense, direct | balanced | sparse | minimal |
| cardinality | bijective | +1 shared | mixed | mixed + negative |
| feedback timing | real-time | on-demand check | check | submit only |
| feedback detail | names clue | count wrong | binary | binary |
| attempts | unlimited | 3 | 2 | 1 |
| hints (brag-cost) | unlimited | 2 | 1 | 0 |

Three dials are independent (timing, detail, attempts) - a fourth tier like "real-time + binary" is possible. Feedback detail decides whether a tier is a logic puzzle (binary/clue-level) or a search game (per-cell) - choose deliberately.

## 6b. Generation algorithm (build-time, no LLM)

1. seed = puzzleId(date)+tier -> seeded PRNG. 2. sample a full random solution. 3. enumerate every clue consistent with it. 4. strip clues by weighted sampling (harder tiers favour indirect types) while re-checking uniqueness. 5. uniqueness = solve, forbid that assignment, re-solve, expect INFEASIBLE. 6. prune to a minimal clue set. 7. fill clueText from templates; emit manifest. Same date+tier -> byte-identical (sha in BankIndex). Mixed cardinality handled natively by OR-Tools.

## 6c. Constraint catalog (v1) -> registry entries

eq (same value) | neq (exclusion) | ends (first/last) | adjacent | distance:k | before/after (ordinal) | opposite (round-table v2) | between (v2). Each = solver clause + clueText template + board glyph; generator may only use types with a legible glyph, so glyph vocabulary bounds difficulty.

## 6d. Precedents (non-text constraint signalling)

Tantrix (edge-match -> adjacency) | Mastermind (color satisfy/violate, no rules text) | Sudoku conflict highlight (pool-depletion) | Rummikub/Set (attribute tokens) | NYT Connections (grouping without naming the rule). De-risks the visual grammar; clue sentences are templated, not generated.

## 6e. Top risks

- Glyph grammar for relational clues (R&D, own design+playtest) - mitigated by text+glyph and bounding clue types to legible glyphs. - Mixed bijective+shared solver model heavier on uniqueness as categories grow. - Uniqueness bug: a 2-solution clue set is the classic generator failure - assert every build. - Difficulty calibration is multi-axis; scorer tested independently.

## 7. Repo layout (build vs runtime)

| Dir | Time | Contents |
| --- | --- | --- |
| config/ | both | tiers, dials, shapes, glyph packs, copy bags, budgets, retention - no hardcoding |
| tools/ | build | Python generator, OR-Tools solver, uniqueness, prune, Pydantic pipeline |
| assets/ | build | raw glyph svg |
| public/ | runtime | index.html, 404.html, puzzles/*.json, sw |
| src/ | runtime | state (runes), board, drag, validate, hint, save, celebrate, settings, share |
| tests/ | - | unit / contract / integration / e2e |

## 8. Celebration copy (config/copy.toml; ~50 each, D9)

Full bags ship in config, not code. Excerpt:
- SUCCESS: Case closed. | Airtight. | Pure logic. | Locked in. | Nailed it. | No gaps. | Watertight. | Elementary. | Bulletproof. | Crystal clear. | Mind like a vise. | Iron-clad. | Untangled. | Game, set, solved. | Masterwork. (extend to 50)
- ENCOURAGE: So close. | One clue off. | A single slip. | Recheck the row. | Trust the clues. | Tomorrow's yours. | One swap from glory. | Don't quit at 90. | Worth another pass. | Back tomorrow. (extend to 50)
- HERO (best-time): NEW RECORD - the board bows. | Fastest yet. | Personal best. | Record shattered. | Quickest mind on the board.

## 9. Settings hub (4 groups, D10): Audio (sound+volume), Appearance (theme+palette+reduced motion), Data (export/reset), Credits (asset attribution, required, 2 taps). No default-tier/shape - PLAY resumes last. localStorage, hero-board styled, uncluttered.

## 10. Test tiers / 11. Non-goals
Unit (validate, prune, seed determinism), contract (4 schemas vs readers/writers + migration + share no-leak), integration (solver uniqueness on fixtures), e2e (load->solve->win, reload keeps streak). Real fixtures, no mocks. Cut: accounts, leaderboards, ads/IAP/timers, adaptive AI, custom-puzzle maker. (In-browser WASM solving is allowed where it enriches play - D7.)

## 12. MASTER ROADMAP (single source of truth)

| Phase | Goal | Lvl | Status |
| --- | --- | --- | --- |
| P0 | Stack + repo + CI skeleton | 4 | done (PR #1) |
| P1 | Contracts: 4 schemas + tunable config | 4 | done (PR #2) |
| P2 | Generator: solver + uniqueness + grid bank (bijective) | 4 | done (PR #3) |
| P3 | Walking skeleton: landing + 1 grid puzzle playable | 3 | done (PR #4) |
| P4 | 4 tiers + brag-cost hints + save + stats | 3 | done (PR #5) |
| P5 | Seating-row shape + shape drawer | 2 | done (PR #6) |
| P6 | Celebrate end-card + share + settings + audio | 3 | done (PR #7) |
| P7 | PWA offline cache + daily CI + GH Pages | 3 | done (PR #8) |
| P8 | v2: round-table (N<=6) + shared-value categories | 3 | done (PR #9) |
| P9 | Richness: 5x4/6x5 grids (food/color packs) + live palette/theme | 3 | done (PR #10) |

### Sub-plans

| ID | Phase | Task | Status |
| --- | --- | --- | --- |
| P0.1 | P0 | vite6 + ts + svelte5 + tailwind init | done |
| P0.2 | P0 | config/ + .logs/ + history routing + 404.html | done |
| P0.3 | P0 | CI: lint/type/test/build gates | done |
| P1.1 | P1 | PuzzleManifest/BankIndex/Save/ShareCard v1 + contract tests (no-leak assert) | done |
| P1.2 | P1 | Pydantic contract models + tunable config JSON (no bus) | done |
| P2.1 | P2 | OR-Tools grid solver (bijective v1; shared field stays unused) | done |
| P2.2 | P2 | uniqueness + prune-to-minimal + seed=UTC + sha | done |
| P3.1 | P3 | landing (PLAY=resume) + loader + board + pointer drag/tap (transform-only) | done |
| P3.2 | P3 | validate-vs-constraints, satisfy/violate glyphs | done |
| P4.1 | P4 | 4-tier config + dials | done |
| P4.2 | P4 | hintTrace + brag-cost + stars/PAR + save + prune + migrate + stats | done |
| P5.1 | P5 | shape/constraint/glyph registries + maxEntities | done |
| P5.2 | P5 | seating-row + shape drawer (behind PLAY) | done |
| P6.1 | P6 | copy bags + hero beat + held end-card + share string | done |
| P6.2 | P6 | 4-group settings + Credits + SFX (mute default) | done |
| P7.1 | P7 | vite-plugin-pwa offline cache + nightly Action + base-path smoke | done |

## Plan complete

Shipped 2026-06-29. P0-P9 merged (PR #1-#10) to master; live at https://miztiik.github.io/yen-cinthanai/. Spec distilled to docs/concepts + docs/architecture (section See also). Plan-doc remains as the audit ledger.

Known follow-ups (non-blocking, not yet scheduled):
- DayState keyed by date only -> multiple tiers/shapes same day share one save slot; needs date+tier+shape key to track drawer puzzles independently.
- Glyphs render as currentColor <img>, so palette swap recolors chrome not glyph fill; color category uses pattern swatches.
- Daily bank holds today only in-repo; backfill or rely on the daily Action to accrete dates.
- Credits screen content + markdownlint blank-line nits in docs.

## 13. Open questions - RESOLVED in review (2026-06-29)
- Round-table legibility -> DEFERRED to P8: ship grid + seating-row v1; when round-table returns, cap N<=6, clues stay in the flat panel (never wrap on ring), wrap-relations draw as arc glyphs on tap (Jony). Two shapes still prove the registry.
- Spoiler-safe share -> ShareCard (sec 5.5) built only from DayState stats; shape-of-struggle bar + shape label, never solution; contract-tested no-leak; lands P1 (Palm/Fowler).
- Bank growth -> one file per puzzle, fetch-on-demand into Cache API for offline; no fixed byte cap (D14 richness-first); revisit only if the device slows.
