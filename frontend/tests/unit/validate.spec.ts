// Validator unit tests vs the worked 4x3 fixture (every constraint type: eq, neq,
// ends, adjacent, before, distance). Checks placements, never the solution, so we
// build placements by hand and assert per-row + per-clue + win. No mocks.

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
  readFileSync(resolve(here, "../fixtures/manifest-4x3.json"), "utf8"),
) as PuzzleManifest;
const board = buildBoard(m);

// solution-equivalent fillable placements (anchor position is fixed identity)
const SOLVED: Placements = {
  e0: { drink: "tea", animal: "cat" },
  e1: { drink: "coffee", animal: "dog" },
  e2: { drink: "milk", animal: "fish" },
  e3: { drink: "cola", animal: "bird" },
};

describe("buildBoard", () => {
  it("anchors on the ordinal category and leaves the rest fillable", () => {
    expect(board.anchor.id).toBe("position");
    expect(board.columns.map((c) => c.id)).toEqual(["drink", "animal"]);
    expect(board.entities).toHaveLength(4);
  });
});

describe("evaluate", () => {
  it("empty board: unknown clues, no win", () => {
    const ev = evaluate(m, board, {});
    expect(ev.won).toBe(false);
    expect(ev.filled).toBe(0);
    expect(ev.total).toBe(8);
    expect(Object.values(ev.clues).every((s) => s === "unknown")).toBe(true);
  });

  it("violates ends when tea is not at an end", () => {
    const ev = evaluate(m, board, { e1: { drink: "tea", animal: "cat" } });
    expect(ev.clues.c1).toBe("violate");
    expect(ev.rows.e1).toBe("violate");
  });

  it("violates eq when tea and cat are split across rows", () => {
    const ev = evaluate(m, board, { e0: { drink: "tea" }, e1: { animal: "cat" } });
    expect(ev.clues.c2).toBe("violate");
  });

  it("satisfies distance=2 (cat e0, fish e2)", () => {
    const ev = evaluate(m, board, { e0: { animal: "cat" }, e2: { animal: "fish" } });
    expect(ev.clues.c5).toBe("satisfy");
  });

  it("full correct board satisfies every clue and wins, locking the grid", () => {
    const ev = evaluate(m, board, SOLVED);
    expect(ev.won).toBe(true);
    expect(ev.filled).toBe(ev.total);
    expect(Object.values(ev.clues).every((s) => s === "satisfy")).toBe(true);
    expect(Object.values(ev.rows).every((s) => s === "satisfy")).toBe(true);
  });

  it("does not win while a clue is violated", () => {
    const swapped: Placements = {
      e0: { drink: "coffee", animal: "cat" },
      e1: { drink: "tea", animal: "dog" },
      e2: { drink: "milk", animal: "fish" },
      e3: { drink: "cola", animal: "bird" },
    };
    expect(evaluate(m, board, swapped).won).toBe(false);
  });
});
