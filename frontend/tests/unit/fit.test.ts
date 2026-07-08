// Unit: desktop grid-fit sizing. fitCellSize is pure (Board measures the grid column via a
// ResizeObserver and passes the width); maxCell 0 = uncapped, so the grid fills any monitor.
// See lib/fit.ts, config/ui.json [grid.desktop], docs/concepts/ui-shell.md.

import { describe, it, expect } from "vitest";
import { fitCellSize, type FitCfg } from "../../src/lib/fit";

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
