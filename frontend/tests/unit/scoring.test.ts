// Unit: scoring + forgiving streak. Pure functions, no IO. Stars are config-driven
// (par from the tier dial). Streak: same-day no-op, consecutive +1, a gap burns a
// skip and holds, no skip resets; refill on a new ISO week. Hero only on clean solves.

import { describe, it, expect } from "vitest";
import type { TierDial } from "../../src/lib/config";
import type { Streak, Hero, DayState } from "../../src/contracts/save";
import {
  computeStars, parMs, dayGap, updateStreak, updateHero, isHero, recentSolveMs, wonOnDate,
  wonTierOnDate, nextPlayableTier, tierHistory,
} from "../../src/lib/scoring";

const STD: TierDial = { par_s: 240, hints: 2, attempts: 3, feedback: "count-wrong" };

describe("computeStars", () => {
  it("3 = no hints, 0 wrong, under par", () => expect(computeStars(200_000, 0, 0, STD)).toBe(3));
  it("2 = no hints but over par", () => expect(computeStars(999_000, 0, 0, STD)).toBe(2));
  it("2 = no hints but a wrong check", () => expect(computeStars(10_000, 0, 1, STD)).toBe(2));
  it("1 = any hint", () => expect(computeStars(10_000, 1, 0, STD)).toBe(1));
  it("par boundary is inclusive", () => expect(computeStars(parMs(STD), 0, 0, STD)).toBe(3));
});

describe("forgiving streak", () => {
  const base: Streak = { count: 3, lastDate: "2026-06-27", skipsLeft: 1 };
  it("consecutive day increments", () => expect(updateStreak(base, "2026-06-28").count).toBe(4));
  it("same day is a no-op count", () => expect(updateStreak(base, "2026-06-27").count).toBe(3));
  it("one missed day burns a skip and holds", () => {
    const r = updateStreak(base, "2026-06-29"); // skip 28
    expect(r.count).toBe(4);
    expect(r.skipsLeft).toBe(0);
  });
  it("a gap with no skip resets to 1", () => {
    const r = updateStreak({ count: 5, lastDate: "2026-06-24", skipsLeft: 0 }, "2026-06-27");
    expect(r.count).toBe(1);
  });
  it("first ever solve starts at 1", () =>
    expect(updateStreak({ count: 0, lastDate: "", skipsLeft: 1 }, "2026-06-29").count).toBe(1));
  it("dayGap counts whole days", () => expect(dayGap("2026-06-27", "2026-06-29")).toBe(2));
});

describe("hero best-time (brag-cost)", () => {
  const hero: Hero = { bestMs: 41000, date: "2026-06-20" };
  it("faster clean solve sets a record", () => expect(updateHero(hero, 30000, 0, "x").bestMs).toBe(30000));
  it("hinted solve never sets best", () => expect(updateHero(hero, 1, 1, "x").bestMs).toBe(41000));
  it("isHero true only when clean + faster", () => {
    expect(isHero(hero, 30000, 0)).toBe(true);
    expect(isHero(hero, 30000, 1)).toBe(false);
    expect(isHero(hero, 50000, 0)).toBe(false);
  });
});

describe("sparkline window", () => {
  it("keeps last N won solve times oldest->newest", () => {
    const days: Record<string, DayState> = {};
    for (let i = 0; i < 5; i++)
      days[`2026-06-0${i + 1}`] = { date: `2026-06-0${i + 1}`, tier: "easy", shapeId: "grid", status: "won", placements: {}, attempts: 0, solveMs: (i + 1) * 1000, hintsUsed: 0, stars: 3 };
    expect(recentSolveMs(days, 3)).toEqual([3000, 4000, 5000]);
  });
});

