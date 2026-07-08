// Unit: desktop grid-fit sizing. fitCellSize is pure (Board measures the grid column via a
// ResizeObserver and passes the width); maxCell 0 = uncapped, so the grid fills any monitor.
// See lib/fit.ts, config/ui.json [grid.desktop], docs/concepts/ui-shell.md.

import { describe, it, expect } from "vitest";
import { fitCellSize, scaleClamp, type FitCfg } from "../../src/lib/fit";

const cfg: FitCfg = { minCell: 44, maxCell: 0, leadPx: 140, slackPx: 16 };

describe("fitCellSize", () => {
  it("fills the width: floor((width - lead - slack) / leafCount)", () => {
    expect(fitCellSize(1000, 8, cfg)).toBe(105); // (1000 - 156) / 8 = 105.5 -> 105
  });
  it("is UNCAPPED when maxCell is 0 (fills any monitor)", () => {
    expect(fitCellSize(3000, 8, cfg)).toBe(355); // (3000 - 156) / 8 = 355.5 -> 355
  });
  it("honours a positive maxCell cap", () => {
    expect(fitCellSize(3000, 8, { ...cfg, maxCell: 96 })).toBe(96);
  });
  it("floors at minCell on a narrow container (the grid then scrolls, not shrinks)", () => {
    expect(fitCellSize(400, 8, cfg)).toBe(44); // (400 - 156) / 8 = 30.5 -> 30, floored to 44
  });
  it("returns minCell for a non-positive leaf count", () => {
    expect(fitCellSize(1000, 0, cfg)).toBe(44);
  });
});

// scaleClamp: a grid chrome dimension (label font / inter-cell gap) that tracks the cell edge
// so it stays proportional to a grown cell - round(cell * scale) clamped to [min, max].
describe("scaleClamp", () => {
  const label = { scale: 0.15, min: 12, max: 18 };
  it("scales with the cell edge: round(cell * scale)", () => {
    expect(scaleClamp(100, label)).toBe(15); // 100 * 0.15 = 15
    expect(scaleClamp(104, label)).toBe(16); // 104 * 0.15 = 15.6 -> 16
  });
  it("floors at min on a small cell (stays legible)", () => {
    expect(scaleClamp(44, label)).toBe(12); // 44 * 0.15 = 6.6 -> floored to 12
  });
  it("caps at max on a grown cell (never dwarfs the box)", () => {
    expect(scaleClamp(300, label)).toBe(18); // 300 * 0.15 = 45 -> capped to 18
  });
  it("supports a gap config that can floor at a small value", () => {
    const gap = { scale: 0.06, min: 2, max: 7 };
    expect(scaleClamp(44, gap)).toBe(3); // 44 * 0.06 = 2.64 -> 3
    expect(scaleClamp(200, gap)).toBe(7); // 200 * 0.06 = 12 -> capped to 7
  });
});
