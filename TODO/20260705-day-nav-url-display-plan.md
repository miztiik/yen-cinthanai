# Day navigation, dated URLs, and in-puzzle display mode - execution plan

**Last Updated**: 2026-07-05
**Level**: 4 (multi-row, structural; touches the URL contract and the save-settings contract - both user-ratified core-design surfaces, so no Level-5 pause unless a trigger below fires)

## Section 0 - Operating contract

| Field | Value |
| --- | --- |
| Why this plan exists | Expose the already-shipped rolling 7-day bank as playable past days, give the player in-board day navigation + wayfinding, and add an in-puzzle display-mode (color / glyphs / text) toggle. |
| Hard scope - in | Date-first canonical route `/play/<date>/<tier>`; unfurl the bare/alias URL to the dated form on load; in-board date label + prev/next-day carets; tappable Stats calendar for past days; additive `settings.display` (color, glyphs, labels) toggle reachable from both the board and Settings. |
| Hard scope - out | Any archive deeper than the shipped rolling 7-day window; a month/date-picker calendar; a "challenge a friend" or per-share-id URL; server / account / sync; changing how puzzles are generated or how many days the daily job backfills. |
| ESCALATE triggers | (1) Any save `schemaVersion` MAJOR bump / read-migration - the display setting must stay additive-optional at v1; if not, PAUSE (Holy Law #11, Level-5). (2) Any deviation from the ratified canonical grammar `/play/<date>/<tier>` date-first (hash routing, tier-first, or opaque `puzzleId` in the URL) - PAUSE. (3) Exposing more than the shipped rolling 7-day window (unbounded archive) - PAUSE (bundle-weight + daily-scarcity, Level-5). (4) Removing the `/play/<tier>` + bare `/play` aliases (breaks existing shared/bookmarked links) - PAUSE. |
| Chosen strategy | Reveal the existing 7-day rolling bank via a date-first canonical URL, in-board carets + date label, tappable Stats calendar, and an additive in-puzzle display toggle; the alias/today URL unfurls to the dated form. Ruled by User (supersedes personas, CLAUDE.md section 0); mechanics per Carmack (replaceState canonicalize + offline aged-out fallback), Jony (board chrome), Fowler (additive URL + save contracts). |
| Execution | autonomous orchestrator per docs/how-to/execute-a-plan.md. Parallel N = 2. |

## Section 1 - Status Reckoner

| # | Row title | Depends-on | Parallel-group | Status | Worktree | PR | Subagent |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | URL grammar + date-aware loader + canonicalize | - | A | PENDING | - | - | - |
| 2 | Display-settings contract + Settings "Display" group | - | A | PENDING | - | - | - |
| 3 | Board wayfinding: date label + prev/next-day carets | 1 | B | PENDING | - | - | - |
| 4 | Stats calendar dots -> playable past days | 1 | B | PENDING | - | - | - |
| 5 | Board honors display setting + in-puzzle display sheet | 2,3 | C | PENDING | - | - | - |

Dependency lines: Group A (rows 1,2) is independent, dispatched together. Group B (rows 3,4) both require row 1 and touch disjoint files (Board.svelte vs Stats.svelte). Row 5 requires row 2 (the setting must exist) and row 3 (it also edits Board.svelte - serialize to avoid a same-file clash).

## Section 2 - Row #1 - URL grammar + date-aware loader + canonicalize

- **Scope:** Make `/play/<date>/<tier>` the canonical route, resolve the manifest by that date, accept `/play/<tier>` and bare `/play` as aliases, and rewrite the alias to the dated form on load without adding a history entry.
- **Files touched:**
  - `frontend/src/lib/router.svelte.ts` (parse a `<date>/<tier>` path; add a `replace()` sibling to `navigate()` using `history.replaceState`)
  - `frontend/src/components/Board.svelte` (resolve `{date,tier}` from the route; default alias/bare to today via `nextPlayableTier`; canonicalize via `replace()`; aged-out/missing-date fallback)
  - `frontend/src/App.svelte` (PLAY nav stays the alias; route match stays `startsWith("/play")`)
  - `frontend/src/lib/loader.ts` (add a helper to report the oldest date present + whether a `(date,tier)` exists; `pickEntry(date,tier)` already exists)
  - `frontend/src/lib/dates.ts` (new: `addDays`, `todayUtc`, `formatDay` - one shared date helper; no hardcoded formats)
  - `frontend/tests/router-dates.test.ts` (new)
  - `docs/concepts/ui-shell.md` (new `## Route grammar` + `## Design rationale` + `## Rejected alternatives`)
- **Acceptance gates:** unit tests (parse/alias/canonicalize/fallback); loader helper unit test with the real `index.json` fixture; type-check + build green; browser-verify per CLAUDE.md section 12 (open `/play/2026-07-01/standard`, a bare `/play/standard`, and an aged-out date; console clean, no new 404); ui-shell.md updated; no `[DEBUG]`; no hardcoded strings.
- **Oracle:** For every entry in the shipped `frontend/public/puzzles/index.json`, `parseRoute(hrefFor(canonical(date,tier)))` round-trips to `{date,tier}` and resolves to the same `file`; and `/play/<tier>` (+ bare `/play`) canonicalize to `/play/<todayUtc>/<tier>` - a bijection between the canonical URL set and the bank's `(date,tier)` keys.
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | Canonical route is `/play/<date>/<tier>` (date-first, `YYYY-MM-DD`), matching `puzzles/<date>-<tier>.json` and the save key `<date>|<tier>|<shapeId>` (dayKey). | User + Fowler |
  | 2 | `/play/<tier>` and bare `/play` are retained aliases; on load the board canonicalizes to the dated form via `history.replaceState` (unfurl; no new history entry; back still exits to home in one tap). | Carmack |
  | 3 | The URL date segment is the source of truth; alias/bare defaults to today via `nextPlayableTier`; derived fields (`puzzleId`/`scenarioId`/`shapeId`/`file`) never appear in the URL. | Fowler |
  | 4 | A dated link to a day absent from the shipped bank (aged past the rolling window, or future) falls back to today with a non-blocking notice - never a hard error or 404. This also closes the offline day-boundary hard-fail (a bookmarked dated link resolves from the stale cache). | Player + Carmack |
  | 5 | `TODAY` is UTC (`new Date().toISOString().slice(0,10)`), consistent with the loader + Stats; the dated permalink is the offline/share-stable form. | Carmack |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | Tier-only URL `/play/<tier>` as canonical (no date) | Not linkable to a specific day; the first post-`/play/` slot inverts the date-first layout used by the served files + save key; blocks day carets + Stats deep-links. | User |
  | 2 | Opaque `puzzleId` in the URL (`/play/<tier>/<puzzleId>`) | A second source of truth that rots against the bank index when ids re-mint; no reverse id->file index exists. | Fowler |
  | 3 | Hash routing (`#/play/...`) | Uglier share URLs, murkier service-worker navigation matching; history + the existing `404.html` SPA mirror already boot deep links. | Carmack |

## Section 3 - Row #2 - Display-settings contract + Settings "Display" group

- **Scope:** Add an additive-optional `settings.display` (color, glyphs, labels) to the save contract and a "Display" group in the Settings screen that writes it.
- **Files touched:**
  - `schemas/save.schema.json` (additive `settings.display`; append an `evolution` entry note; `schemaVersion` stays 1)
  - `frontend/src/contracts/save.ts` (`Settings.display?: { color: boolean; glyphs: boolean; labels: boolean }`)
  - `frontend/src/state/save.svelte.ts` (default `display` on read when absent)
  - `frontend/src/components/Settings.svelte` (new "Display" group: three switches + the at-least-one-of-glyphs/labels invariant)
  - `docs/architecture/contracts/schemas.md` (evolution-log line)
  - `docs/concepts/ui-shell.md` (Settings groups: add Display)
  - `frontend/tests/save-display-contract.test.ts` (new)
- **Acceptance gates:** contract test (a save with and without `display` both validate; an older save loads and defaults apply; `schemaVersion` stays 1); type-check + build green; browser-verify (toggle each switch in Settings, reload, values persist); schemas.md evolution log updated; no `[DEBUG]`; no hardcoded values.
- **Oracle:** Reader/writer parity - a round-trip `parse(serialize(save))` preserves `settings.display`; a fixture save WITHOUT `display` loads, is defaulted to `{color:true,glyphs:true,labels:true}`, and re-serializes at `schemaVersion` 1 (no migration, no data loss).
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | `settings.display` is additive-optional `{ color, glyphs, labels }`; absent on older saves, defaulted on read; save `schemaVersion` stays 1 (Holy Law #11 minor). | Fowler |
  | 2 | Invariant: at least one of `glyphs`/`labels` is true (a value must render as something); enforced in the toggle handlers. | Jony |
  | 3 | Defaults reproduce today's behavior: `color=true, glyphs=true, labels=true` (glyph rendering stays gated by the existing per-axis `glyphComplete` art-coverage check). | Player |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | Major `schemaVersion` bump for the new setting | Additive-optional needs no migration; a bump forces a read-side migration for no gain and risks the "yesterday's save won't load" release blocker. | Fowler |
  | 2 | A single tri-state "display mode" enum (glyph / text / both) | Cannot express "text but no color"; the intent is three independent switches. | User |

## Section 4 - Row #3 - Board wayfinding: date label + prev/next-day carets

- **Scope:** Add a date label and prev/next-day carets to the board header; next is disabled at today, prev is disabled at the oldest bank date; a caret loads the adjacent day at the same tier.
- **Files touched:**
  - `frontend/src/components/Board.svelte` (date label + caret wiring in the header island)
  - `frontend/src/components/DayNav.svelte` (new: date + two carets, disabled states)
  - `config/copy.json` ("Today" label + the short day-format string)
  - `frontend/src/lib/dates.ts` (reuse `formatDay`/`addDays` from Row 1)
  - `docs/concepts/ui-shell.md` (Board screen: date + day carets)
  - `frontend/tests/day-nav.test.ts` (new)
- **Acceptance gates:** component test (caret disabled-state truth table); integration test (enabled caret -> loads the adjacent day's manifest); type-check + build green; browser-verify (carets move day-by-day, next greyed at today, prev greyed at the floor, back still exits home); ui-shell.md updated; no `[DEBUG]`; copy from config, not inline.
- **Oracle:** Caret-state truth: next-caret disabled iff `date == todayUtc`; prev-caret disabled iff `date == oldestBankDate`; every enabled caret target exists in `index.json` at the current tier.
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | The board header shows a date label - "Today" for the current UTC day, else a short weekday+date (e.g. "Sun 29 Jun") from `config/copy.json`. | Jony |
  | 2 | Prev (n-1) / next (n+1) carets flank the date; next is disabled at today (never future); prev is disabled at the oldest date in the bank (rolling-window floor). | User + Palm |
  | 3 | A caret navigates to `/play/<adjacent-date>/<same-tier>`; the existing one-tap back-to-home is unchanged. | Jony |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | A full month / date-picker calendar on the board | Only 7 days ship; a month grid implies availability that does not exist and over-builds the chrome. | Palm |
  | 2 | A live n+1 caret into future days | No future puzzle exists in the bank; a future caret is a broken affordance. | Player |

## Section 5 - Row #4 - Stats calendar dots -> playable past days

- **Scope:** Make each Stats week dot whose date exists in the bank a button that opens that day's puzzle; non-bank dates stay quiet and non-interactive.
- **Files touched:**
  - `frontend/src/components/Stats.svelte` (dots -> buttons -> dated URL; load the bank index to know availability + the tier to open)
  - `frontend/src/lib/loader.ts` (reuse the Row 1 availability helper)
  - `docs/concepts/ui-shell.md` (Stats: calendar is a past-day entry point)
  - `frontend/tests/stats-calendar-nav.test.ts` (new)
- **Acceptance gates:** component test (bank date -> button navigates to `/play/<date>/<tier>`; non-bank date -> not a button); type-check + build green; browser-verify (tap a past won day and a past open day -> lands playable; a date outside the window is inert); ui-shell.md updated; no `[DEBUG]`.
- **Oracle:** Every rendered dot whose `date` is in `index.json` is a labelled button routing to that date's dated URL and lands on a playable board; every dot whose date is absent renders inert (no scold, no dead link).
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | A dot for a bank-present date navigates to `/play/<date>/<lastTierForThatDay or standard>`. | Jony |
  | 2 | Stats loads the bank index to know which dates are playable + which tier to open; a date not in the bank stays non-interactive (quiet, never shaming). | Fowler + Palm |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | Routing all past-day discovery only through Stats | The user requires in-board carets too; Stats is an additional entry, not the sole one. | User |
  | 2 | A tier chooser popup on dot-tap | Extra step before the verb; open a sensible default tier and let the board difficulty switcher change it. | Player |

## Section 6 - Row #5 - Board honors display setting + in-puzzle display sheet

- **Scope:** Honor `settings.display` across the board render surface and add an in-puzzle display sheet (color / glyphs / text) reachable from the header.
- **Files touched:**
  - `frontend/src/components/Board.svelte` (a display affordance in the header island; provide `display` via context)
  - `frontend/src/components/DisplaySheet.svelte` (new: the three toggles over the BottomSheet primitive; writes the same `updateSettings`)
  - `frontend/src/components/{SlotBoard,Pool,GlyphSeat,GridMatrix,NotesGrid,ClueChip}.svelte` + `frontend/src/lib/Glyph.svelte` (honor color / glyphs / labels as needed)
  - `docs/concepts/ui-shell.md` (Puck / display-mode note)
  - `frontend/tests/display-mode.test.ts` (new)
- **Acceptance gates:** component tests (glyphs off -> labels render + no glyph `<img>`; color off -> state cues survive without hue); type-check + build green; browser-verify (open the in-puzzle sheet, flip each toggle, board updates live, choice persists across reload and matches the Settings screen); ui-shell.md updated; no `[DEBUG]`; a shared reader/writer (no duplicated toggle state).
- **Oracle:** With `glyphs=false, labels=true` no glyph `<img>` renders and every board value shows its label; with `color=false` every game state (selected / satisfy / violate / near / locked) stays distinguishable by non-colour cues (ring shape, check/slash glyph, position) - colour-is-one-signal holds and is now enforced; the invariant "not both glyphs and labels off" is never reachable.
- **Decisions:**

  | # | Decision | Authority |
  | --- | --- | --- |
  | 1 | A compact display affordance (gear) in the board header island opens a BottomSheet with the three toggles; it writes the same `save.settings.display` as the Settings screen. | Jony |
  | 2 | The board provides `display` via context; render components honor it: glyphs off -> labels render; color off -> state shown by shape/position/label, never hue alone. | Carmack + Jony |
  | 3 | color=off must keep every state distinguishable via the non-colour cues already in the design. | Player |

- **Rejected alternatives:**

  | # | Option | Why rejected | Authority |
  | --- | --- | --- | --- |
  | 1 | A separate full-screen display route from the board | Heavier than needed; a BottomSheet keeps the player in the puzzle (one concern, in place). | Jony |
  | 2 | Duplicating toggle logic between the board sheet and the Settings screen | One shared writer (`updateSettings`) + one shared reader (context); no duplicated state. | Fowler |