describe("tierHistory (per-difficulty breakdown)", () => {
  const ORDER = ["easy", "standard", "sharp", "expert"];
  const day = (date: string, tier: string, status: string, solveMs: number): DayState => ({
    date, tier: tier as DayState["tier"], shapeId: "grid", status: status as DayState["status"],
    placements: {}, attempts: 0, solveMs, hintsUsed: 0, stars: 3,
  });
  it("lists every tier in order; unplayed ones are zeroed", () => {
    const h = tierHistory({}, ORDER);
    expect(h.map((t) => t.tier)).toEqual(ORDER);
    expect(h.every((t) => t.solved === 0 && t.bestMs === 0)).toBe(true);
  });
  it("counts won slots and takes the fastest solve per tier across days", () => {
    const days: Record<string, DayState> = {
      "2026-07-01|easy|grid": day("2026-07-01", "easy", "won", 12000),
      "2026-07-02|easy|grid": day("2026-07-02", "easy", "won", 8000), // a faster easy day
      "2026-07-01|standard|grid": day("2026-07-01", "standard", "won", 40000),
      "2026-07-03|standard|grid": day("2026-07-03", "standard", "playing", 0), // not a win
    };
    const h = tierHistory(days, ORDER);
    const easy = h.find((t) => t.tier === "easy")!;
    const std = h.find((t) => t.tier === "standard")!;
    expect(easy.solved).toBe(2);
    expect(easy.bestMs).toBe(8000); // the faster of the two easy solves
    expect(std.solved).toBe(1); // the "playing" slot is not counted
    expect(std.bestMs).toBe(40000);
    expect(h.find((t) => t.tier === "sharp")!.solved).toBe(0);
  });
});

describe("wonOnDate (7-day dots)", () => {
  const day = (date: string, tier: string, shapeId: string, status: string): DayState => ({
    date, tier: tier as DayState["tier"], shapeId: shapeId as DayState["shapeId"],
    status: status as DayState["status"], placements: {}, attempts: 0, solveMs: 1, hintsUsed: 0, stars: 1,
  });
  it("true when ANY composite slot for that date won, ignoring the map key", () => {
    const days: Record<string, DayState> = {
      "2026-07-01|easy|grid": day("2026-07-01", "easy", "grid", "playing"),
      "2026-07-01|standard|seating-row": day("2026-07-01", "standard", "seating-row", "won"),
      "2026-06-30|easy|grid": day("2026-06-30", "easy", "grid", "lost"),
    };
    expect(wonOnDate(days, "2026-07-01")).toBe(true); // one of the day's slots won
    expect(wonOnDate(days, "2026-06-30")).toBe(false); // only a loss that day
    expect(wonOnDate(days, "2026-06-29")).toBe(false); // no slot at all
  });
});

describe("nextPlayableTier (PLAY always lands on a playable puzzle)", () => {
  const ORDER = ["easy", "standard", "sharp", "expert"];
  const T = "2026-07-05";
  const day = (date: string, tier: string, status: string): DayState => ({
    date, tier: tier as DayState["tier"], shapeId: "grid" as DayState["shapeId"],
    status: status as DayState["status"], placements: {}, attempts: 0, solveMs: 1, hintsUsed: 0, stars: 1,
  });

  it("resumes the last tier while today's puzzle for it is unsolved", () => {
    expect(nextPlayableTier({}, T, ORDER, "easy")).toBe("easy"); // first-ever
    const mid = { a: day(T, "standard", "playing") };
    expect(nextPlayableTier(mid, T, ORDER, "standard")).toBe("standard"); // resume in-progress
  });

  it("advances to the next unsolved tier once the last is won today", () => {
    const days = { a: day(T, "easy", "won") };
    expect(nextPlayableTier(days, T, ORDER, "easy")).toBe("standard");
  });

  it("skips every tier already solved today", () => {
    const days = { a: day(T, "easy", "won"), b: day(T, "standard", "won") };
    expect(nextPlayableTier(days, T, ORDER, "easy")).toBe("sharp");
  });

  it("falls back to the last tier when all are solved today (shows its result)", () => {
    const days = Object.fromEntries(ORDER.map((t) => [t, day(T, t, "won")]));
    expect(nextPlayableTier(days, T, ORDER, "expert")).toBe("expert");
  });

  it("a win on a PRIOR day never blocks today's tier", () => {
    const days = { a: day("2026-07-04", "easy", "won") };
    expect(nextPlayableTier(days, T, ORDER, "easy")).toBe("easy");
    expect(wonTierOnDate(days, T, "easy")).toBe(false);
  });
});
