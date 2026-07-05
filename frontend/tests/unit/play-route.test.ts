import { describe, it, expect } from "vitest";
import { parsePlay, playPath, dayNeighbors } from "../../src/lib/play-route";
import { addDays, formatDay, isIsoDate, todayUtc } from "../../src/lib/dates";

describe("play-route grammar (date-first canonical)", () => {
  it("parses the dated canonical form /play/<date>/<tier>", () => {
    expect(parsePlay("/play/2026-07-05/standard")).toEqual({ date: "2026-07-05", tier: "standard" });
  });

  it("parses a bare tier alias (no date)", () => {
    expect(parsePlay("/play/sharp")).toEqual({ tier: "sharp" });
  });

  it("parses a bare /play (no date, no tier)", () => {
    expect(parsePlay("/play")).toEqual({});
  });

  it("is order-tolerant (tier before date still resolves both)", () => {
    expect(parsePlay("/play/standard/2026-07-05")).toEqual({ date: "2026-07-05", tier: "standard" });
  });

  it("ignores unknown or malformed segments", () => {
    expect(parsePlay("/play/not-a-tier")).toEqual({});
    expect(parsePlay("/play/2026-13-99/standard")).toEqual({ tier: "standard" }); // bad date dropped
  });

  it("returns empty for non-play routes", () => {
    expect(parsePlay("/stats")).toEqual({});
    expect(parsePlay("/")).toEqual({});
  });

  it("builds a date-first canonical path aligned with the file name", () => {
    // puzzles/<date>-<tier>.json  <->  play/<date>/<tier>
    expect(playPath("2026-07-05", "standard")).toBe("play/2026-07-05/standard");
  });

  it("round-trips playPath -> parsePlay for every tier", () => {
    for (const t of ["easy", "standard", "sharp", "expert"] as const) {
      expect(parsePlay("/" + playPath("2026-07-05", t))).toEqual({ date: "2026-07-05", tier: t });
    }
  });
});

describe("date helpers (UTC)", () => {
  it("todayUtc is ISO YYYY-MM-DD", () => {
    expect(todayUtc()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("isIsoDate accepts real dates and rejects malformed ones", () => {
    expect(isIsoDate("2026-07-05")).toBe(true);
    expect(isIsoDate("2026-7-5")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("nope")).toBe(false);
  });

  it("addDays moves by whole UTC days across month and year bounds", () => {
    expect(addDays("2026-07-05", -1)).toBe("2026-07-04");
    expect(addDays("2026-07-01", -1)).toBe("2026-06-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("formatDay is a short weekday + day + month label", () => {
    expect(formatDay("2026-06-29")).toMatch(/^[A-Z][a-z]{2} 29 Jun$/);
    expect(formatDay("2026-12-01")).toMatch(/^[A-Z][a-z]{2} 1 Dec$/);
  });
});

describe("dayNeighbors (caret adjacency)", () => {
  const week = ["2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02"];

  it("a middle day has both neighbours", () => {
    expect(dayNeighbors(week, "2026-06-30")).toEqual({ prev: "2026-06-29", next: "2026-07-01" });
  });

  it("the newest day (today) has no next - the next caret disables", () => {
    expect(dayNeighbors(week, "2026-07-02")).toEqual({ prev: "2026-07-01", next: undefined });
  });

  it("the oldest day has no prev - the prev caret disables", () => {
    expect(dayNeighbors(week, "2026-06-29")).toEqual({ prev: undefined, next: "2026-06-30" });
  });

  it("a date absent from the list has no neighbours", () => {
    expect(dayNeighbors(week, "2026-01-01")).toEqual({});
  });
});
