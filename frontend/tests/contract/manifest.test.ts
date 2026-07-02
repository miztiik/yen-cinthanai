// Contract: PuzzleManifest reader vs the worked 4x3 fixture (schemas.md). The TS
// types are structural, so the test reads the on-disk fixture and asserts the
// shape both sides must hold: bijective cardinality, category count, solution
// completeness, operands reference real cats/values, hintTrace forces are valid.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PuzzleManifest } from "../../src/contracts/manifest";
import { isManifest } from "../../src/lib/loader";

const here = fileURLToPath(new URL(".", import.meta.url));
const fixture = resolve(here, "../fixtures/manifest-4x3.json");
const m = JSON.parse(readFileSync(fixture, "utf8")) as PuzzleManifest;

// A generated story-first golden (schemaVersion 2: story/scenarioId/kind/anchor/magnitude/
// phrase present). Lives under datasets/ (build-time source).
const storyFirst = JSON.parse(
  readFileSync(resolve(here, "../../../datasets/2026/07/01/standard/2026-07-01-001.json"), "utf8"),
) as PuzzleManifest;

describe("PuzzleManifest v2 (4x3 grid fixture)", () => {
  it("is version 2 with date puzzleId and grid shape", () => {
    expect(m.schemaVersion).toBe(2);
    expect(m.puzzleId).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(["easy", "standard", "sharp", "expert"]).toContain(m.tier);
    expect(m.shapeId).toBe("grid");
  });

  it("declares 4 entities x 3 categories (categories.n matches list)", () => {
    expect(m.entities).toHaveLength(4);
    expect(m.categories.n).toBe(3);
    expect(m.categories.list).toHaveLength(3);
  });

  it("bijective categories have one value per entity, glyphs are pack.id refs", () => {
    for (const c of m.categories.list) {
      if (c.cardinality === "bijective") expect(c.values).toHaveLength(m.entities.length);
      for (const v of c.values) expect(v.glyph).toMatch(/^[a-z]+\.[a-z0-9]+$/);
    }
  });

  it("solution covers every entity x category with a declared value", () => {
    const byCat = new Map(m.categories.list.map((c) => [c.id, new Set(c.values.map((v) => v.id))]));
    for (const e of m.entities) {
      const row = m.solution[e];
      expect(Object.keys(row).sort()).toEqual([...byCat.keys()].sort());
      for (const [cat, val] of Object.entries(row)) expect(byCat.get(cat)?.has(val)).toBe(true);
    }
  });

  it("constraint operands reference real categories and values", () => {
    const byCat = new Map(m.categories.list.map((c) => [c.id, new Set(c.values.map((v) => v.id))]));
    for (const k of m.constraints) {
      expect(k.operands.length).toBeGreaterThan(0);
      for (const o of k.operands) expect(byCat.get(o.cat)?.has(o.value)).toBe(true);
    }
  });

  it("hintTrace forces are consistent with the solution", () => {
    for (const step of m.hintTrace) {
      const f = step.forces;
      expect(m.solution[f.entity]?.[f.cat]).toBe(f.value);
    }
  });
});

describe("v2 reader accepts story-first manifests", () => {
  it("accepts the v2 4x3 grid fixture (story + kind + one anchor)", () => {
    expect(isManifest(m)).toBe(true);
    expect(typeof m.story).toBe("string");
    expect(m.categories.list.every((c) => typeof c.kind === "string")).toBe(true);
    expect(m.categories.list.filter((c) => c.anchor)).toHaveLength(1);
  });

  it("accepts a story-first manifest and exposes story/scenarioId/kind/magnitude/phrase", () => {
    expect(isManifest(storyFirst)).toBe(true);
    expect(typeof storyFirst.story).toBe("string");
    expect(storyFirst.scenarioId).toBe("weekend-market");
    expect(storyFirst.subjectNoun).toBe("friend");
    expect(storyFirst.variant).toBe(1);
    const numeric = storyFirst.categories.list.find((c) => c.kind === "numeric");
    expect(numeric?.unit).toBe("dollars");
    expect(numeric?.values.some((v) => typeof v.magnitude === "number")).toBe(true);
    const hasPhrase = storyFirst.categories.list.some((c) =>
      c.values.some((v) => typeof v.phrase === "string"),
    );
    expect(hasPhrase).toBe(true);
  });
});
