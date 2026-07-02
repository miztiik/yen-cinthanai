// Contract: the shape registry (config/shapes.json -> baked shapes.json) is the only
// per-shape knowledge; the engine reads shapeId and skins by it. Matrix-only after the
// contract close: it ships exactly one entry (grid). Cross-check: every bank manifest's
// clue types are within grid's rules (plus the story clue vocabulary), entity count <= cap.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PuzzleManifest } from "../../src/contracts/manifest";

const here = fileURLToPath(new URL(".", import.meta.url));
const reg = JSON.parse(
  readFileSync(resolve(here, "../../public/config/shapes.json"), "utf8"),
) as Record<string, { topology: string; ordinal_axis: boolean; max_entities: number; slot_rules: string[]; glyph: string; v: number }>;

const PUZZLES = resolve(here, "../../public/puzzles");
const manifests = readdirSync(PUZZLES)
  .filter((f) => f.endsWith(".json") && f !== "index.json")
  .map((f) => JSON.parse(readFileSync(resolve(PUZZLES, f), "utf8")) as PuzzleManifest);

describe("shape registry", () => {
  it("ships grid only (matrix-only after the seating/round-table retirement)", () => {
    expect(Object.keys(reg)).toEqual(["grid"]);
  });

  it("grid is a matrix with no ordinal axis and eq/neq rules", () => {
    expect(reg.grid.topology).toBe("matrix");
    expect(reg.grid.ordinal_axis).toBe(false);
    expect(reg.grid.slot_rules).toEqual(["eq", "neq"]);
  });

  it("the grid entry carries every registry field with a pack.id glyph and cap", () => {
    for (const s of Object.values(reg)) {
      expect(s.glyph).toMatch(/^[a-z]+\.[a-z0-9]+$/);
      expect(s.max_entities).toBeGreaterThanOrEqual(6);
      expect(s.slot_rules.length).toBeGreaterThan(0);
      expect(s.v).toBe(1);
    }
  });

  it("every bank manifest stays within its shape's rules and cap", () => {
    // Story-first grid manifests carry narrative clue types (numeric/compound) beyond the grid
    // registry's base eq/neq rules.
    const STORY_CLUES = new Set(["numDiff", "threshold", "oneOf", "oneEachOf", "ifThen"]);
    expect(manifests.length).toBeGreaterThan(0);
    for (const m of manifests) {
      const shape = reg[m.shapeId];
      expect(shape).toBeDefined();
      expect(m.entities.length).toBeLessThanOrEqual(shape.max_entities);
      const allowed = new Set([...shape.slot_rules, ...(m.story ? STORY_CLUES : [])]);
      for (const k of m.constraints) expect(allowed.has(k.type)).toBe(true);
    }
  });

  it("the served bank is grid-only (matrix-only contract close, seating/round-table retired)", () => {
    expect(manifests.length).toBeGreaterThan(0);
    expect(manifests.every((m) => m.shapeId === "grid")).toBe(true);
    expect(reg["seating-row"]).toBeUndefined();
    expect(reg["round-table"]).toBeUndefined();
  });
});
