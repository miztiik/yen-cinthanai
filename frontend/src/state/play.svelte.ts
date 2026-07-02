// Play store: the runtime game state for one day. Holds placements, pool, selection,
// timer, attempts, hints; derives the eval (validate.ts) and locks on win. Persists a
// DayState to save.svelte (schemas.md) so PLAY resumes. Pure-ish: building, placing,
// tapping, hinting are testable; only the timer + persist touch the world. No solution
// is read except to apply a hint step (hintTrace), never to colour the board.

import type { PuzzleManifest } from "../contracts/manifest";
import type { DayState, DayNotes, Placements, Save } from "../contracts/save";
import { buildBoard, type BoardModel } from "../lib/board";
import { evaluate, type PuzzleEval } from "../lib/validate";
import { mergeGridPlacements } from "../lib/grid";
import { type Feedback, type TierDial } from "../lib/config";
import { computeStars } from "../lib/scoring";
import { loadSave, persistSave, recordWin, dayKey } from "./save.svelte";

export interface Selection {
  cat: string;
  value: string;
}

/** Live colours during play only for realtime (Easy); others reveal on CHECK. */
function isLive(fb: Feedback): boolean {
  return fb === "realtime-names";
}

export class Game {
  readonly m: PuzzleManifest;
  readonly board: BoardModel;
  readonly dial: TierDial;
  placements = $state<Placements>({});
  selected = $state<Selection | null>(null);
  attempts = $state(0);
  hintsUsed = $state(0);
  startedMs = $state(0);
  solveMs = $state(0);
  locked = $state(false);
  stars = $state(0);
  checked = $state(false); // last CHECK revealed feedback (non-realtime tiers)
  lastMoveMs = $state(0); // for stuck-moment pacing
  // Manual clue strikes: player-driven, reversible, LOCAL to this session. Not in
  // toDayState/save this row - Row 7 persists via DayState.notes.struckClues. See
  // lib/clues.ts + components/ClueList.svelte.
  struck = $state<Record<string, boolean>>({});
  // Cross-out grid authored marks (Row 7): the only two states the player AUTHORS. The
  // other two (auto-X, blank) are DERIVED per cell by grid.ts cellState - never stored,
  // never auto-ticked. Plain objects act as sets so Svelte 5's deep proxy tracks add /
  // delete. Both persist to DayState.notes; the anchor-naming ticks also reconstruct into
  // placements at eval time (mergeGridPlacements) so the grid drives the win (Decision 7).
  gridTicks = $state<Record<string, true>>({});
  gridManualX = $state<Record<string, true>>({});

  constructor(m: PuzzleManifest, dial: TierDial, prior?: DayState) {
    this.m = m;
    this.dial = dial;
    this.board = buildBoard(m);
    this.placements = prior?.placements ? structuredClone(prior.placements) : {};
    this.attempts = prior?.attempts ?? 0;
    this.hintsUsed = prior?.hintsUsed ?? 0;
    this.locked = prior?.status === "won";
    this.solveMs = prior?.solveMs ?? 0;
    this.stars = prior?.stars ?? 0;
    this.startedMs = Date.now();
    this.lastMoveMs = Date.now();
    if (prior?.notes) {
      for (const k of prior.notes.scratchTicks ?? []) this.gridTicks[k] = true;
      for (const k of prior.notes.manualX ?? []) this.gridManualX[k] = true;
      for (const id of prior.notes.struckClues ?? []) this.struck[id] = true;
    }
  }

  /** Realtime tiers colour as you play; harder tiers stay neutral until CHECK. */
  get live(): boolean {
    return isLive(this.dial.feedback);
  }
  /** Whether the board may show satisfy/violate now. */
  get revealed(): boolean {
    return this.live || this.checked || this.locked;
  }
  get evalState(): PuzzleEval {
    // The cross-out grid contributes to the win exactly like the token board: its ticks
    // that name the anchor reconstruct into placements. When no cell is ticked the merge
    // is skipped and this is byte-identical to the legacy token-only eval (no regression).
    const tickKeys = Object.keys(this.gridTicks);
    const place = tickKeys.length
      ? mergeGridPlacements(this.board, this.placements, new Set(tickKeys))
      : this.placements;
    return evaluate(this.m, this.board, place);
  }
  /** Hints left (-1 unlimited); attempts left (-1 unlimited) per tier dial. */
  get hintsLeft(): number {
    return this.dial.hints < 0 ? -1 : Math.max(0, this.dial.hints - this.hintsUsed);
  }
  get attemptsLeft(): number {
    return this.dial.attempts < 0 ? -1 : Math.max(0, this.dial.attempts - this.attempts);
  }
  get bragged(): boolean {
    return this.hintsUsed > 0;
  }

  /** Values of a category still in the pool. Shared cats repeat, so never deplete. */
  remaining(cat: string): string[] {
    const col = this.board.columns.find((c) => c.id === cat);
    if (col?.cardinality === "shared") return this.board.values[cat].map((v) => v.id);
    const placed = new Set<string>();
    for (const e of this.board.entities) {
      const v = this.placements[e]?.[cat];
      if (v) placed.add(v);
    }
    return this.board.values[cat].filter((v) => !placed.has(v.id)).map((v) => v.id);
  }

