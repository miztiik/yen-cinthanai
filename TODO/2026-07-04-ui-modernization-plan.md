# UI Modernization + Grid-Primary - Execution Plan

**Last Updated**: 2026-07-04 (all 6 rows done; aurora theme + grid motif + desktop cell scaling; 465/465 green, typecheck clean)
**Level**: 5 (Row 5 changes the core-loop primary verb; user signed off 2026-07-04)

## 0. Operating contract

| Field | Value |
| --- | --- |
| Why this plan exists | Modernize the chrome (palette, gradient shell, typography, elevation, glyph-forward surfaces, drag-ring bug) and promote the built-but-unwired cross-out grid to the primary play surface. |
| Hard scope - in | De-violet palette + shell gradient; self-hosted variable fonts + lighter wordmark; oval snap-ring fix; `ui.*` chrome-glyph pack + kill placeholder tells; grid-as-primary (store glue + win-merge + `DayState.notes` persistence + Board wiring + doc amendments); board/puzzle-picker chrome modernization. |
| Hard scope - out | New puzzle content; generator/solver changes; monetisation; accounts; runtime backend; a11y audit tooling; `schemaVersion` bump (notes are additive-optional). |
| ESCALATE triggers | Row 5 IS the Level-5 escalation (signed off). Any further change to the frozen B-prime verb, or a `save` `schemaVersion` bump, re-escalates. |
| Chosen strategy | Ship visual rows (1-4) first for live iteration, then the grid row (5), then chrome that depends on the reshaped board (6). Ruled by Jony (chrome) + Palm/Fowler (grid) + user sign-off. |
| Parallel cap N | 1 (executed interactively-local this session; git ship deferred to explicit user authorization per CLAUDE.md section 8). |
| Authority personas | Carmack (runtime), Fowler (contracts), Jony (chrome), Palm (play), Player (mental model). |

## 1. Status Reckoner

| # | Row title | Depends-on | Parallel-group | Status | Worktree | PR | Subagent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | De-violet palette + gradient shell + elevation | - | A | DONE (local, verified) | - | - | - |
| 2 | App typography (variable fonts, lighter wordmark) | - | A | DONE (local, verified) | - | - | - |
| 3 | Fix oval drag highlight (square snap-ring) | - | A | DONE (local, verified) | - | - | - |
| 4 | `ui.*` glyph pack + kill placeholder tells | - | A | DONE (local, verified) | - | - | - |
| 5 | Grid as primary play surface (Level 5) | - | B | DONE (local, verified; 465/465 green) | - | - | - |
| 6 | Modernize board + puzzle-picker chrome | 1,4,5 | C | DONE (local, verified) | - | - | - |

## 2. Row #1 - De-violet palette + gradient shell + elevation

- **Scope:** Replace the violet inkwell neutrals with a de-violeted cool-charcoal palette, add a subtle fixed accent-glow background gradient, and give surfaces a shadow + hairline border so cards read as raised.
- **Files touched:** [config/palettes.json](../config/palettes.json), [frontend/public/config/palettes.json](../frontend/public/config/palettes.json) (baked), [frontend/src/app.css](../frontend/src/app.css), [frontend/src/state/save.svelte.ts](../frontend/src/state/save.svelte.ts), [frontend/tests/unit/settings.test.ts](../frontend/tests/unit/settings.test.ts), [docs/concepts/ui-shell.md](../docs/concepts/ui-shell.md).
- **Acceptance gates:** vitest (settings), `pytest tools -k "bake or schema"`, browser-verify (gradient renders, tokens applied, zero console errors), re-bake byte-identical.
- **Oracle:** computed `:root --bg` equals the new palette dark bg AND `body`/shell carries a non-flat `background-image`.
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | Neutrals de-violeted to cool charcoal; cool accent kept as the pop | Jony |
  | 2 | Gradient lives at the shell (fixed composited layer via tokens), NOT baked into solid color tokens | Carmack |
  | 3 | Elevation = shadow + hairline border (colour is one signal) | Jony |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | Bake the gradient into palette tokens | Tokens are solid single colours consumed by Tailwind `@theme`; the shell owns the gradient | Carmack |
  | 2 | `background-attachment: fixed` on `body` | Scroll-linked repaint jank on mobile; use a fixed `::before` composited layer | Carmack |

## 3. Row #2 - App typography (variable fonts, lighter wordmark)

