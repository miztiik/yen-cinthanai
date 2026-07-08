// e2e-ish through the play store (Playwright isn't set up; this is the vitest-equal).
// Tier dials drive feedback: realtime auto-wins, submit-binary needs CHECK and burns
// attempts; a hint costs the brag (stars 1, no best-time). Fake localStorage at the
// boundary; no other mocks. Covers load -> solve -> win, tier dials, brag-cost, resume.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PuzzleManifest } from "../../src/contracts/manifest";
import type { TierDial } from "../../src/lib/config";
import { Game, saveProgress } from "../../src/state/play.svelte";
import { loadSave, dayKey } from "../../src/state/save.svelte";

const here = fileURLToPath(new URL(".", import.meta.url));
const m = JSON.parse(
  readFileSync(resolve(here, "../../public/puzzles/2026-06-29-standard.json"), "utf8"),
) as PuzzleManifest;
const mEasy = JSON.parse(
  readFileSync(resolve(here, "../../public/puzzles/2026-06-29-easy.json"), "utf8"),
) as PuzzleManifest;

// Dimensions are auto-discovered + date-seeded, so the test must not assume which packs
// were picked. Derive a fillable bijective column + sample values from the loaded puzzle.
const COL = m.categories.list.find((c) => c.kind !== "ordinal" && c.cardinality !== "shared")!.id;
const E0_VAL = m.solution["e0"][COL];
const E1_VAL = m.solution["e1"][COL]; // belongs to another seat -> a wrong value on e0

const REALTIME: TierDial = { par_s: 90, hints: -1, attempts: -1, feedback: "realtime-names" };
const SUBMIT: TierDial = { par_s: 900, hints: 0, attempts: 1, feedback: "submit-binary" };
const STD: TierDial = { par_s: 240, hints: 2, attempts: 3, feedback: "count-wrong" };

class FakeStorage {
  store = new Map<string, string>();
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
}
beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new FakeStorage() as unknown as Storage;
});

// fill from the manifest solution: covers every fillable column incl. shared cats
function fill(g: Game) {
  for (const e of g.board.entities) for (const c of g.board.columns) g.place(e, c.id, m.solution[e][c.id]);
}

describe("realtime tier (Easy)", () => {
  it("auto-wins and locks; no CHECK needed; 3 stars under par", () => {
    const g = new Game(m, REALTIME);
    fill(g);
    expect(g.evalState.won).toBe(true);
    expect(g.locked).toBe(true);
    expect(g.live).toBe(true);
    expect(g.stars).toBe(3);
  });
  it("tap-token-then-tap-slot fallback commits", () => {
    const g = new Game(m, REALTIME);
    g.tapToken(COL, E0_VAL);
    g.tapSlot("e0", COL);
    expect(g.placements.e0[COL]).toBe(E0_VAL);
  });
});

describe("submit tier (Expert)", () => {
  it("stays open until CHECK, then locks; filling alone does not win", () => {
    const g = new Game(m, SUBMIT);
    fill(g);
    expect(g.live).toBe(false);
    expect(g.locked).toBe(false);
    g.check();
    expect(g.locked).toBe(true);
  });
  it("a wrong CHECK burns an attempt and exhausts the cap", () => {
    const g = new Game(m, SUBMIT);
    g.place("e0", COL, E1_VAL); // wrong: belongs to another seat
    g.check();
    expect(g.attempts).toBe(1);
    expect(g.attemptsLeft).toBe(0);
  });
});

describe("reset + retry (story/grid mode)", () => {
  it("reset clears BOTH token placements and the cross-out grid marks", () => {
    const g = new Game(m, STD);
    g.place("e0", COL, E0_VAL);
    g.gridTicks["farmer:e0|animal:a"] = true; // a positive tick
    g.gridManualX["farmer:e1|animal:b"] = true; // a hand elimination
    g.checked = true;
    g.reset();
    expect(g.placements).toEqual({});
    expect(Object.keys(g.gridTicks)).toHaveLength(0);
    expect(Object.keys(g.gridManualX)).toHaveLength(0);
    expect(g.checked).toBe(false);
  });

  it("retry after a spent attempt cap restores the budget and clears the board", () => {
    const g = new Game(m, SUBMIT); // attempts: 1
    g.place("e0", COL, E1_VAL); // wrong seat
    g.check();
    expect(g.attemptsLeft).toBe(0); // cap spent -> the fail card would show
    g.retry();
    expect(g.attemptsLeft).toBe(1); // fresh run, not stuck re-failing
    expect(g.placements).toEqual({});
    expect(g.checked).toBe(false);
    expect(g.locked).toBe(false);
  });
});

