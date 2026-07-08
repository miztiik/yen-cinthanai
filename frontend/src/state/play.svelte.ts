// Play store: the runtime game state for one day. Holds placements, pool, selection,
// timer, attempts, hints; derives the eval (validate.ts) and locks on win. Persists a
// DayState to save.svelte (schemas.md) so PLAY resumes. Pure-ish: building, placing,
// tapping, hinting are testable; only the timer + persist touch the world. No solution
// is read except to apply a hint step (hintTrace), never to colour the board.

import type { PuzzleManifest } from "../contracts/manifest";
import type { DayState, DayNotes, Placements, Save } from "../contracts/save";
import { buildBoard, type BoardModel } from "../lib/board";
import { evaluate, type PuzzleEval } from "../lib/validate";
import { mergeGridPlacements, collides } from "../lib/grid";
import { ActiveClock } from "../lib/clock";
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
  // Active-time clock (lib/clock.ts): counts only the time the puzzle is on screen. The Board
  // pauses it when the tab is hidden and resumes on return, so away-time never accrues. Plain
  // field (not $state): the header polls elapsedMs each frame via the tick loop, not reactively.
  private clock = new ActiveClock();
  solveMs = $state(0);
  locked = $state(false);
  // A "play again" run of an already-solved puzzle. Practice only: the recorded result is
  // frozen (saveProgress never downgrades a won slot) and a re-solve celebrates as a normal
  // win, never a false "personal best", so replays are satisfying but not farmable.
  replaying = $state(false);
  stars = $state(0);
  checked = $state(false); // last CHECK revealed feedback (non-realtime tiers)
  lastMoveMs = $state(0); // for stuck-moment pacing
  // Manual clue strikes: player-driven, reversible; persisted via DayState.notes.struckClues
  // (buildNotes) and restored in the constructor. See lib/clues.ts + components/ClueList.svelte.
  struck = $state<Record<string, boolean>>({});
  // Cross-out grid marks (B-prime): only the two AUTHORED sets are stored - a TICK (the
  // positive) and a MANUAL-X (a hand elimination). Auto-X + blank are DERIVED (grid.ts).
  // Both persist via DayState.notes; a present key = marked (removed, never set false).
  gridTicks = $state<Record<string, boolean>>({});
  gridManualX = $state<Record<string, boolean>>({});
  // Free-text scratch pad (Row #4): the player's private jottings for the day. Persisted via
  // DayState.notes.scratch (buildNotes) + restored in the constructor. Debounced-saved by the
  // ScratchPad component (localStorage.setItem serializes the whole save, so not per-keystroke).
  scratch = $state("");

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
    this.gridTicks = recFrom(prior?.notes?.scratchTicks);
    this.gridManualX = recFrom(prior?.notes?.manualX);
    this.struck = recFrom(prior?.notes?.struckClues);
    this.scratch = prior?.notes?.scratch ?? "";
    if (!this.locked) this.clock.start(Date.now());
    this.lastMoveMs = Date.now();
  }

  /** Set the free-text scratch pad (persistence is debounced by the ScratchPad component). */
  setScratch(text: string): void {
    this.scratch = text;
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
    const ticks = Object.keys(this.gridTicks);
    const placements = ticks.length
      ? mergeGridPlacements(this.board, this.placements, new Set(ticks))
      : this.placements;
    return evaluate(this.m, this.board, placements);
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

  /** Active ms on this puzzle - wall time is NOT counted while the tab is hidden (the Board
   *  pauses the clock on visibilitychange). Frozen at solveMs once the game is locked. */
  get elapsedMs(): number {
    return this.locked ? this.solveMs : this.clock.elapsed(Date.now());
  }

  /** Pause the active timer - the player left the tab / the window went hidden, so time away
   *  stops accruing until they return. */
  pause(): void {
    this.clock.pause(Date.now());
  }

  /** Resume the active timer when the tab is visible again. Refreshes the stuck-pacing
   *  baseline so a return does not instantly read as "idle". No-op once locked. */
  resume(): void {
    if (this.locked) return;
    const now = Date.now();
    this.clock.start(now);
    this.lastMoveMs = now;
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

  /** Clear the board back to a blank slate mid-solve: token placements AND the cross-out
   *  grid marks (ticks + manual-X), so RESET works in story/grid mode too (the grid keeps
   *  its state in gridTicks/gridManualX, not placements). Attempts + timer are untouched -
   *  this is "I made a mess", not "give me a fresh run". Clue strikes are a reading aid, left
   *  as-is. */
  reset(): void {
    if (this.locked) return;
    this.placements = {};
    this.gridTicks = {};
    this.gridManualX = {};
    this.selected = null;
    this.checked = false;
    this.lastMoveMs = Date.now();
  }

  /** Fresh run after the attempt cap is spent (the fail card's RETRY): clear the board +
   *  marks, restore the full attempt budget, and restart the timer so the next solve is
   *  clean. Without the attempts reset a rebuild from the saved day would re-fail instantly.
   *  Never touches a locked win. */
  retry(): void {
    if (this.locked) return;
    this.reset();
    this.attempts = 0;
    this.clock.reset(Date.now());
  }

  /** "Play again" a solved puzzle: unlock and clear the board + grid marks, restore the full
   *  attempt budget, and restart the clock so the puzzle is fully playable again. The recorded
   *  result stays frozen (saveProgress freezes a won slot) and streak/best never move again for
   *  the day; `replaying` marks the run so a re-solve reads as a plain win. Practice, not farmable. */
  playAgain(): void {
    this.replaying = true;
    this.locked = false;
    this.placements = {};
    this.gridTicks = {};
    this.gridManualX = {};
    this.selected = null;
    this.checked = false;
    this.attempts = 0;
    this.hintsUsed = 0;
    this.solveMs = 0;
    this.stars = 0;
    this.clock.reset(Date.now());
    this.lastMoveMs = Date.now();
  }

  /** Toggle a manual clue strike (reversible, never required). */
  toggleStruck(id: string): void {
    this.struck[id] = !this.struck[id];
  }

  /** B-prime verb: drop a glyph into a cell = TICK the positive. Displaces any tick in the
   *  same block sharing a row or column (one positive per line), clears a prior manual-X on
   *  the cell, and lets the derived auto-X do the elimination. Realtime tiers may win now. */
  gridDrop(key: string): void {
    if (this.locked) return;
    for (const k of Object.keys(this.gridTicks)) if (collides(key, k)) delete this.gridTicks[k];
    delete this.gridManualX[key];
    this.gridTicks[key] = true;
    this.lastMoveMs = Date.now();
    this.checked = false;
    this.settle();
  }

  /** Tap a cell = toggle a MANUAL-X (a hand elimination); tapping a ticked cell clears the
   *  tick. Present key = marked; a toggled-off mark is removed so notes never carries false. */
  gridTap(key: string): void {
    if (this.locked) return;
    if (this.gridTicks[key]) delete this.gridTicks[key];
    else if (this.gridManualX[key]) delete this.gridManualX[key];
    else this.gridManualX[key] = true;
    this.lastMoveMs = Date.now();
    this.checked = false;
  }

  /** The grid's one verb: tap/click/Enter/Space CYCLES a cell blank -> X -> tick -> blank.
   *  X-first so the reflex first tap is a cheap, local eliminate (the -ve guess) and the
   *  auto-X cascade is a deliberate second tap to the tick (the +ve guess = the glyph).
   *  Auto-X cells are authored-blank, so they cycle straight to a manual-X. */
  gridCycle(key: string): void {
    if (this.locked) return;
    if (this.gridTicks[key]) {
      delete this.gridTicks[key]; // tick -> blank
      this.lastMoveMs = Date.now();
      this.checked = false;
    } else if (this.gridManualX[key]) {
      this.gridDrop(key); // X -> tick (clears the X, displaces line collisions, cascades auto-X)
    } else {
      this.gridManualX[key] = true; // blank / auto-X -> X
      this.lastMoveMs = Date.now();
      this.checked = false;
    }
  }

  /** Lock + score on a complete correct board. Stars: brag-cost via hintsUsed. */
  private win(): boolean {
    if (this.locked || !this.evalState.won) return false;
    this.locked = true;
    const now = Date.now();
    this.solveMs = this.clock.elapsed(now);
    this.clock.pause(now);
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

/** Present keys of a mark record (true only) - the array form persisted in notes. */
function keysOf(r: Record<string, boolean>): string[] {
  return Object.keys(r).filter((k) => r[k]);
}

/** A mark record rebuilt from a persisted string[] (each present key = marked). */
function recFrom(keys?: string[]): Record<string, boolean> {
  const r: Record<string, boolean> = {};
  for (const k of keys ?? []) r[k] = true;
  return r;
}

/** The optional notes block; undefined when nothing is marked, so an unmarked day stays
 *  byte-identical to a legacy save. */
function buildNotes(g: Game): DayNotes | undefined {
  const scratchTicks = keysOf(g.gridTicks);
  const manualX = keysOf(g.gridManualX);
  const struckClues = keysOf(g.struck);
  if (!scratchTicks.length && !manualX.length && !struckClues.length && !g.scratch) return undefined;
  const notes: DayNotes = {};
  if (scratchTicks.length) notes.scratchTicks = scratchTicks;
  if (manualX.length) notes.manualX = manualX;
  if (struckClues.length) notes.struckClues = struckClues;
  if (g.scratch) notes.scratch = g.scratch;
  return notes;
}

/** Persist the day; on a fresh win advance streak + best-time once (today never pruned). */
export function saveProgress(g: Game): Save {
  const save = loadSave();
  const day = toDayState(g);
  const key = dayKey(day.date, day.tier, day.shapeId);
  const fresh = day.status === "won" && save.days[key]?.status !== "won";
  // A puzzle once won is immutable: a "play again" run (or any later save) never downgrades or
  // overwrites the recorded result. streak + best advance only on the FIRST win of the day
  // (fresh), so replaying is practice - it can never re-bump the streak or rewrite the best.
  if (save.days[key]?.status !== "won") save.days[key] = day;
  if (fresh) recordWin(save, day);
  persistSave(save, g.m.puzzleId);
  return save;
}
