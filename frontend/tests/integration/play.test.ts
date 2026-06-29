// e2e-ish: drive the game end to end through the play store (Playwright isn't set up;
// this is the vitest-dom-equal). Build today's standard from the real manifest, place
// every token, assert win + lock, and confirm progress persists to save. Fake
// localStorage at the boundary; no other mocks. Covers load -> solve -> win -> reload.

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PuzzleManifest } from "../../src/contracts/manifest";
import { Game, saveProgress } from "../../src/state/play.svelte";
import { loadSave } from "../../src/state/save.svelte";

const here = fileURLToPath(new URL(".", import.meta.url));
const m = JSON.parse(
  readFileSync(resolve(here, "../../public/puzzles/2026-06-29-standard.json"), "utf8"),
) as PuzzleManifest;

class FakeStorage {
  store = new Map<string, string>();
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
}
beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new FakeStorage() as unknown as Storage;
});

// seat i: cola/cat, coffee/dog, tea/bird, milk/fish
const SOLUTION: Record<string, Record<string, string>> = {
  e0: { drink: "cola", animal: "cat" },
  e1: { drink: "coffee", animal: "dog" },
  e2: { drink: "tea", animal: "bird" },
  e3: { drink: "milk", animal: "fish" },
};

describe("play through to win", () => {
  it("places every token and wins, locking the board", () => {
    const g = new Game(m);
    expect(g.evalState.won).toBe(false);
    for (const e of g.board.entities)
      for (const c of g.board.columns) g.place(e, c.id, SOLUTION[e][c.id]);
    expect(g.evalState.won).toBe(true);
    expect(g.locked).toBe(true);
    expect(g.solveMs).toBeGreaterThanOrEqual(0);
  });

  it("tap-token-then-tap-slot fallback also commits", () => {
    const g = new Game(m);
    g.tapToken("drink", "cola");
    g.tapSlot("e0", "drink");
    expect(g.placements.e0.drink).toBe("cola");
    expect(g.selected).toBeNull();
  });

  it("pool depletes and a hint forces the next step", () => {
    const g = new Game(m);
    const before = g.remaining("drink").length;
    g.hint();
    expect(g.remaining("drink").length).toBe(before - 1);
    expect(g.hintsUsed).toBe(1);
  });

  it("persists won progress and resumes on reload", () => {
    const g = new Game(m);
    for (const e of g.board.entities)
      for (const c of g.board.columns) g.place(e, c.id, SOLUTION[e][c.id]);
    saveProgress(g);
    const day = loadSave().days[m.puzzleId];
    expect(day.status).toBe("won");
    expect(new Game(m, day).locked).toBe(true);
  });
});