describe("play again (practice replay of a solved puzzle)", () => {
  it("unlocks a solved puzzle and clears the board for a fresh run", () => {
    const g = new Game(m, REALTIME);
    fill(g); // realtime -> win + lock
    expect(g.locked).toBe(true);
    g.playAgain();
    expect(g.locked).toBe(false);
    expect(g.replaying).toBe(true);
    expect(g.placements).toEqual({});
    expect(Object.keys(g.gridTicks)).toHaveLength(0);
    expect(g.attempts).toBe(0);
    expect(g.hintsUsed).toBe(0);
    expect(g.solveMs).toBe(0);
    expect(g.stars).toBe(0);
  });

  it("a mid-replay snapshot never downgrades the recorded win", () => {
    const g = new Game(m, REALTIME);
    fill(g);
    saveProgress(g); // record the win
    const k = dayKey(m.puzzleId, m.tier, m.shapeId);
    expect(loadSave().days[k].status).toBe("won");
    g.playAgain(); // board now empty -> toDayState status would be "unplayed"
    saveProgress(g); // the persist effect firing mid-replay must NOT wipe the win
    const d = loadSave().days[k];
    expect(d.status).toBe("won");
    expect(d.stars).toBe(3);
  });

  it("re-solving a replay keeps the FIRST recorded time and never re-bumps streak or best", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const g = new Game(m, REALTIME);
      vi.setSystemTime(5000);
      fill(g); // clean win at 5s
      expect(g.solveMs).toBe(5000);
      saveProgress(g);
      const k = dayKey(m.puzzleId, m.tier, m.shapeId);
      const s1 = loadSave();
      expect(s1.days[k].solveMs).toBe(5000);
      expect(s1.streak.count).toBe(1);
      const bestBefore = s1.hero.bestMs;

      g.playAgain(); // clock reset at t=5000
      vi.setSystemTime(9000);
      fill(g); // a faster replay: 4s
      expect(g.solveMs).toBe(4000);
      saveProgress(g);

      const s2 = loadSave();
      expect(s2.days[k].solveMs).toBe(5000); // frozen: the 4s replay did NOT overwrite
      expect(s2.days[k].status).toBe("won");
      expect(s2.streak.count).toBe(1); // never 2 - a replay is not a new day
      expect(s2.hero.bestMs).toBe(bestBefore); // best frozen too
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("brag-cost", () => {
  it("a hint forces the next step and caps to 1 star, no best-time", () => {
    const g = new Game(m, STD);
    const cat = m.hintTrace[0].forces.cat; // the column the hint will fill
    const before = g.remaining(cat).length;
    g.hint();
    expect(g.remaining(cat).length).toBe(before - 1);
    expect(g.hintsUsed).toBe(1);
    fill(g);
    g.check();
    expect(g.locked).toBe(true);
    expect(g.stars).toBe(1);
    saveProgress(g);
    expect(loadSave().hero.bestMs).toBe(0); // hinted solve never sets best
  });
});

describe("persist + resume", () => {
  it("a clean win persists, advances streak, sets best, resumes locked", () => {
    const g = new Game(m, REALTIME);
    fill(g);
    saveProgress(g);
    const s = loadSave();
    const k = dayKey(m.puzzleId, m.tier, m.shapeId);
    expect(s.days[k].status).toBe("won");
    expect(s.days[k].stars).toBe(3);
    expect(s.streak.count).toBe(1);
    expect(s.hero.bestMs).toBeGreaterThanOrEqual(0);
    expect(new Game(m, REALTIME, s.days[k]).locked).toBe(true);
  });
});

describe("composite day slots (multi-tier same day)", () => {
  it("a second tier the same day persists as its own slot, no overwrite", () => {
    const g1 = new Game(m, STD); // standard / seating-row
    fill(g1);
    g1.check();
    saveProgress(g1);

    const g2 = new Game(mEasy, REALTIME); // easy / grid, SAME date
    for (const e of g2.board.entities) for (const c of g2.board.columns) g2.place(e, c.id, mEasy.solution[e][c.id]);
    saveProgress(g2);

    const s = loadSave();
    const kStd = dayKey(m.puzzleId, m.tier, m.shapeId);
    const kEasy = dayKey(mEasy.puzzleId, mEasy.tier, mEasy.shapeId);
    expect(kStd).not.toBe(kEasy);
    expect(Object.keys(s.days)).toHaveLength(2); // both slots coexist, no collision
    expect(s.days[kStd].tier).toBe("standard");
    expect(s.days[kEasy].tier).toBe("easy");
    expect(s.days[kStd].status).toBe("won");
    expect(s.days[kEasy].status).toBe("won");
    expect(s.streak.count).toBe(1); // one calendar-day streak advance, not one per tier
  });
});

// Active-time timer: only the time the puzzle is on screen counts. The Board pauses the Game
// clock on visibilitychange (tab hidden) and resumes on return; time away never accrues, and
// solveMs is the active total. Fake timers drive Date.now() deterministically.
describe("active-time clock (away time never counts)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("freezes while paused (away) and resumes on return", () => {
    vi.setSystemTime(0);
    const g = new Game(m, STD, undefined); // starts counting at t=0
    vi.setSystemTime(3000);
    expect(g.elapsedMs).toBe(3000); // 3s active
    g.pause(); // tab hidden at t=3000
    vi.setSystemTime(60000); // 57s away
    expect(g.elapsedMs).toBe(3000); // away time NOT counted
    g.resume(); // back at t=60000
    vi.setSystemTime(62000);
    expect(g.elapsedMs).toBe(5000); // +2s active -> 5s total
  });

  it("scores solveMs as the active time, excluding the paused gap", () => {
    vi.setSystemTime(0);
    const g = new Game(m, REALTIME, undefined); // realtime auto-wins on fill
    vi.setSystemTime(2000);
    g.pause();
    vi.setSystemTime(100_000); // a long time away
    g.resume();
    vi.setSystemTime(104_000); // +4s active (total 6s)
    fill(g); // realtime -> win now
    expect(g.locked).toBe(true);
    expect(g.solveMs).toBe(6000); // 2s + 4s active, not the 98s away
  });

  it("freezes elapsedMs at solveMs once locked (resume is a no-op)", () => {
    vi.setSystemTime(0);
    const g = new Game(m, REALTIME, undefined);
    vi.setSystemTime(1000);
    fill(g); // win at 1s
    expect(g.solveMs).toBe(1000);
    g.resume();
    vi.setSystemTime(50_000);
    expect(g.elapsedMs).toBe(1000); // still frozen
  });
});
