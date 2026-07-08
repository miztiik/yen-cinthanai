// Unit: answerGrid builds the private post-win reveal from a board + solution. Labels and
// glyph refs surface in board order; the anchor value heads each row (identity). Pure
// function, no render. Covers a story-first manifest (empty glyphs) and a legacy glyph
// manifest (real glyph refs). See src/lib/answer.ts, ui-shell.md.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PuzzleManifest } from "../../src/contracts/manifest";
import { buildBoard } from "../../src/lib/board";
import { answerGrid, playerGrid } from "../../src/lib/answer";
import type { Placements } from "../../src/contracts/save";

const here = fileURLToPath(new URL(".", import.meta.url));
function load(name: string): PuzzleManifest {
  return JSON.parse(readFileSync(resolve(here, `../fixtures/${name}`), "utf8")) as PuzzleManifest;
}

describe("answerGrid (story-first)", () => {
  const m = load("story-clues.json");
  const grid = answerGrid(buildBoard(m), m.solution);

  it("uses the fillable category labels as columns, anchor as row identity", () => {
    expect(grid.columns).toEqual(["Craft", "Price"]);
    expect(grid.rows).toHaveLength(4);
    expect(grid.rows.map((r) => r.head.label)).toEqual(["N0", "N1", "N2", "N3"]);
  });

  it("fills each row from the solution, in board order", () => {
    expect(grid.rows[0].cells.map((c) => c.label)).toEqual(["Alpha", "5"]);
    expect(grid.rows[2].cells.map((c) => c.label)).toEqual(["Charlie", "20"]);
  });

  it("carries empty glyph refs when the axis has no glyph", () => {
    expect(grid.rows[0].head.glyph).toBe("");
    expect(grid.rows[0].cells.every((c) => c.glyph === "")).toBe(true);
  });
});

describe("answerGrid (legacy glyph manifest)", () => {
  const m = load("manifest-4x3.json");
  const grid = answerGrid(buildBoard(m), m.solution);

  it("anchors on the ordinal seat and surfaces glyph refs", () => {
    expect(grid.columns).toEqual(["Drink", "Animal"]);
    expect(grid.rows[0].head).toEqual({ label: "1", glyph: "abstract.num1" });
    expect(grid.rows[0].cells[0]).toEqual({ label: "Tea", glyph: "household.tea" });
    expect(grid.rows[0].cells[1]).toEqual({ label: "Cat", glyph: "creatures.cat" });
  });
});

describe("playerGrid (live results from the player's own marks)", () => {
  const m = load("story-clues.json");
  const board = buildBoard(m);

  it("is EMPTY with no placements - it reads the player's marks, NEVER the solution (no spoiler)", () => {
    const pg = playerGrid(board, {}, new Set());
    expect(pg.columns).toEqual(["Craft", "Price"]);
    expect(pg.rows.every((r) => r.cells.every((c) => c.label === ""))).toBe(true);
    // Proof it does not read the solution: the solved reveal of the SAME board is fully filled.
    expect(answerGrid(board, m.solution).rows[0].cells[0].label).not.toBe("");
  });

  it("equals the solved reveal once every placement is committed", () => {
    expect(playerGrid(board, m.solution, new Set())).toEqual(answerGrid(board, m.solution));
  });

  it("fills ONLY the deduced cells (partial), following the placement not the solution", () => {
    const craft = board.columns[0].id;
    const place: Placements = { [board.entities[0]]: { [craft]: m.solution[board.entities[0]][craft] } };
    const pg = playerGrid(board, place, new Set());
    expect(pg.rows[0].cells[0].label).toBe(answerGrid(board, m.solution).rows[0].cells[0].label); // deduced craft
    expect(pg.rows[0].cells[1].label).toBe(""); // price undeduced
    expect(pg.rows.slice(1).every((r) => r.cells.every((c) => c.label === ""))).toBe(true); // other entities undeduced
  });
});
