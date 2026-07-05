import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBoard } from "../../src/lib/board";
import {
  blockCells,
  blockId,
  cellKey,
  cellState,
  endpointKey,
  glyphComplete,
  axisGlyphs,
  gridBlocks,
  gridCategories,
  impliedX,
  mergeGridPlacements,
  parseCellKey,
  staircase,
  type GridEndpoint,
} from "../../src/lib/grid";
import { nearestCentre, magnetTranslate, type CellCentre } from "../../src/lib/drag";
import type { PuzzleManifest } from "../../src/contracts/manifest";
import type { AttributeCategory } from "../../src/contracts/manifest";
import type { Placements } from "../../src/contracts/save";

// Real fixture: 3 bijective categories (drink, animal, position); position is ordinal so
// board.ts anchors on it. The grid then covers all 3 (Row 7 is bijective-only).
const here = fileURLToPath(new URL(".", import.meta.url));
const m = JSON.parse(readFileSync(resolve(here, "../fixtures/manifest-4x3.json"), "utf8")) as PuzzleManifest;
const board = buildBoard(m);

const ep = (cat: string, val: string): GridEndpoint => ({ cat, val });
const K = (a: GridEndpoint, b: GridEndpoint) => cellKey(a, b);

describe("axisGlyphs (display glyphs toggle over the no-mix gate)", () => {
  const cat: AttributeCategory = {
    id: "animal",
    label: "Animal",
    kind: "nominal",
    anchor: false,
    cardinality: "bijective",
    values: [
      { id: "cat", glyph: "animals.cat", label: "Cat" },
      { id: "dog", glyph: "animals.dog", label: "Dog" },
    ],
  };
  const allArt = () => true;
  const missingArt = (ref: string) => ref !== "animals.dog";

  it("glyphs on + full art coverage -> glyphs", () => {
    expect(axisGlyphs(true, cat, allArt)).toBe(true);
  });
  it("glyphs on + missing art -> text (no mix)", () => {
    expect(axisGlyphs(true, cat, missingArt)).toBe(false);
  });
  it("glyphs off -> text even when art is complete", () => {
    expect(axisGlyphs(false, cat, allArt)).toBe(false);
  });
});

describe("cell keys + blocks", () => {
  it("normalizes a cell key so axis order does not matter", () => {
    expect(K(ep("drink", "tea"), ep("animal", "cat"))).toBe(K(ep("animal", "cat"), ep("drink", "tea")));
  });

  it("round-trips a key back to its two endpoints", () => {
    const [p, q] = parseCellKey(K(ep("drink", "tea"), ep("animal", "cat")));
    expect(new Set([endpointKey(p), endpointKey(q)])).toEqual(new Set(["drink:tea", "animal:cat"]));
  });

  it("enumerates a block per bijective category pair", () => {
    expect(gridCategories(board).map((c) => c.id)).toEqual(["position", "drink", "animal"]);
    expect(gridBlocks(gridCategories(board))).toHaveLength(3); // C(3,2)
  });

  it("fills a block with rowValues x colValues cells", () => {
    const block = gridBlocks(gridCategories(board)).find((b) => b.id === blockId("drink", "animal"))!;
    expect(blockCells(block)).toHaveLength(16); // 4 x 4
  });
});

describe("cellState recompute (auto-X derived, never auto-tick)", () => {
  const tick = K(ep("drink", "tea"), ep("animal", "cat"));
  const ticks = new Set([tick]);
  const none = new Set<string>();

  it("marks the dropped cell a tick", () => {
    expect(cellState(tick, ticks, none)).toBe("tick");
  });

  it("auto-Xs the rest of the tick's row and column, within the block only", () => {
    expect(cellState(K(ep("drink", "tea"), ep("animal", "dog")), ticks, none)).toBe("autoX"); // same row
    expect(cellState(K(ep("drink", "coffee"), ep("animal", "cat")), ticks, none)).toBe("autoX"); // same col
    expect(cellState(K(ep("drink", "coffee"), ep("animal", "dog")), ticks, none)).toBe("blank"); // neither
  });

  it("never auto-Xs across blocks (a tick sharing an endpoint in another block)", () => {
    const cross = new Set([K(ep("position", "p0"), ep("drink", "tea"))]); // (position x drink) block
    expect(impliedX(K(ep("drink", "tea"), ep("animal", "dog")), cross)).toBe(false);
  });

  it("keeps a manual-X even where an auto-X would apply (manual-X survives)", () => {
    const struck = K(ep("drink", "coffee"), ep("animal", "cat")); // in the auto-X column
    const manualX = new Set([struck]);
    expect(cellState(struck, ticks, manualX)).toBe("manualX"); // priority over autoX
  });

  it("reverts only the auto-X when the tick is removed; the manual-X remains", () => {
    const struck = K(ep("drink", "coffee"), ep("animal", "cat"));
    const manualX = new Set([struck]);
    const cleared = new Set<string>(); // tick removed
    expect(cellState(K(ep("drink", "tea"), ep("animal", "dog")), cleared, manualX)).toBe("blank"); // auto-X gone
    expect(cellState(struck, cleared, manualX)).toBe("manualX"); // manual-X intact
  });
});

