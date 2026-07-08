// Contract: the optional DayState.notes surface (Row 7). notes is ADDITIVE and OPTIONAL -
// grid ticks (scratchTicks), manual crosses (manualX), and clue strikes (struckClues)
// persist alongside the existing placements, and schemaVersion stays 1. Proves: a save
// WITH notes validates + reloads, a legacy save WITHOUT notes still loads, a malformed
// notes shape is rejected (drop the day), and a full Game round-trip restores every mark.
// Real fixtures; validateSave is the read path. See docs/architecture/contracts/schemas.md.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Game, toDayState } from "../../src/state/play.svelte";
import { validateSave, dayKey } from "../../src/state/save.svelte";
import { cellKey, type GridEndpoint } from "../../src/lib/grid";
import type { PuzzleManifest } from "../../src/contracts/manifest";
import type { DayState, Tier } from "../../src/contracts/save";
import type { TierDial } from "../../src/lib/config";

const here = fileURLToPath(new URL(".", import.meta.url));
const m = JSON.parse(readFileSync(resolve(here, "../fixtures/manifest-4x3.json"), "utf8")) as PuzzleManifest;
const STD: TierDial = { par_s: 240, hints: 2, attempts: 3, feedback: "count-wrong" };

const ep = (cat: string, val: string): GridEndpoint => ({ cat, val });
const TICK = cellKey(ep("position", "p0"), ep("drink", "tea")); // anchor-naming
const MX = cellKey(ep("drink", "coffee"), ep("animal", "dog")); // cross-block manual-X

const legacyDay = (): DayState => ({
  date: "2026-06-27",
  tier: "easy" as Tier,
  shapeId: "grid",
  status: "playing",
  placements: {},
  attempts: 0,
  solveMs: 0,
  hintsUsed: 0,
  stars: 0,
});

describe("toDayState notes emission", () => {
  it("omits notes entirely when nothing is marked (byte-identical to a legacy day)", () => {
    expect(toDayState(new Game(m, STD)).notes).toBeUndefined();
  });

  it("carries grid ticks, manual crosses, and struck clues when present", () => {
    const g = new Game(m, STD);
    g.gridDrop(TICK);
    g.gridTap(MX);
    g.toggleStruck("c1");
    const notes = toDayState(g).notes!;
    expect(notes.scratchTicks).toContain(TICK);
    expect(notes.manualX).toContain(MX);
    expect(notes.struckClues).toEqual(["c1"]);
  });

  it("carries the free-text scratch pad when the player has jotted a note", () => {
    const g = new Game(m, STD);
    g.setScratch("Ana is not the potter");
    expect(toDayState(g).notes!.scratch).toBe("Ana is not the potter");
  });

  it("still omits notes when the scratch is cleared and nothing else is marked", () => {
    const g = new Game(m, STD);
    g.setScratch("something");
    g.setScratch("");
    expect(toDayState(g).notes).toBeUndefined();
  });
});

describe("validateSave backward compatibility", () => {
  it("loads a day WITHOUT notes (older save)", () => {
    const s = validateSave({ schemaVersion: 1, days: { d: legacyDay() } });
    expect(Object.keys(s.days)).toHaveLength(1);
    expect(s.days[dayKey("2026-06-27", "easy", "grid")].notes).toBeUndefined();
  });

  it("preserves a well-formed notes block", () => {
    const day = { ...legacyDay(), notes: { manualX: [MX], scratchTicks: [TICK], struckClues: ["c1"] } };
    const s = validateSave({ schemaVersion: 1, days: { x: day } });
    expect(s.days[dayKey("2026-06-27", "easy", "grid")].notes?.struckClues).toEqual(["c1"]);
  });

  it("loads a day WITH a scratch note, and a legacy day (no scratch) defaults to empty on the Game", () => {
    const withScratch = { ...legacyDay(), notes: { scratch: "my running note" } };
    const s = validateSave({ schemaVersion: 1, days: { x: withScratch } });
    expect(s.days[dayKey("2026-06-27", "easy", "grid")].notes?.scratch).toBe("my running note");
    expect(new Game(m, STD, legacyDay()).scratch).toBe("");
  });

  it("drops a day whose notes is malformed (not arrays of strings)", () => {
    const day = { ...legacyDay(), notes: { manualX: [1, 2] } };
    expect(validateSave({ schemaVersion: 1, days: { x: day } }).days).toEqual({});
  });

  it("keeps schemaVersion at 1 (no bump)", () => {
    const day = { ...legacyDay(), notes: { scratchTicks: [TICK] } };
    expect(validateSave({ schemaVersion: 1, days: { x: day } }).schemaVersion).toBe(1);
  });
});

describe("Game round-trip restores every mark", () => {
  it("reloads grid ticks, manual-X, and struck clues", () => {
    const g = new Game(m, STD);
    g.gridDrop(TICK);
    g.gridTap(MX);
    g.toggleStruck("c2");
    g.setScratch("reload me");
    const day = toDayState(g);

    const s = validateSave({ schemaVersion: 1, days: { x: day } });
    const restored = s.days[dayKey(day.date, day.tier, day.shapeId)];
    const g2 = new Game(m, STD, restored);

    expect(g2.gridTicks[TICK]).toBe(true);
    expect(g2.gridManualX[MX]).toBe(true);
    expect(g2.struck.c2).toBe(true);
    expect(g2.scratch).toBe("reload me");
    // and the tick reconstructs into the merged eval (drives the win, Decision 7)
    expect(g2.evalState.filled).toBeGreaterThan(0);
  });
});
