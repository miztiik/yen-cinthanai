// Contract: ShareCard must NOT leak the solution or the private notes. Build a card from a
// fully-solved DayState (placements == solution) that also carries grid + clue notes, and
// assert no value id, no placements/solution/entities keys, no notes bookkeeping (manualX /
// scratchTicks / struckClues), and only stat fields survive. schemas.md sec 5.5, design D9.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildShareCard } from "../../src/contracts/share";
import type { DayState } from "../../src/contracts/save";
import type { PuzzleManifest } from "../../src/contracts/manifest";

const here = fileURLToPath(new URL(".", import.meta.url));
const m = JSON.parse(
  readFileSync(resolve(here, "../fixtures/manifest-4x3.json"), "utf8"),
) as PuzzleManifest;

const day: DayState = {
  date: m.puzzleId,
  tier: m.tier,
  shapeId: m.shapeId,
  status: "won",
  placements: m.solution, // full solution as placements - worst case for leakage
  attempts: 2,
  solveMs: 123000,
  hintsUsed: 1,
  stars: 1,
  // Grid + clue bookkeeping (Row 7) whose endpoint keys embed real value ids - the card must
  // drop it entirely (stats-only), so this is the worst case for a notes leak too.
  notes: {
    manualX: ["position:p1|drink:coffee"],
    scratchTicks: ["position:p0|drink:tea"],
    struckClues: ["c1", "c3"],
  },
};

const card = buildShareCard(day, { count: 5, lastDate: m.puzzleId, skipsLeft: 1 }, "abstract.seating");
const json = JSON.stringify(card);

describe("ShareCard no-leak", () => {
  it("carries only the 10 stat fields", () => {
    expect(Object.keys(card).sort()).toEqual(
      [
        "date",
        "hintsUsed",
        "moves",
        "schemaVersion",
        "shapeGlyph",
        "solveMs",
        "status",
        "streak",
        "tier",
        "wrong",
      ].sort(),
    );
  });

  it("has no placements/solution/entities keys", () => {
    expect(json).not.toMatch(/placements|solution|entities/);
  });

  it("drops the private notes bookkeeping (manualX / scratchTicks / struckClues)", () => {
    expect(json).not.toMatch(/notes|manualX|scratchTicks|struckClues/);
    const keys = [
      ...(day.notes?.manualX ?? []),
      ...(day.notes?.scratchTicks ?? []),
      ...(day.notes?.struckClues ?? []),
    ];
    for (const k of keys) expect(json).not.toContain(k);
  });

  it("contains no solution value id", () => {
    const valueIds = m.categories.list.flatMap((c) => c.values.map((v) => v.id));
    for (const id of valueIds) expect(json).not.toContain(`"${id}"`);
  });

  it("derives moves as a count, never a placement", () => {
    expect(card.moves).toBe(m.entities.length * m.categories.n);
    expect(card.wrong).toBe(2);
  });
});
