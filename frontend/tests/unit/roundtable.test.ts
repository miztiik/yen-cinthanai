// Unit: the validator is shape-agnostic. A synthetic round-table exercises the wrap
// clue types (adjacent wraps, opposite across the ring, between two seats) plus a
// SHARED category (team binary, repeats) through eq/neq set-overlap. Position is the
// anchor: value i sits in seat i, so seat 0 and seat 3 are adjacent on a 4-ring. No
// solution is read; placements are hand-built. Operands are (cat,value), never seats.

import { describe, it, expect } from "vitest";
import type { PuzzleManifest } from "../../src/contracts/manifest";
import { buildBoard, ringSeats } from "../../src/lib/board";
import { evaluate } from "../../src/lib/validate";

// 4 seats. drink a/b/c/d at seats 0..3; team (shared) red,red,blue,blue.
const m: PuzzleManifest = {
  schemaVersion: 1,
  puzzleId: "2026-06-29",
  tier: "expert",
  shapeId: "round-table",
  templateRev: 1,
  entities: ["e0", "e1", "e2", "e3"],
  categories: {
    n: 3,
    list: [
      { id: "drink", label: "Drink", ordinal: false, cardinality: "bijective", values: [
        { id: "a", glyph: "household.tea", label: "A" }, { id: "b", glyph: "household.coffee", label: "B" },
        { id: "c", glyph: "household.milk", label: "C" }, { id: "d", glyph: "household.cola", label: "D" }] },
      { id: "pos", label: "Seat", ordinal: true, cardinality: "bijective", values: [
        { id: "s0", glyph: "abstract.num1", label: "1" }, { id: "s1", glyph: "abstract.num2", label: "2" },
        { id: "s2", glyph: "abstract.num3", label: "3" }, { id: "s3", glyph: "abstract.num4", label: "4" }] },
      { id: "team", label: "Team", ordinal: false, cardinality: "shared", values: [
        { id: "red", glyph: "shapes.circle", label: "R" }, { id: "blue", glyph: "shapes.square", label: "B" }] },
    ],
  },
  constraints: [
    { id: "c1", type: "opposite", operands: [{ cat: "drink", value: "a" }, { cat: "drink", value: "c" }], params: {}, clueText: "", renderHint: "opposite" },
    { id: "c2", type: "adjacent", operands: [{ cat: "drink", value: "a" }, { cat: "drink", value: "d" }], params: {}, clueText: "", renderHint: "adjacent" },
    { id: "c3", type: "between", operands: [{ cat: "drink", value: "b" }, { cat: "drink", value: "a" }, { cat: "drink", value: "c" }], params: {}, clueText: "", renderHint: "between" },
    { id: "c4", type: "eq", operands: [{ cat: "drink", value: "a" }, { cat: "team", value: "red" }], params: {}, clueText: "", renderHint: "eq" },
    { id: "c5", type: "neq", operands: [{ cat: "drink", value: "c" }, { cat: "team", value: "red" }], params: {}, clueText: "", renderHint: "neq" },
  ],
  solution: { e0: { drink: "a", team: "red" }, e1: { drink: "b", team: "red" }, e2: { drink: "c", team: "blue" }, e3: { drink: "d", team: "blue" } },
  hintTrace: [],
};
const board = buildBoard(m);
const SOL = { e0: { drink: "a", team: "red" }, e1: { drink: "b", team: "red" }, e2: { drink: "c", team: "blue" }, e3: { drink: "d", team: "blue" } };

describe("round-table topology", () => {
  it("wraps: seat 0 and seat 3 are adjacent; team is fillable, not anchored", () => {
    expect(board.wrap).toBe(true);
    expect(board.anchor.id).toBe("pos");
    expect(board.columns.map((c) => c.id)).toEqual(["drink", "team"]);
  });

  it("opposite, adjacent (wrap), between and shared eq/neq all satisfy + win", () => {
    const ev = evaluate(m, board, SOL);
    expect(ev.clues.c1).toBe("satisfy"); // a@0 opposite c@2 (n/2=2)
    expect(ev.clues.c2).toBe("satisfy"); // a@0 adjacent d@3 across the wrap
    expect(ev.clues.c3).toBe("satisfy"); // b@1 between a@0 and c@2
    expect(ev.clues.c4).toBe("satisfy"); // a is red
    expect(ev.clues.c5).toBe("satisfy"); // c is not red
    expect(ev.won).toBe(true);
  });

  it("opposite violates when the two are only adjacent", () => {
    const ev = evaluate(m, board, { e0: { drink: "a" }, e1: { drink: "c" } });
    expect(ev.clues.c1).toBe("violate");
  });

  it("shared team repeats: two reds satisfy eq, both seats overlap", () => {
    const ev = evaluate(m, board, { e0: { drink: "a", team: "red" }, e1: { drink: "b", team: "red" } });
    expect(ev.clues.c4).toBe("satisfy");
  });
});

describe("ring layout (circular render)", () => {
  it("seat 0 sits at the top; seats are distinct and centred", () => {
    const s = ringSeats(4);
    expect(s).toHaveLength(4);
    expect(s[0].x).toBeCloseTo(0.5);
    expect(s[0].y).toBeLessThan(0.5); // top of the box
    expect(new Set(s.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)).size).toBe(4);
  });
  it("renders up to 6 seats inside the box (cap = maxEntities)", () => {
    for (const p of ringSeats(6)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });
});
