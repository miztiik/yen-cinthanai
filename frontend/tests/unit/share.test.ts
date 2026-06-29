// Unit: spoiler-free share string. Built from a fully-solved DayState (placements ==
// solution, the leak worst case) -> shareText must carry only stats (tier, star bar,
// time, wrong, hints, streak), never a value id. Mirrors share-noleak.test.ts. D9.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildShareCard, shareText, type ShareCopy } from "../../src/contracts/share";
import type { DayState } from "../../src/contracts/save";
import type { PuzzleManifest } from "../../src/contracts/manifest";

const here = fileURLToPath(new URL(".", import.meta.url));
const m = JSON.parse(
  readFileSync(resolve(here, "../fixtures/manifest-4x3.json"), "utf8"),
) as PuzzleManifest;

const day: DayState = {
  date: m.puzzleId, tier: m.tier, shapeId: m.shapeId, status: "won",
  placements: m.solution, attempts: 2, solveMs: 123000, hintsUsed: 1, stars: 2,
};
const t: ShareCopy = { title: "yen-cinthanai {tier}", line: "{stars} {time}s w{wrong} h{hints}", streak: "flame {streak}" };
const card = buildShareCard(day, { count: 5, lastDate: m.puzzleId, skipsLeft: 1 }, "abstract.seating");
const text = shareText(card, day.stars, t);

describe("shareText", () => {
  it("leaks no solution value id", () => {
    const ids = m.categories.list.flatMap((c) => c.values.map((v) => v.id));
    for (const id of ids) expect(text).not.toContain(id);
  });
  it("has no placements/solution/entities words", () => {
    expect(text).not.toMatch(/placements|solution|entities/);
  });
  it("renders tier, star bar, time, wrong, hints, streak", () => {
    expect(text).toContain("standard");
    expect(text).toContain("**.");
    expect(text).toContain("123s");
    expect(text).toContain("w2");
    expect(text).toContain("h1");
    expect(text).toContain("flame 5");
  });
  it("clamps stars to a 3-wide bar", () => {
    expect(shareText(card, 0, t)).toContain("...");
    expect(shareText(card, 3, t)).toContain("***");
    expect(shareText(card, 9, t)).toContain("***");
  });
  it("is ASCII only", () => {
    expect(text).toMatch(/^[\x00-\x7f]+$/);
  });
});
