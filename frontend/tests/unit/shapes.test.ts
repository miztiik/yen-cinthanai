// Unit: shapes registry reader maps baked snake-case -> runtime camel, and resolves
// unknown ids to a safe grid fallback so a missing/garbled registry never blocks play.

import { describe, it, expect, vi, afterEach } from "vitest";
import { loadShapes, shapeOf } from "../../src/lib/shapes";

afterEach(() => vi.restoreAllMocks());

describe("shapeOf", () => {
  it("falls back to grid for an unknown shapeId", () => {
    const s = shapeOf({}, "round-table");
    expect(s.topology).toBe("matrix");
    expect(s.glyph).toBe("abstract.grid");
  });
});

describe("loadShapes", () => {
  it("maps snake-case registry fields to camel runtime defs", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            "seating-row": { topology: "linear", ordinal_axis: true, max_entities: 6, slot_rules: ["eq", "ends"], glyph: "abstract.seating", v: 1 },
          }),
      } as Response),
    );
    const reg = await loadShapes();
    expect(reg["seating-row"].ordinalAxis).toBe(true);
    expect(reg["seating-row"].topology).toBe("linear");
    expect(reg["seating-row"].slotRules).toEqual(["eq", "ends"]);
  });

  it("fails soft to grid when the registry is absent", async () => {
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: false } as Response));
    const reg = await loadShapes();
    expect(Object.keys(reg)).toEqual(["grid"]);
  });
});
