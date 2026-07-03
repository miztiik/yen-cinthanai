# Story-First Matrix Logic-Grid - Execution Plan

**Last Updated**: 2026-07-03 (COMPLETE - all rows merged; see [Plan complete](#plan-complete))
**Level**: 5 (core design / data model / runtime - authored per `.cladue/skills/prepare-plan`)

## 0. Operating contract

| Field | Value |
| --- | --- |
| Why this plan exists | Pivot yen-cinthanai from abstract glyph-clue seating puzzles to STORY-FIRST MATRIX logic-grid puzzles (narrative + full-sentence text clues + a cross-out elimination grid), generated verified-unique. |
| Hard scope - in | Matrix generator (scenario/story/categories/clue-richness/numeric/compound) + build-time quality-gate battery; `datasets/` authored corpus; cross-out grid frontend (drag-glyph + auto-X); flags glyph pack; JSON config. |
| Hard scope - out | seating-row + round-table shapes (RETIRED, F1); runtime backend; accounts; monetisation; a11y audit/framework tooling; scraping third-party puzzle content. |
| ESCALATE triggers (Level-5, pause for sign-off) | Any change to the frozen verb (B-prime: drag-glyph + auto-X) or to F1 (matrix-only); introducing auto-TICK of the positive; manifest `schemaVersion` 1->2 bump; PAR/star recalibration requiring on-device measurement. |
| Chosen strategy | F1 matrix-only + B-prime verb; generator-proven uniqueness (CP-SAT forbid-and-resolve); Expand -> Migrate -> Contract rollout; tests ship per row. Ruled by user sign-off + Fowler/Carmack/Palm/Jony/Player council. |
| Parallel cap N | 3 |

## 1. Status Reckoner

| # | Row title | Depends-on | Parallel-group | Status | Worktree | PR | Subagent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Extract `translator.py` (byte-identical) | - | A | DONE | merged | #15 | ✓ |
| 2 | Contracts + loaders (new manifest fields, categories/scenario JSON) | - | A | DONE | merged | #16 | ✓ |
| 3 | Generator emits story-first matrix shape | 1,2 | B | DONE | merged | #17 | ✓ |
| 4 | Frontend story panel + text ClueList + clue-strike | 3 | C | DONE | merged | #20 | ✓ |
| 5 | Numeric `kind` + numDiff/threshold | 3 | C | DONE | merged | #18 | ✓ |
| 6 | Compound clue types (oneOf/oneEachOf/ifThen) | 5 | D | DONE | merged | #19 | ✓ |
| 7 | Cross-out elimination grid + drag retarget | 4 | D | DONE | merged | #21 | ✓ |
| 8 | Flags glyph pack (country category) | - | A | DONE | merged | #22 | ✓ |
| 9 | Scale corpus + contract close (schema bump) | 5,6,7,8 | E | DONE | merged | #23-#28,#31 | ✓ |

## 2. Row #1 - Extract translator.py (byte-identical)

- **Scope:** Move clue-text templating out of `generate.py` into `tools/translator.py` with zero manifest byte change.
- **Files touched:** [tools/generate.py](../tools/generate.py), `tools/translator.py` (new), `tools/test_translator.py` (new).
- **Acceptance gates:** ruff, mypy, pytest (existing determinism/sha/hinttrace tests green), byte-identical manifest for the fixture date.
- **Oracle:** canonical-JSON sha of every tier's fixture manifest is IDENTICAL pre/post extract.
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | Clue text stays BAKED in the manifest (no runtime template registry) | Fowler |
  | 2 | Translator is a pure Message-Translator filter; the solver stays text-agnostic | Fowler |
  | 3 | ATOMIC-clue invariant: one constraint -> one sentence; N counts constraints, never rendered sentences | Palm |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | Client-side clue template registry (zebra4j i18n style) | No i18n / runtime re-skin beneficiary in scope; baked text is a daily-artifact feature | Fowler |

## 3. Row #2 - Contracts + loaders

- **Scope:** Add optional new manifest fields; read `datasets/categories.json` + scenario templates as JSON; Pydantic + TS readers tolerant of pre-pivot baked puzzles.
- **Files touched:** [tools/models.py](../tools/models.py), [frontend/src/contracts/manifest.ts](../frontend/src/contracts/manifest.ts), scenario/category loaders in `tools/`, [frontend/src/lib/loader.ts](../frontend/src/lib/loader.ts), tests.
- **Acceptance gates:** ruff/mypy/pytest/vitest; a pre-pivot v1 manifest still validates.
- **Oracle:** manifest emitter <-> TS reader round-trip on a golden file AND a pre-pivot v1 manifest validates against the tolerant reader.
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | Manifest adds `scenarioId`, `story`, `subjectNoun`, `variant`; AttributeCategory adds `kind`(nominal\|ordinal\|numeric) + `unit` + `anchor` + `glyphPack`; AttributeValue adds `magnitude` + `phrase` + `refPhrase` | Fowler |
  | 2 | Constraint envelope UNCHANGED; new clue types are new `type` strings + `params` | Fowler |
  | 3 | Save v1 UNTOUCHED; magnitude is a manifest property, never enters save | Fowler |
  | 4 | Scenario/category corpus authored as JSON under `datasets/` (single build-input home) | user |
  | 5 | All config is JSON (`config/*.json`); readers use `load_config` (done this cycle) | user |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | `config/scenarios/*.toml` authoring home | Split source-of-truth vs `datasets/`; project standardised on JSON | user |
  | 2 | Bump `schemaVersion` now | Expand phase keeps fields optional; bump only at Contract (Row 9) | Fowler |

## 4. Row #3 - Generator emits story-first matrix shape

- **Scope:** `build_categories` draws dimensions from `datasets/categories.json` (+ `glyphPack` decoration); emit story + full-sentence clues for one scenario+tier; write master to the date-keyed `datasets/` path; land the P1 forced-path gate green.
- **Files touched:** [tools/generate.py](../tools/generate.py), `tools/translator.py`, [datasets/categories.json](../datasets/categories.json), `datasets/templates/*.json`, [tools/test_generate.py](../tools/test_generate.py), `tools/test_quality.py` (new).
- **Acceptance gates:** ruff/mypy/pytest; uniqueness + minimal + determinism hold; `story` present + no-leak; P1 forced-path complete; P4 per-term tier sub-bands.
- **Oracle:** for the wired tier, the generated manifest is unique (`is_unique`) AND `len(hintTrace) == forceable-cell count` AND `story` contains no non-anchor value label.
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | F1: MATRIX (`shapeId` grid) is the only shape; seating-row + round-table retired | user |
  | 2 | Dimensions from `categories.json`; glyphs optional decoration via `glyphPack` (value.glyph = `{glyphPack}.{id}`, else text-only); alignment validated at bake | user + Carmack |
  | 3 | Master output to `datasets/YYYY/MM/DD/<tier>/<date>-<NNN>.json` (variant=NNN; seed=hash(date:tier:variant)); served bank DERIVED so BankIndex sha covers what ships | user |
  | 4 | Crown-jewel gate P1: `len(hintTrace) == forceable cells` (pure-logic solvable, zero guess) - green now, the tripwire for Row 6 | Fowler + Palm |
  | 5 | P4: enforce each D term (indir/N, N, DEPTH) vs its tier sub-band, not only the D sum | Palm |
  | 6 | Solutions ship in the manifest `solution` field (public app; no hiding). Only guards: stats-only ShareCard + story no-leak | user |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | Keep glyph-folder-IS-dimension auto-discovery | Story needs semantically-coupled categories; a random folder draw cannot provide coherence | Fowler |
  | 2 | Scrape third-party puzzles into the corpus | Copyright; the generator produces unlimited verified-unique originals | user |
  | 3 | Hand-author rich compound puzzles | A 5x4 with disjunctions is trivially non-unique by eye; the generator is the uniqueness guard | Fowler |

## 5. Row #4 - Frontend story panel + text ClueList + clue-strike

- **Scope:** Render story cold-open + numbered full-sentence clue list; retire the `ClueChip` glyph lexicon + 10px caption + side-scroller for the wired tier; add clue check-dot (strike) + auto-dim on satisfied.
- **Files touched:** `frontend/src/components/{StoryPanel,ClueList,ClueRow}.svelte` (new), [frontend/src/components/Board.svelte](../frontend/src/components/Board.svelte), retire [frontend/src/components/ClueChip.svelte](../frontend/src/components/ClueChip.svelte) usage, [frontend/src/lib/validate.ts](../frontend/src/lib/validate.ts), `config/ui.json`, vitest + Playwright.
- **Acceptance gates:** vitest + Playwright; browser-verify (zero new console `[error]`/404); a11y (semantic list, visible focus, aria-live).
- **Oracle:** e2e - load story puzzle -> narrative renders -> clues read as sentences -> solve -> win; reload preserves progress.
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | Text clue is PRIMARY; glyph/flag decorates axis headers only, never the clue language | Jony + Player |
  | 2 | Clue-strike PRESENT at all tiers incl Easy: trailing check-dot, clues start bright, reversible, never nags, never required | Palm + Player |
  | 3 | GAME auto-dim on satisfied gated by the FB dial (Easy / maybe Standard only; OFF Sharp/Expert - it leaks withheld feedback); the MANUAL check-dot is universal | Palm |
  | 4 | Clue placement: phone bottom-dock rail + pull-up full list; desktop right of grid (left = a setting) | Jony |
  | 5 | NO partial/sub-clue strike; atomic clues Easy/Standard, compound Sharp/Expert; the grid tracks partial facts | Palm |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | Move struck clues to a separate "Solved" list | Hides + reorders + breaks clue numbering | Jony |
  | 2 | Sub-checkbox per fact in a compound clue | Bookkeeping UI; the grid already tracks partial facts | Palm + Player |
  | 3 | Auto-detect a clue as "used" | Needs a runtime solver = leaks withheld feedback / solves-for-them | Palm |

## 6. Row #5 - Numeric kind + numDiff/threshold

- **Scope:** numeric category `kind` + integer `magnitude`; numDiff/threshold CP-SAT clauses + templates; DEFINITE-status uniqueness guard.
- **Files touched:** [tools/generate.py](../tools/generate.py), `tools/translator.py`, [tools/models.py](../tools/models.py), `datasets/templates/*.json`, [tools/test_generate.py](../tools/test_generate.py), `tools/test_quality.py`.
- **Acceptance gates:** ruff/mypy/pytest; magnitude round-trip; numeric facts true; DEFINITE status; band holds.
- **Oracle:** every enumerated numDiff/threshold clue holds under the sampled magnitudes AND `value.magnitude` survives emit -> JSON -> reparse as int identity.
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | numDiff = `AddAbsEquality` (as `distance:k`); threshold = one linear `Add`; integer-only magnitudes | Carmack |
  | 2 | DEFINITE-status guard: the uniqueness solve status is never UNKNOWN (hardware-timeout guard) | Carmack |
  | 3 | numeric-diff Standard+, threshold Sharp+, per the clue-type tier gates | Palm |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | Adopt SAT (pycosat) | CP-SAT gives the integer layer free; SAT needs bit-blasting for numeric | Carmack |
  | 2 | In-browser WASM solver | Runtime needs a checker, not a solver; zero WASM | Carmack |

## 7. Row #6 - Compound clue types

- **Scope:** oneOf/oneEachOf/ifThen (reified) + tier gates + indirection dial (name vs `refPhrase`); P1 gate now load-bearing.
- **Files touched:** [tools/generate.py](../tools/generate.py), `tools/translator.py`, `datasets/templates/*.json`, `tools/test_quality.py`.
- **Acceptance gates:** ruff/mypy/pytest; tier type-gate; indirection gate; P1 forced-path still complete WITH compound clues present.
- **Oracle:** P1 - for a generated Sharp/Expert manifest containing oneOf/ifThen, `len(hintTrace) == forceable cells` (still pure-logic solvable, no guessing).
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | Compound types Sharp/Expert only; `ifThen` <= 1 at Expert and 0 elsewhere; `oneOf` Sharp+ | Palm |
  | 2 | Indirection (`refPhrase`) rendered only at Sharp/Expert; names at Easy/Standard | Jony + Palm |
  | 3 | Reified via `OnlyEnforceIf` / `AddBoolOr` (already idiomatic in the model); determinism preserved (num_search_workers=1, fixed seed) | Carmack |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | conditional/ifThen at all tiers | Material implication is a casual-player trap; Expert-only experiment, cap 1 | Palm |
  | 2 | UI-tracked partial clue progress | The generator emits atomic clues; the grid is the partial tracker | Palm |

## 8. Row #7 - Cross-out elimination grid + drag retarget

- **Scope:** 4-state cell grid (blank / manual-X / auto-X / tick), drag-glyph-into-cell + auto-X the block row/col, one-block editor + read-only full-grid map; persist ticks (`placements`) + `notes`; fix the broken drag by retargeting to cell coordinates.
- **Files touched:** `frontend/src/components/{GridCell,NotesGrid,GridMap}.svelte` (new), [frontend/src/lib/drag.ts](../frontend/src/lib/drag.ts), [frontend/src/state/play.svelte.ts](../frontend/src/state/play.svelte.ts), [frontend/src/contracts/save.ts](../frontend/src/contracts/save.ts), `config/ui.json`, vitest + Playwright.
- **Acceptance gates:** vitest + Playwright; browser perf-verify (CPU 4x + Slow 4G: drop = one compositor frame, input-to-photon <50ms); a11y table semantics (th scope, cell buttons named, roving tabindex).
- **Oracle:** a drop places the glyph in the target cell + auto-Xs the block's row/col SKIPPING any manual-X; removing a tick reverts only auto-X (manual-X survive); reload restores marks.
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | B-prime verb: drag glyph into the correct cell (the positive) + auto-X the rest; tap = manual X | user + Palm |
  | 2 | Auto-X ONLY, NEVER auto-TICK the positive (all tiers) - preserves the last-cell-standing aha | user + Palm |
  | 3 | 4-state cell; only {tick, manualX} authored + persisted; auto-X + blank DERIVED (full recompute); one Svelte 5 `$state` matrix (per-leaf); bijective-only | Carmack |
  | 4 | X = neutral `ink` (not red; red = wrong); positive cell shows the entity GLYPH (not a generic tick); colour encodes STATE not category | Jony |
  | 5 | Persist ticks via existing `placements` + optional `DayState.notes{manualX,scratchTicks,struckClues}` keyed by semantic endpoints `catA:valA|catB:valB`; Save stays schemaVersion 1 | Carmack + Fowler |
  | 6 | Drag fix: cells get their own `data-*`; magnet retargets to cell centres; snapshot `slotCentres` at pointerdown scoped to the active block; keep Pointer Events, no non-passive `touchmove` | Carmack |
  | 7 | Shared-cardinality category stays token-only; win + answer-summary = merged placements (bijective grid UNION token sub-board) | Fowler |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | Tap-to-cycle X/tick grid (option B) | A different verb; drag-glyph keeps one verb across tiers | Palm + Jony |
  | 2 | Replace the token verb entirely | B-prime is additive; preserves muscle memory | Palm |
  | 3 | Full triangular grid as the phone edit surface | 11-17px cells unusable; one-block editor + read-only map navigator | Jony |
  | 4 | Derive `placements` as one `$derived` | Shared cat writes imperatively; keep authored placements + a separate notes matrix | Carmack |

## 9. Row #8 - Flags glyph pack (country category)

- **Scope:** Add a country glyph-backed category with an SVGO'd flag pack, byte-ceiling guard, per-file Cache-API lazy fetch.
- **Files touched:** `frontend/public/assets/glyphs/flags/*.svg`, [tools/bake_glyphs.py](../tools/bake_glyphs.py), `config/budgets.json`, [datasets/categories.json](../datasets/categories.json), PWA `runtimeCaching`, tests.
- **Acceptance gates:** ruff/pytest/vitest; the bake FAILS on an oversized SVG; the index bake auto-discovers the flags folder.
- **Oracle:** the bake rejects any flag SVG over `config max_svg_bytes`; a puzzle referencing `country` triggers <= entities flag fetches (not 250).
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | Flags = a glyph-backed category (country -> flags pack); alignment validated at bake | user + Carmack |
  | 2 | SVG + SVGO; per-file Cache-API lazy fetch; NOT an atlas, NOT precache-all; byte-ceiling in `budgets` | Carmack |
  | 3 | Flags render as a rounded-rect chip (not the circular Puck crop) | Jony |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | KTX2 / raster flags | Category error - 2D DOM, no WebGL; SVG is smaller at UI size | Carmack |
  | 2 | Precache the full 250-flag pack | Bloats install; daily cost is O(entities/day) | Carmack |

## 10. Row #9 - Scale corpus + contract close

- **Scope:** Author the scenario catalog to depth; `--force`-rebake FUTURE unpublished dates to v2; bump manifest `schemaVersion` 1->2 + tighten the reader (drop the optionals, drop `ordinal` for `kind`); recalibrate PAR/stars on the grid.
- **Files touched:** `datasets/templates/*.json`, [tools/generate.py](../tools/generate.py), [tools/models.py](../tools/models.py), [frontend/src/contracts/manifest.ts](../frontend/src/contracts/manifest.ts), `config/tiers.json`, `docs/`.
- **Acceptance gates:** ruff/mypy/pytest/vitest/Playwright; property sweep (P1/P3 + band + variety over N seeds); share no-leak; determinism.
- **Oracle:** the whole reachable archive validates at v2; property-sweep P1 holds for every sampled seed; NO published date reseeds (installed saves intact).
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | `--force` rebakes ONLY unpublished FUTURE dates; published dates stay frozen v1 (installed-save safety) | Fowler |
  | 2 | `schemaVersion` bump 1->2 only here (Contract phase), after the archive is uniformly v2 | Fowler |
  | 3 | Scenario floor 40-50 (content-repeat fatigue is the pivot's real cost) | Palm |
  | 4 | Answer-summary = PRIVATE win screen, no share CTA; shareable artifact stays stats-only; extend the share-no-leak test to `notes.*` | Palm |
  | 5 | PAR/stars re-measured per tier on the grid + phone IA before trusting 3-star (ESCALATE - needs device measurement) | Palm |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | `--force`-rebake the whole archive incl past dates | Reseeds solutions -> orphans saved games -> release blocker | Fowler |
  | 2 | Blanket-lower PAR for the grid | Auto-X deflates time unevenly; re-measure per tier on-device | Palm |

## 11. Quality-gate battery (per-row acceptance detail; council 2026-07-01)

Reject-and-reseed at build time; each gate ships WITH the row named. CI = fixed-date x 4 tiers, fast + deterministic; sweep = many seeds, weekly.

| Gate | Assertion | Row | CI/sweep |
| --- | --- | --- | --- |
| P1 forced-path complete (CROWN JEWEL) | `len(hintTrace) == forceable cells` (zero guess/backtrack) | 3 (green), 6 (load-bearing) | CI |
| P2 clean first move | a single-clue direct opener exists (Easy: reject if none) | 3 | CI |
| P3 deduction arc | wave-profile widths; reject all-at-once or thin-then-collapse | 5 | sweep |
| P4 tier FEEL | each D term (indir/N, N, DEPTH) inside its tier sub-band | 3 | CI |
| P5 clue-type balance | no type share > cap; tier-required class present | 3 | CI |
| P6 no aha-less grind | >=1 non-trivial step (>=2 clues or indirect) at Standard+ | 5 | CI |
| P7 story no-leak | story = subject/cast + category labels only; no value pairing | 3 | CI |
| T1 clue_text renders | no unfilled `{slots}`, ASCII | 1 | CI |
| T13 magnitude round-trips | int identity emit -> JSON -> reparse | 5 | CI |
| T14 numeric facts true | numDiff/threshold hold under sampled magnitudes | 5 | CI |
| T15 tier type-gate | `types <= allowed[tier]`; ifThen<=1 Expert, oneOf/distance Sharp+ | 6 | CI |
| T16 indirection gate | tier <= standard: no `refPhrase` rendered | 6 | CI |
| DEFINITE status | `is_unique` solve status never UNKNOWN | 5 | CI |
| Property sweep | P1/P3 + band + variety over N random seeds | 9 | sweep |
| Human-only (advisory, never a hard gate) | aha delight; 60s first-move findability; PAR/star; clue readability; implied story leak | playtest | - |

Structural note: any "which clue explains this step" gate needs a `minimal_explaining_set(step, clues)` helper as its OWN structural commit (current mention-based attribution over-counts).

## Execution contract (autonomous - follow blindly, do not re-plan)

When this plan is in context and the instruction is "implement it", execute as the ORCHESTRATOR with NO further questions except at an ESCALATE trigger. There is no processing step after this block - the rules below are the whole instruction set.

1. **Orchestrator + subagent-PR topology - subagent owns the full row lifecycle.** Main agent owns the Status Reckoner and the row-dependency graph; never lets its own context overflow; does NOT do git ops. Each ready PR-row is dispatched to a stateless `runSubagent` that owns the row end-to-end: branch, edit, commit, push, open PR, watch CI, fix-loop on its own PR, merge with `gh pr merge --squash --delete-branch`, post-merge hygiene (delete remote branch, prune `: gone` locals, remove `.tmp_*`), and the per-row distillation map per `docs/how-to/distill-a-plan.md`. The orchestrator only reads back the merged PR number and ticks the Reckoner.

2. **Worktree-per-subagent (mandatory isolation).** Before dispatch the orchestrator creates an isolated worktree: `git worktree add <ABS_PATH> -b <row-branch> origin/master` and passes that absolute path to the subagent. The subagent works ONLY inside that path. NEVER share a worktree across subagents - cross-agent contamination of the shared working tree is the #1 ship-time bug. Park master on `scratch-master-parking` so no worktree owns `master` (clean `gh pr merge`).

3. **Parallel fan-out, never idle on CI.** From the section-1 dependency graph the orchestrator dispatches all rows whose predecessors are DONE, concurrently, up to N (section-0 cap). The orchestrator MUST NOT wait for one row's CI to go green before dispatching the next non-blocked row - CI-watch and fix-loop are the subagent's job. As soon as a merge lands, the orchestrator recomputes the ready-set and re-saturates the fan-out.

4. **Subagent brief budget.** A brief is: (a) the row's section verbatim, (b) this EXECUTION BLOCK verbatim, (c) the absolute worktree path, (d) a pointer to `docs/how-to/ship-a-pr.md`. NOT the whole plan-doc. Target <= 200 lines of input context. The subagent reads more from disk on demand; the orchestrator does not push it.

5. **Persona debate converges to ONE ruling.** When a row hits a contested design call, run the repo's authority personas (Carmack, Fowler, Jony, Palm, Player per CLAUDE.md section 14) in DEBATE - not parallel review. Bake the single written verdict into the row's Decisions table and proceed.

6. **PR lifecycle.** Author per `docs/how-to/ship-a-pr.md`: 2-commit-then-squash, the Definition-of-Done gates (CLAUDE.md section 9), browser-verify any frontend runtime change (section 12). Tests ship with the row. Full suite green at merge. No new mocks unless asked. Pre-existing unrelated failures are not gating - document the baseline, do not block.

7. **Stop only at a real boundary.** Stop and ask ONLY when: an ESCALATE trigger fires (Level-5), an explicit user-named source/instruction would be scope-narrowed (STOP-AND-SURFACE per CLAUDE.md section 10), or an audit chain exceeds depth 3 (escalate with Path A/B/C options, do not ship a 4th audit). Otherwise do not pause; the user is not watching.

8. **Closure.** Done only when every in-scope row is DONE or COLLAPSED-with-cited-rationale. No-op rows carry a receipt (the command + its zero result). Archive the plan-doc with a per-row distillation map per `docs/how-to/distill-a-plan.md`.

## Plan complete

Closed 2026-07-03. All 9 rows merged to `master` (@ `aa3eebe`). Story-first matrix logic-grid is live at manifest `schemaVersion` 2; the seating / round-table engine is retired. Distillation map (durable knowledge was lifted to living docs during execution; this plan-doc remains the audit ledger):

- Row 1 (translator extract) -> [generator/pipeline.md](../docs/architecture/generator/pipeline.md) - translator is a pure Message-Translator filter; clue text stays baked in the manifest. PR #15.
- Row 2 (contracts + loaders) -> [contracts/schemas.md](../docs/architecture/contracts/schemas.md) - tolerant Pydantic/TS readers; new optional manifest fields. PR #16.
- Row 3 (story-first matrix generator) -> [generator/pipeline.md](../docs/architecture/generator/pipeline.md) + [concepts/core-loop.md](../docs/concepts/core-loop.md) - CP-SAT forbid-and-resolve uniqueness; P1-P7 quality gates; `shapeId` "grid". PR #17.
- Row 4 (story panel + ClueList) -> [concepts/ui-shell.md](../docs/concepts/ui-shell.md) - StoryPanel + text ClueList; soft/hard auto-dim keyed by tier feedback. PR #20.
- Row 5 (numeric kind + numDiff/threshold) -> [generator/pipeline.md](../docs/architecture/generator/pipeline.md) - reified magnitude-at-slot; numeric category MUST sit at index <= 2; `len(hints) == full_depth` generation invariant. PR #18.
- Row 6 (compound clues) -> [generator/pipeline.md](../docs/architecture/generator/pipeline.md) - oneOf/oneEachOf (Sharp+), ifThen (Expert, <= 1); per-tier category slice `cats[:tiers.categories]`. PR #19.
- Row 7 (cross-out grid) -> [concepts/ui-shell.md](../docs/concepts/ui-shell.md) - drag-glyph + auto-X (impliedX); 4-state cell; notes persistence. PR #21.
- Row 8 (flags glyph pack) -> [concepts/glyph-roadmap.md](../docs/concepts/glyph-roadmap.md) + [runtime/stack-and-bundle.md](../docs/architecture/runtime/stack-and-bundle.md) - `max_svg_bytes` budget guard; flags lazy CacheFirst (not precached). PR #22.
- Row 9 (scale + contract close) -> [contracts/schemas.md](../docs/architecture/contracts/schemas.md) + [generator/pipeline.md](../docs/architecture/generator/pipeline.md) - `schemaVersion` 1->2 (story-first required, ordinal dropped, matrix-only); 17 machine-checkable JSON Schemas each with an `evolution` log; incremental verification (`verifiedSha` per scenario). PRs #23-#28, #31.

Post-plan follow-ups (hygiene, not plan rows): scenario catalog scaled 4 -> 100 templates with tones balanced 25/25/25/25, all `verifiedSha`-stamped (#29, #30, #33-#37); flowers glyph cleanup + reusable `tools/wash_svg.py` (#32); `mergeGridPlacements` DataCloneError fix (#38).

Agent-only execution lessons distilled to `/memories/lessons-2026-07-01-story-first-pivot.md`.

Plan-doc remains as the audit ledger; do not edit further. New work starts a new plan-doc.

## See also

- [../CLAUDE.md](../CLAUDE.md) - Holy Laws, correction levels (section 6), schema versioning (section 11), agent roster (section 14).
- [2026-06-29-system-design.md](2026-06-29-system-design.md) - the v1 design this plan amends.
- [../docs/how-to/ship-a-pr.md](../docs/how-to/ship-a-pr.md), [../docs/how-to/distill-a-plan.md](../docs/how-to/distill-a-plan.md) - PR + closure rituals the EXECUTION BLOCK references.
- [../docs/architecture/contracts/schemas.md](../docs/architecture/contracts/schemas.md), [../docs/architecture/generator/pipeline.md](../docs/architecture/generator/pipeline.md), [../docs/architecture/runtime/stack-and-bundle.md](../docs/architecture/runtime/stack-and-bundle.md) - subsystem docs the rows update at distill time.
