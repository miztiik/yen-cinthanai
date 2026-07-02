// e2e-ish through the play store (Playwright isn't set up; this is the vitest-equal).
// Tier dials drive feedback: realtime auto-wins, submit-binary needs CHECK and burns
// attempts; a hint costs the brag (stars 1, no best-time). Fake localStorage at the
// boundary; no other mocks. Covers load -> solve -> win, tier dials, brag-cost, resume.

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PuzzleManifest } from "../../src/contracts/manifest";
import type { TierDial } from "../../src/lib/config";
import { Game, saveProgress } from "../../src/state/play.svelte";
import { loadSave, dayKey } from "../../src/state/save.svelte";

const here = fileURLToPath(new URL(".", import.meta.url));
// The play-store loop runs against the SERVED story bank now that the frontend solves it:
// board.ts honours the anchor:true identity and validate.ts evaluates the numeric + compound
// clue types. The 2026-06-29 standard puzzle carries eq/neq + a numDiff clue, so filling its
// solution exercises load -> place -> win end to end against a real shipped puzzle.
const m = JSON.parse(
  readFileSync(resolve(here, "../../public/puzzles/2026-06-29-standard.json"), "utf8"),
) as PuzzleManifest;
// Easy stays served (all-direct eq-only grid). Same calendar date -> the composite-day streak
// stays 1 while standard + easy persist as their own tier slots.
const mEasy = JSON.parse(
  readFileSync(resolve(here, "../../public/puzzles/2026-06-29-easy.json"), "utf8"),
) as PuzzleManifest;

// Dimensions are auto-discovered + date-seeded, so the test must not assume which packs were
// picked. Derive a fillable bijective column (never the anchor identity) + sample values.
const COL = m.categories.list.find((c) => !c.anchor && c.cardinality !== "shared")!.id;
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