describe("mergeGridPlacements (grid ticks -> placements for the win)", () => {
  it("projects an anchor-naming tick onto the right entity", () => {
    const ticks = new Set([K(ep("position", "p0"), ep("drink", "tea"))]);
    expect(mergeGridPlacements(board, {}, ticks).e0.drink).toBe("tea"); // p0 -> entity e0
  });

  it("leaves a cross-block tick as scratch (no entity, not merged)", () => {
    const ticks = new Set([K(ep("drink", "tea"), ep("animal", "cat"))]);
    expect(mergeGridPlacements(board, {}, ticks)).toEqual({});
  });

  it("keeps an existing token placement (token board takes precedence)", () => {
    const pre: Placements = { e0: { drink: "coffee" } };
    const ticks = new Set([K(ep("position", "p0"), ep("drink", "tea"))]);
    expect(mergeGridPlacements(board, pre, ticks).e0.drink).toBe("coffee");
  });

  it("does not mutate the input placements", () => {
    const pre: Placements = { e1: { drink: "milk" } };
    mergeGridPlacements(board, pre, new Set([K(ep("position", "p0"), ep("drink", "tea"))]));
    expect(pre).toEqual({ e1: { drink: "milk" } });
  });
});

describe("magnet targeting for grid cells", () => {
  const cc = (key: string, cx: number, cy: number): CellCentre => ({ key, block: "b", cx, cy, el: {} as HTMLElement });
  const centres = [cc("k0", 0, 0), cc("k1", 100, 0), cc("k2", 200, 0)];

  it("captures the nearest cell centre within radius and resolves its key", () => {
    expect(nearestCentre(90, 0, centres, 30)?.key).toBe("k1");
  });

  it("returns null when no cell centre is within radius", () => {
    expect(nearestCentre(50, 0, centres, 30)).toBeNull();
  });

  it("eases the drag toward the captured cell centre", () => {
    expect(magnetTranslate(40, 0, 0, 0, { cx: 100, cy: 0 }, 0.5)).toEqual({ tx: 70, ty: 0 });
  });
});

describe("staircase (fused logic-grid layout)", () => {
  const cats = gridCategories(board); // 3 bijective categories (the printed-grid case)

  it("puts the anchor row across every column, then steps down", () => {
    const s = staircase(cats);
    expect(s.cols).toHaveLength(cats.length - 1);
    expect(s.rows).toHaveLength(cats.length - 1);
    expect(s.present[0].every((p) => p)).toBe(true); // anchor row pairs with every column
    const cells = s.present.flat().filter(Boolean).length;
    expect(cells).toBe(gridBlocks(cats).length); // one present block per unordered pair
  });

  it("leaves the self-pair corner blank (bottom-right of the 3-cat staircase)", () => {
    const s = staircase(cats);
    expect(s.present[1][s.cols.length - 1]).toBe(false);
  });

  it("renders nothing below two categories", () => {
    expect(staircase(cats.slice(0, 1))).toEqual({ cols: [], rows: [], present: [] });
  });
});

describe("glyphComplete (no-mix render gate)", () => {
  const cat = (glyphs: (string | undefined)[]): AttributeCategory => ({
    id: "c",
    label: "C",
    kind: "nominal",
    anchor: false,
    cardinality: "bijective",
    values: glyphs.map((g, i) => ({ id: `v${i}`, glyph: g ?? "", label: `v${i}` })),
  });
  const exists = (ref: string) => ref === "flowers.rose" || ref === "flowers.tulips";

  it("is complete only when every value resolves to an existing image", () => {
    expect(glyphComplete(cat(["flowers.rose", "flowers.tulips"]), exists)).toBe(true);
  });

  it("is incomplete when any value has no glyph (a mix -> whole axis falls back to text)", () => {
    expect(glyphComplete(cat(["flowers.rose", ""]), exists)).toBe(false);
  });

  it("is incomplete when a glyph ref has no image file", () => {
    expect(glyphComplete(cat(["flowers.rose", "flowers.poppies"]), exists)).toBe(false);
  });

  it("is incomplete for an empty category", () => {
    expect(glyphComplete(cat([]), exists)).toBe(false);
  });
});
