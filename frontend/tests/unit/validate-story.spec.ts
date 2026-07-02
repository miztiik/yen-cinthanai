// Validator unit tests for the story-first clue types (numDiff, threshold, oneOf,
// oneEachOf, ifThen), evaluated against hand-built PARTIAL placements - never the
// solution. Each type is checked for satisfy + violate + unknown (unknown = too few
// cells placed to decide), mirroring tools/generate.py _add_clue. The anchor:true name
// axis is the identity (value i -> entity i), so entity e0=n0 .. e3=n3. No mocks.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PuzzleManifest } from "../../src/contracts/manifest";
import type { Placements } from "../../src/contracts/save";
import { buildBoard } from "../../src/lib/board";
import { evaluate } from "../../src/lib/validate";

const here = fileURLToPath(new URL(".", import.meta.url));
const m = JSON.parse(
  readFileSync(resolve(here, "../fixtures/story-clues.json"), "utf8"),
) as PuzzleManifest;
const board = buildBoard(m);

/** State of one clue under a partial placement. */
function at(place: Placements, id: string): string {
  return evaluate(m, board, place).clues[id];
}

describe("buildBoard honours the anchor:true identity", () => {
  it("anchors on name (not the ordinal price axis) and leaves craft + price fillable", () => {
    expect(board.anchor.id).toBe("name");
    expect(board.columns.map((c) => c.id)).toEqual(["craft", "price"]);
  });
});

describe("numDiff (directed 'greater')", () => {
  it("satisfy: magA == magB + delta", () => {
    expect(at({ e2: { price: "p20" }, e1: { price: "p10" } }, "nd_g")).toBe("satisfy");
  });
  it("violate: gap wrong", () => {
    expect(at({ e2: { price: "p10" }, e1: { price: "p5" } }, "nd_g")).toBe("violate");
  });
  it("unknown: an operand's magnitude is unplaced", () => {
    expect(at({ e2: { price: "p20" } }, "nd_g")).toBe("unknown");
  });
});

describe("numDiff (undirected absolute gap)", () => {
  it("satisfy: |magA - magB| == delta", () => {
    expect(at({ e0: { price: "p5" }, e1: { price: "p10" } }, "nd_u")).toBe("satisfy");
  });
  it("violate: absolute gap wrong", () => {
    expect(at({ e0: { price: "p5" }, e1: { price: "p20" } }, "nd_u")).toBe("violate");
  });
  it("unknown: an operand's magnitude is unplaced", () => {
    expect(at({ e0: { price: "p5" } }, "nd_u")).toBe("unknown");
  });
});

describe("threshold", () => {
  it("atleast satisfy: mag >= bound", () => {
    expect(at({ e2: { price: "p20" } }, "th_al")).toBe("satisfy");
  });
  it("atleast violate: mag < bound", () => {
    expect(at({ e2: { price: "p10" } }, "th_al")).toBe("violate");
  });
  it("atleast unknown: numeric unplaced", () => {
    expect(at({}, "th_al")).toBe("unknown");
  });
  it("atmost satisfy: mag <= bound", () => {
    expect(at({ e0: { price: "p5" } }, "th_am")).toBe("satisfy");
  });
  it("atmost violate: mag > bound", () => {
    expect(at({ e0: { price: "p20" } }, "th_am")).toBe("violate");
  });
});

describe("oneOf (a's cat-value is x OR y)", () => {
  it("satisfy: the entity holds one of the two", () => {
    expect(at({ e0: { craft: "c_a" } }, "one_of")).toBe("satisfy");
  });
  it("violate: the entity holds a third value", () => {
    expect(at({ e0: { craft: "c_c" } }, "one_of")).toBe("violate");
  });
  it("unknown: the entity's cell is empty", () => {
    expect(at({}, "one_of")).toBe("unknown");
  });
});

describe("oneEachOf (of x, y one does A the other B)", () => {
  it("satisfy: the reified pairing holds", () => {
    expect(at({ e0: { craft: "c_a" }, e1: { craft: "c_b" } }, "one_each")).toBe("satisfy");
  });
  it("satisfy: the mirror pairing also holds", () => {
    expect(at({ e0: { craft: "c_b" }, e1: { craft: "c_a" } }, "one_each")).toBe("satisfy");
  });
  it("violate: neither pairing can hold", () => {
    expect(at({ e0: { craft: "c_c" }, e1: { craft: "c_d" } }, "one_each")).toBe("violate");
  });
  it("unknown: one side still empty", () => {
    expect(at({ e0: { craft: "c_a" } }, "one_each")).toBe("unknown");
  });
});

describe("ifThen (if a does P then b not Q)", () => {
  it("satisfy: antecedent true, consequent avoided", () => {
    expect(at({ e0: { craft: "c_a" }, e1: { craft: "c_b" } }, "if_then")).toBe("satisfy");
  });
  it("satisfy: antecedent false", () => {
    expect(at({ e0: { craft: "c_c" }, e1: { craft: "c_c" } }, "if_then")).toBe("satisfy");
  });
  it("violate: antecedent and forbidden consequent both hold", () => {
    expect(at({ e0: { craft: "c_a" }, e1: { craft: "c_c" } }, "if_then")).toBe("violate");
  });
  it("unknown: antecedent true, consequent unplaced", () => {
    expect(at({ e0: { craft: "c_a" } }, "if_then")).toBe("unknown");
  });
});

describe("full solution wins", () => {
  it("filling every fillable cell from the solution satisfies all story clues", () => {
    const ev = evaluate(m, board, m.solution);
    expect(ev.won).toBe(true);
    expect(Object.values(ev.clues).every((s) => s === "satisfy")).toBe(true);
  });
});