  /** Place value in (entity, cat); bijective swaps out any prior holder, shared repeats. */
  place(entity: string, cat: string, value: string): void {
    if (this.locked) return;
    const col = this.board.columns.find((c) => c.id === cat);
    if (col?.cardinality !== "shared")
      for (const e of this.board.entities) if (this.placements[e]?.[cat] === value) delete this.placements[e][cat];
    this.placements[entity] = { ...this.placements[entity], [cat]: value };
    this.selected = null;
    this.lastMoveMs = Date.now();
    this.checked = false;
    this.settle();
  }

  /** Clear a slot back to the pool. */
  clear(entity: string, cat: string): void {
    if (this.locked || !this.placements[entity]) return;
    delete this.placements[entity][cat];
    this.lastMoveMs = Date.now();
    this.checked = false;
  }

  /** Tap a pool token: select, or toggle off. Mobile-equal fallback. */
  tapToken(cat: string, value: string): void {
    if (this.locked) return;
    this.lastMoveMs = Date.now();
    this.selected =
      this.selected && this.selected.cat === cat && this.selected.value === value ? null : { cat, value };
  }

  /** Tap a slot: drop the selected token if it matches the column. */
  tapSlot(entity: string, cat: string): void {
    if (this.locked || !this.selected || this.selected.cat !== cat) return;
    this.place(entity, cat, this.selected.value);
  }

  /** Apply the next forced step (hintTrace); costs the brag, capped by tier. */
  hint(): void {
    if (this.locked || this.hintsLeft === 0) return;
    for (const step of this.m.hintTrace) {
      const f = step.forces;
      if (this.placements[f.entity]?.[f.cat] !== f.value) {
        this.hintsUsed += 1;
        this.place(f.entity, f.cat, f.value);
        return;
      }
    }
  }

  /** CHECK/SUBMIT for non-realtime tiers: reveal, win or burn an attempt. */
  check(): void {
    if (this.locked || this.live) return;
    this.checked = true;
    this.lastMoveMs = Date.now();
    if (this.win()) return;
    if (this.attemptsLeft !== 0) this.attempts += 1;
  }

  reset(): void {
    if (this.locked) return;
    this.placements = {};
    this.selected = null;
    this.checked = false;
    this.lastMoveMs = Date.now();
  }

  /** Toggle a manual clue strike (reversible, never required). Local this session. */
  toggleStruck(id: string): void {
    this.struck[id] = !this.struck[id];
  }

  /** Drop a glyph into a grid cell: TICK it (the positive) and clear any manual-X there.
   *  Auto-X of the rest of the block's row/col is DERIVED (grid.ts), never stored, and we
   *  NEVER auto-tick another cell - the last-cell-standing aha is the player's to find. */
  gridDrop(key: string): void {
    if (this.locked) return;
    delete this.gridManualX[key];
    this.gridTicks[key] = true;
    this.selected = null;
    this.lastMoveMs = Date.now();
    this.checked = false;
    this.settle();
  }

  /** Tap a grid cell: clear its tick if ticked, else toggle a manual-X. Removing a tick
   *  reverts only the auto-X it implied (derived); a manual-X in the same row/col survives. */
  gridTap(key: string): void {
    if (this.locked) return;
    if (this.gridTicks[key]) delete this.gridTicks[key];
    else if (this.gridManualX[key]) delete this.gridManualX[key];
    else this.gridManualX[key] = true;
    this.lastMoveMs = Date.now();
    this.checked = false;
  }

  /** Lock + score on a complete correct board. Stars: brag-cost via hintsUsed. */
  private win(): boolean {
    if (this.locked || !this.evalState.won) return false;
    this.locked = true;
    this.solveMs = Date.now() - this.startedMs;
    this.stars = computeStars(this.solveMs, this.hintsUsed, this.attempts, this.dial);
    return true;
  }

  private settle(): void {
    if (this.live) this.win(); // realtime auto-wins; others wait for CHECK
  }
}

/** Snapshot a DayState for save. */
export function toDayState(g: Game): DayState {
  const ev = g.evalState;
  const day: DayState = {
    date: g.m.puzzleId,
    tier: g.m.tier,
    shapeId: g.m.shapeId,
    status: g.locked ? "won" : ev.filled > 0 ? "playing" : "unplayed",
    placements: g.placements,
    attempts: g.attempts,
    solveMs: g.solveMs,
    hintsUsed: g.hintsUsed,
    stars: g.stars,
  };
  const notes = buildNotes(g);
  if (notes) day.notes = notes;
  return day;
}

/** Collect the grid + clue bookkeeping into notes, OMITTING it entirely when nothing is
 *  marked so a legacy DayState stays byte-identical (backward-compatible - schemas.md). */
function buildNotes(g: Game): DayNotes | undefined {
  const manualX = Object.keys(g.gridManualX);
  const scratchTicks = Object.keys(g.gridTicks);
  const struckClues = Object.keys(g.struck).filter((id) => g.struck[id]);
  if (!manualX.length && !scratchTicks.length && !struckClues.length) return undefined;
  const notes: DayNotes = {};
  if (manualX.length) notes.manualX = manualX;
  if (scratchTicks.length) notes.scratchTicks = scratchTicks;
  if (struckClues.length) notes.struckClues = struckClues;
  return notes;
}

/** Persist the day; on a fresh win advance streak + best-time once (today never pruned). */
export function saveProgress(g: Game): Save {
  const save = loadSave();
  const day = toDayState(g);
  const key = dayKey(day.date, day.tier, day.shapeId);
  const fresh = day.status === "won" && save.days[key]?.status !== "won";
  save.days[key] = day;
  if (fresh) recordWin(save, day);
  persistSave(save, g.m.puzzleId);
  return save;
}
