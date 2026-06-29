// Contract: the shape registry (config/shapes.toml -> baked shapes.json) is the only
// per-shape knowledge; the engine reads shapeId and skins by it. v1 ships exactly two
// entries (grid + seating-row) to prove the seam. Cross-check: every bank manifest's
// clue types are a subset of its shape's slot_rules, and entity count <= max_entities.

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
  it("ships grid + seating-row + round-table, three topologies", () => {
    expect(Object.keys(reg).sort()).toEqual(["grid", "round-table", "seating-row"]);
  });

  it("grid matrix, seating linear, round-table circular; ordinal axes set", () => {
    expect(reg.grid.topology).toBe("matrix");
    expect(reg.grid.ordinal_axis).toBe(false);
    expect(reg["seating-row"].topology).toBe("linear");
    expect(reg["seating-row"].ordinal_axis).toBe(true);
    expect(reg["round-table"].topology).toBe("circular");
    expect(reg["round-table"].ordinal_axis).toBe(true);
  });

  it("round-table wraps: opposite/between unlocked, ends excluded (no first/last)", () => {
    expect(reg["round-table"].slot_rules).toEqual(expect.arrayContaining(["opposite", "between", "adjacent"]));
    expect(reg["round-table"].slot_rules).not.toContain("ends");
  });

  it("each entry carries every registry field with a pack.id glyph and cap", () => {
    for (const s of Object.values(reg)) {
      expect(s.glyph).toMatch(/^[a-z]+\.[a-z0-9]+$/);
      expect(s.max_entities).toBeGreaterThanOrEqual(6);
      expect(s.slot_rules.length).toBeGreaterThan(0);
      expect(s.v).toBe(1);
    }
  });

  it("ordinal clue types unlock only for the ordinal axis", () => {
    expect(reg.grid.slot_rules).toEqual(["eq", "neq"]);
    for (const t of ["ends", "adjacent", "distance", "before"]) {
      expect(reg["seating-row"].slot_rules).toContain(t);
    }
  });

  it("every bank manifest stays within its shape's rules and cap", () => {
    expect(manifests.length).toBeGreaterThan(0);
    for (const m of manifests) {
      const shape = reg[m.shapeId];
      expect(shape).toBeDefined();
      expect(m.entities.length).toBeLessThanOrEqual(shape.max_entities);
      for (const k of m.constraints) expect(shape.slot_rules).toContain(k.type);
    }
  });

  it("the bank ships a round-table puzzle so the drawer chip is enabled (not greyed)", () => {
    expect(manifests.some((m) => m.shapeId === "round-table")).toBe(true);
  });
});
