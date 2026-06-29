// Unit: the validator is shape-agnostic - the same evaluate() serves grid + seating
// because position is just the anchor index. A synthetic seating-row puzzle exercises
// the ordinal clue types (ends, adjacent, before) end to end, satisfy and violate. No
// solution is read; we hand-build placements. Operands are (cat,value), never entities.

import { describe, it, expect } from "vitest";
import type { PuzzleManifest } from "../../src/contracts/manifest";
import { buildBoard } from "../../src/lib/board";
import { evaluate } from "../../src/lib/validate";

// 3 seats, drinks a/b/c; solution a@0 b@1 c@2. ends(a left), adjacent(a,b), before(a<c).
const m: PuzzleManifest = {
  schemaVersion: 1,
  puzzleId: "2026-06-29",
  tier: "standard",
  shapeId: "seating-row",
  templateRev: 1,
  entities: ["e0", "e1", "e2"],
  categories: {
    n: 2,
    list: [
      { id: "drink", label: "Drink", ordinal: false, cardinality: "bijective", values: [
        { id: "a", glyph: "household.tea", label: "A" }, { id: "b", glyph: "household.milk", label: "B" }, { id: "c", glyph: "household.cola", label: "C" }] },
      { id: "pos", label: "Seat", ordinal: true, cardinality: "bijective", values: [
        { id: "s0", glyph: "abstract.num1", label: "1" }, { id: "s1", glyph: "abstract.num2", label: "2" }, { id: "s2", glyph: "abstract.num3", label: "3" }] },
    ],
  },
  constraints: [
    { id: "c1", type: "ends", operands: [{ cat: "drink", value: "a" }], params: {}, clueText: "", renderHint: "ends" },
    { id: "c2", type: "adjacent", operands: [{ cat: "drink", value: "a" }, { cat: "drink", value: "b" }], params: {}, clueText: "", renderHint: "adjacent" },
    { id: "c3", type: "before", operands: [{ cat: "drink", value: "a" }, { cat: "drink", value: "c" }], params: {}, clueText: "", renderHint: "before" },
  ],
  solution: { e0: { drink: "a" }, e1: { drink: "b" }, e2: { drink: "c" } },
  hintTrace: [],
};
const board = buildBoard(m);

describe("seating-row validation", () => {
  it("anchors on the ordinal seat axis, drink is fillable", () => {
    expect(board.anchor.id).toBe("pos");
    expect(board.columns.map((c) => c.id)).toEqual(["drink"]);
  });

  it("ends + adjacent + before all satisfy and win for the solution", () => {
    const ev = evaluate(m, board, { e0: { drink: "a" }, e1: { drink: "b" }, e2: { drink: "c" } });
    expect(ev.clues.c1).toBe("satisfy");
    expect(ev.clues.c2).toBe("satisfy");
    expect(ev.clues.c3).toBe("satisfy");
    expect(ev.won).toBe(true);
  });

  it("violates ends + before when a sits in the middle/last", () => {
    const ev = evaluate(m, board, { e0: { drink: "b" }, e1: { drink: "a" }, e2: { drink: "c" } });
    expect(ev.clues.c1).toBe("violate"); // a not at an end
    expect(ev.clues.c3).toBe("satisfy"); // a(1) still before c(2)
    expect(ev.won).toBe(false);
  });
});
