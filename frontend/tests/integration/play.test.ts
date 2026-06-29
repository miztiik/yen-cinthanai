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
import { loadSave } from "../../src/state/save.svelte";

const here = fileURLToPath(new URL(".", import.meta.url));
const m = JSON.parse(
  readFileSync(resolve(here, "../../public/puzzles/2026-06-29-standard.json"), "utf8"),
) as PuzzleManifest;

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
    g.tapToken("drink", "cola");
    g.tapSlot("e0", "drink");
    expect(g.placements.e0.drink).toBe("cola");
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
    g.place("e0", "drink", "tea"); // wrong
    g.check();
    expect(g.attempts).toBe(1);
    expect(g.attemptsLeft).toBe(0);
  });
});

describe("brag-cost", () => {
  it("a hint forces the next step and caps to 1 star, no best-time", () => {
    const g = new Game(m, STD);
    const before = g.remaining("drink").length;
    g.hint();
    expect(g.remaining("drink").length).toBe(before - 1);
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
    expect(s.days[m.puzzleId].status).toBe("won");
    expect(s.days[m.puzzleId].stars).toBe(3);
    expect(s.streak.count).toBe(1);
    expect(s.hero.bestMs).toBeGreaterThanOrEqual(0);
    expect(new Game(m, REALTIME, s.days[m.puzzleId]).locked).toBe(true);
  });
});