- **Scope:** Add self-hosted `@fontsource-variable` display + body fonts, set an app-wide font stack, and retune the wordmark to a lighter weight.
- **Files touched:** [frontend/package.json](../frontend/package.json) (+ lockfile), [frontend/src/main.ts](../frontend/src/main.ts), [frontend/src/app.css](../frontend/src/app.css), [frontend/src/App.svelte](../frontend/src/App.svelte).
- **Acceptance gates:** typecheck, vitest, browser-verify (fonts load, wordmark lighter, zero console/404), named byte cost.
- **Oracle:** computed `body` font-family resolves to the body font AND the wordmark computed `font-weight` < 800.
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | Self-host via `@fontsource-variable` (static bundle, no runtime CDN) | Carmack |
  | 2 | Display face for wordmark/headings + body face for UI; wordmark weight ~380-500 | Jony |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | Google Fonts `<link>` CDN | Runtime third-party fetch (CLAUDE.md non-goal: static-first) | Carmack |
  | 2 | Keep the system stack | User rejected; no display character | user |

## 4. Row #3 - Fix oval drag highlight (square snap-ring)

- **Scope:** Constrain the snap-target ring to the puck's square box so the drag magnet ring is a circle, not an ellipse.
- **Files touched:** [frontend/src/components/Slot.svelte](../frontend/src/components/Slot.svelte), [frontend/src/components/SlotBoard.svelte](../frontend/src/components/SlotBoard.svelte) (grid-item alignment), [frontend/src/app.css](../frontend/src/app.css) (`.snap-target`).
- **Acceptance gates:** vitest (drag tests green), browser-verify (drag a token; ring is circular).
- **Oracle:** the element carrying `.snap-target` has equal width and height during a drag.
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | The slot drop-target must not stretch to the grid column; center it at the puck's intrinsic square size | Jony + Carmack |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | Fixed-radius `outline` instead of `box-shadow` | Still traces a non-square box - stays oval | Carmack |

## 5. Row #4 - `ui.*` glyph pack + kill placeholder tells

- **Scope:** Add a monochrome `ui.*` chrome-icon pack + a `tint` (CSS-mask) mode to `Glyph`, and replace the literal `gear`/`flame` words, the ASCII `* .` stars, and the `w0 h0` shorthand with icons + spelled labels.
- **Files touched:** `frontend/public/assets/glyphs/ui/*.svg` (new), [tools/bake_glyphs.py](../tools/bake_glyphs.py), [frontend/src/lib/Glyph.svelte](../frontend/src/lib/Glyph.svelte), [frontend/src/lib/glyphs.ts](../frontend/src/lib/glyphs.ts), [frontend/src/App.svelte](../frontend/src/App.svelte), [frontend/src/components/ResultCard.svelte](../frontend/src/components/ResultCard.svelte), [config/glyphpacks.json](../config/glyphpacks.json), tests.
- **Acceptance gates:** `pytest tools -k glyph`, vitest, browser-verify.
- **Oracle:** the header renders an icon element (not the text "gear"); result stars are glyph elements; the `ui` pack is excluded from puzzle dimensions.
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | Mono icons via CSS `mask` + `currentColor` so they adopt theme tokens | Jony |
  | 2 | `ui` pack excluded from puzzle dimensions (as `abstract` already is) | Jony + Carmack |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | Unicode/emoji icons | Violates Holy Law #10; inconsistent across Android | Jony |
  | 2 | Inline SVG sprite | Violates the no-inline-SVG rule; `Glyph` stays the one renderer | Jony |

## 6. Row #5 - Grid as primary play surface (Level 5)

