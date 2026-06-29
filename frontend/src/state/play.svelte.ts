// Play store: the runtime game state for one day. Holds placements, pool, selection,
// timer, attempts, hints; derives the eval (validate.ts) and locks on win. Persists a
// DayState to save.svelte (schemas.md) so PLAY resumes. Pure-ish: building, placing,
// tapping, hinting are testable; only the timer + persist touch the world. No solution
// is read except to apply a hint step (hintTrace), never to colour the board.

import type { PuzzleManifest } from "../contracts/manifest";
import type { DayState, Placements, Save } from "../contracts/save";
import { buildBoard, type BoardModel } from "../lib/board";
import { evaluate, type PuzzleEval } from "../lib/validate";
import { loadSave, persistSave } from "./save.svelte";

export interface Selection {
  cat: string;
  value: string;
}

export class Game {
  readonly m: PuzzleManifest;
  readonly board: BoardModel;
  placements = $state<Placements>({});
  selected = $state<Selection | null>(null);
  attempts = $state(0);
  hintsUsed = $state(0);
  startedMs = $state(0);
  solveMs = $state(0);
  locked = $state(false);

  constructor(m: PuzzleManifest, prior?: DayState) {
    this.m = m;
    this.board = buildBoard(m);
    this.placements = prior?.placements ? structuredClone(prior.placements) : {};
    this.attempts = prior?.attempts ?? 0;
    this.hintsUsed = prior?.hintsUsed ?? 0;
    this.locked = prior?.status === "won";
    this.solveMs = prior?.solveMs ?? 0;
    this.startedMs = Date.now();
  }

  get evalState(): PuzzleEval {
    return evaluate(this.m, this.board, this.placements);
  }

  /** Values of a category still in the pool (not yet placed). */
  remaining(cat: string): string[] {
    const placed = new Set<string>();
    for (const e of this.board.entities) {
      const v = this.placements[e]?.[cat];
      if (v) placed.add(v);
    }
    return this.board.values[cat].filter((v) => !placed.has(v.id)).map((v) => v.id);
  }

  /** Place value in (entity, cat); bijective so swap out any prior holder. */
  place(entity: string, cat: string, value: string): void {
    if (this.locked) return;
    for (const e of this.board.entities) if (this.placements[e]?.[cat] === value) delete this.placements[e][cat];
    this.placements[entity] = { ...this.placements[entity], [cat]: value };
    this.selected = null;
    this.settle();
  }

  /** Clear a slot back to the pool. */
  clear(entity: string, cat: string): void {
    if (this.locked || !this.placements[entity]) return;
    delete this.placements[entity][cat];
    this.settle();
  }

  /** Tap a pool token: select, or toggle off. Mobile-equal fallback. */
  tapToken(cat: string, value: string): void {
    if (this.locked) return;
    this.selected =
      this.selected && this.selected.cat === cat && this.selected.value === value ? null : { cat, value };
  }

  /** Tap a slot: drop the selected token if it matches the column. */
  tapSlot(entity: string, cat: string): void {
    if (this.locked || !this.selected || this.selected.cat !== cat) return;
    this.place(entity, cat, this.selected.value);
  }

  /** Apply the next forced step (hintTrace); costs the brag. */
  hint(): void {
    if (this.locked) return;
    for (const step of this.m.hintTrace) {
      const f = step.forces;
      if (this.placements[f.entity]?.[f.cat] !== f.value) {
        this.hintsUsed += 1;
        this.place(f.entity, f.cat, f.value);
        return;
      }
    }
  }

  reset(): void {
    if (this.locked) return;
    this.placements = {};
    this.selected = null;
  }

  private settle(): void {
    const ev = this.evalState;
    if (ev.won && !this.locked) {
      this.locked = true;
      this.solveMs = Date.now() - this.startedMs;
    }
  }
}

/** Snapshot a DayState for save. Stars stay 0 until P4 scoring. */
export function toDayState(g: Game): DayState {
  const ev = g.evalState;
  return {
    date: g.m.puzzleId,
    tier: g.m.tier,
    shapeId: g.m.shapeId,
    status: ev.won ? "won" : g.evalState.filled > 0 ? "playing" : "unplayed",
    placements: g.placements,
    attempts: g.attempts,
    solveMs: g.solveMs,
    hintsUsed: g.hintsUsed,
    stars: 0,
  };
}

/** Persist the day into the save and write back (today never pruned). */
export function saveProgress(g: Game): Save {
  const save = loadSave();
  save.days[g.m.puzzleId] = toDayState(g);
  persistSave(save, g.m.puzzleId);
  return save;
}