- **Scope:** Build the grid store model (`gridTicks`/`gridManualX`/`gridDrop`/`gridTap`), merge grid ticks into the win evaluation, persist marks via optional `DayState.notes` (read-migration, no `schemaVersion` bump), and wire `GridMap` + `NotesGrid` as the Board's primary surface with `SlotBoard` kept only for a shared-cardinality category.
- **Files touched:** [frontend/src/state/play.svelte.ts](../frontend/src/state/play.svelte.ts), [frontend/src/lib/grid.ts](../frontend/src/lib/grid.ts), [frontend/src/contracts/save.ts](../frontend/src/contracts/save.ts), [schemas/save.schema.json](../schemas/save.schema.json), [frontend/src/components/Board.svelte](../frontend/src/components/Board.svelte), [frontend/src/components/NotesGrid.svelte](../frontend/src/components/NotesGrid.svelte), [frontend/src/components/GridMap.svelte](../frontend/src/components/GridMap.svelte), [docs/concepts/core-loop.md](../docs/concepts/core-loop.md), [docs/concepts/ui-shell.md](../docs/concepts/ui-shell.md), [TODO/2026-07-01-story-first-pivot.md](2026-07-01-story-first-pivot.md) (superseding note), tests (`notes.test.ts`, `grid-render.test.ts` + new contract/e2e).
- **Acceptance gates:** full vitest (the 5 currently-red grid tests go green), `pytest tools` unaffected, browser-verify (drag glyph into cell ticks + auto-X; win fires on a fully-correct grid; reload preserves marks), table semantics retained.
- **Oracle:** a fully-correct set of grid ticks drives `game.locked` true (win) AND a reload restores `gridTicks`/`gridManualX` (`DayState.notes` round-trip).
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | Grid is primary; `SlotBoard`+`Pool` kept ONLY for a shared-cardinality (non-bijective) category | Palm |
  | 2 | Auto-X only, never auto-tick the positive (preserves last-cell-standing) | Palm + user |
  | 3 | Win = `mergeGridPlacements(board, placements, gridTicks)` | Fowler |
  | 4 | Persist via optional `DayState.notes { manualX, scratchTicks, struckClues }`; `schemaVersion` stays 1 + read-migration | Fowler |
  | 5 | Amend core-loop.md "The verb" to grid-primary; token board demoted to shared-cardinality fallback | Palm |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | Fully delete `SlotBoard` | Breaks win/answer for shared-cardinality puzzles | Fowler |
  | 2 | Bump `save` `schemaVersion` 1->2 | `notes` is additive-optional; a bump would orphan installed saves | Fowler |
  | 3 | Tap-to-cycle grid verb | A second verb; drag-glyph keeps one verb across tiers | Palm |

## 7. Row #6 - Modernize board + puzzle-picker chrome

- **Scope:** Group the board HUD into zones, apply the card/shadow treatment to story/clue/result surfaces, lead the puzzle picker with glyphs, and cut redundant text.
- **Files touched:** [frontend/src/components/Board.svelte](../frontend/src/components/Board.svelte), [frontend/src/components/StoryPanel.svelte](../frontend/src/components/StoryPanel.svelte), [frontend/src/components/ClueList.svelte](../frontend/src/components/ClueList.svelte), [frontend/src/components/ResultCard.svelte](../frontend/src/components/ResultCard.svelte), [frontend/src/App.svelte](../frontend/src/App.svelte).
- **Acceptance gates:** vitest, browser-verify (HUD is 3 grouped zones; surfaces have elevation; picker leads with glyphs).
- **Oracle:** the board header renders exactly 3 grouped zones AND the puzzle picker renders a glyph per option.
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | HUD zones: `[back]` / status pill (`tier - time - try`) / `[hint]` | Jony |
  | 2 | Surfaces get `rounded-2xl` + hairline border + soft shadow | Jony |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | Per-screen bespoke HUD components | Metadata-driven generic chrome; no per-screen widgets | Jony |

## Execution contract (autonomous - follow blindly, do not re-plan)

When this plan is in context and the instruction is "implement it", execute with NO further questions except at an ESCALATE trigger.

1. **Row = unit of work.** Own the Status Reckoner and the dependency graph. Take each row whose `Depends-on` rows are DONE; flip `PENDING -> IN-FLIGHT -> DONE`.
2. **Tests ship with the row.** Full suite green at merge; pre-existing unrelated failures are documented as baseline, not gating (per CLAUDE.md Definition of Done).
3. **Browser-verify every runtime change** per CLAUDE.md section 12 (zero new console `[error]`/404; perf check when the render loop, drag, or asset load changes).
4. **Persona debate converges to ONE ruling** (Carmack / Fowler / Jony / Palm / Player per CLAUDE.md section 0a); bake the verdict into the row's Decisions table.
5. **Stop only at a real boundary:** an ESCALATE trigger, a STOP-AND-SURFACE scope-narrowing of a user-named source, or an audit chain past depth 3.
6. **Git hygiene** per CLAUDE.md section 8: stage explicit paths, small reversible commits on a named branch; push/PR/merge only on explicit user "ship/merge" authorization.
7. **Closure:** done when every in-scope row is DONE or COLLAPSED-with-rationale; docs updated in the right tier; no `[DEBUG]` left.
