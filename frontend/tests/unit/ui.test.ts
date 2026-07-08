import { describe, it, expect } from "vitest";
import { puckPreset, tierRank, tierColor, difficultyUi, chromeUi, gridCrosshair, gridDesktop, layoutUi, type UiConfig } from "../../src/lib/config";

// Puck sizing is config-driven (config/ui.toml). The resolver maps the player's size
// setting to a preset and falls back to the config default for anything unknown.
const ui: UiConfig = {
  puck: {
    default: "medium",
    small: { diameter: 40, glyph: 0.6 },
    medium: { diameter: 52, glyph: 0.64 },
    large: { diameter: 64, glyph: 0.66 },
  },
  snap: { radius_factor: 1.4, ease: 0.55 },
};

describe("puckPreset", () => {
  it("resolves each of the three named sizes", () => {
    expect(puckPreset(ui, "small").diameter).toBe(40);
    expect(puckPreset(ui, "medium").diameter).toBe(52);
    expect(puckPreset(ui, "large").diameter).toBe(64);
  });

  it("falls back to the config default for an unknown size", () => {
    expect(puckPreset(ui, "huge")).toEqual(ui.puck.medium);
  });
});

// Difficulty (tier meter) is config-driven: order gives the ascending-bar rank, colors gives
// the per-tier fill token. Both fail soft to the built-in default when config omits them.
describe("difficulty tier meter config", () => {
  const withDiff: UiConfig = {
    ...ui,
    difficulty: {
      order: ["easy", "standard", "sharp", "expert"],
      colors: { easy: "#22c55e", standard: "#eab308", sharp: "#f97316", expert: "#ef4444" },
    },
  };
  it("ranks a tier by its 1-based position in order (0 when unknown)", () => {
    expect(tierRank(withDiff, "easy")).toBe(1);
    expect(tierRank(withDiff, "expert")).toBe(4);
    expect(tierRank(withDiff, "nope")).toBe(0);
  });
  it("maps a tier to its standardized fill colour, fail-soft to the accent token", () => {
    expect(tierColor(withDiff, "sharp")).toBe("#f97316");
    expect(tierColor(withDiff, "nope")).toBe("var(--accent)");
  });
  it("falls back to the built-in difficulty when config omits it", () => {
    expect(difficultyUi(ui).order).toContain("expert");
    expect(tierRank(ui, "standard")).toBe(2);
  });
});

// Chrome micro-interaction tunables (config/ui.json [chrome]) are config-driven and fail soft
// to the built-in default (350ms) when config omits the block.
describe("chrome config", () => {
  it("reads the tooltip hover delay from config", () => {
    const withChrome: UiConfig = { ...ui, chrome: { tooltipDelayMs: 500 } };
    expect(chromeUi(withChrome).tooltipDelayMs).toBe(500);
  });
  it("falls back to the built-in chrome delay when config omits it", () => {
    expect(chromeUi(ui).tooltipDelayMs).toBe(350);
  });
  it("carries the attempt-ring urgency ramp (full/mid/low), fail-soft to the standardized ramp", () => {
    const withRamp: UiConfig = { ...ui, chrome: { tooltipDelayMs: 350, attemptColors: { full: "#0f0", mid: "#fa0", low: "#f00" } } };
    expect(chromeUi(withRamp).attemptColors).toEqual({ full: "#0f0", mid: "#fa0", low: "#f00" });
    expect(chromeUi(ui).attemptColors).toEqual({ full: "#22c55e", mid: "#f59e0b", low: "#ef4444" });
  });
});

// Grid crosshair wash intensity (config/ui.json [grid.crosshair]) is config-driven and fail
// soft to the built-in default {cell:12, header:18} when the grid block omits it.
describe("grid crosshair config", () => {
  it("reads the cell + header wash intensity from config", () => {
    const withCross: UiConfig = { ...ui, grid: { cell: { small: 34, medium: 40, large: 48 }, snap: { ease: 0.6, radius_factor: 0.9 }, crosshair: { cell: 8, header: 22 } } };
    expect(gridCrosshair(withCross)).toEqual({ cell: 8, header: 22 });
  });
  it("falls back to the built-in intensity when config omits it", () => {
    expect(gridCrosshair(ui)).toEqual({ cell: 12, header: 18 });
  });
});

// Desktop grid growth + board width (config/ui.json [grid.desktop], [layout]) are config-driven
// and fail soft to the built-in UNCAPPED defaults (maxCell 0, maxWidthPx 0).
describe("grid desktop + layout config", () => {
  it("reads the desktop growth params, fail-soft to the built-in (uncapped) defaults", () => {
    const withDesktop: UiConfig = { ...ui, grid: { cell: { small: 34, medium: 40, large: 48 }, snap: { ease: 0.6, radius_factor: 0.9 }, desktop: { minCell: 50, maxCell: 120, leadRem: 9, slackPx: 20 } } };
    expect(gridDesktop(withDesktop)).toEqual({ minCell: 50, maxCell: 120, leadRem: 9, slackPx: 20 });
    expect(gridDesktop(ui)).toEqual({ minCell: 44, maxCell: 0, leadRem: 8.75, slackPx: 16 });
  });
  it("reads the board max width, fail-soft to uncapped (0)", () => {
    expect(layoutUi({ ...ui, layout: { maxWidthPx: 1600 } }).maxWidthPx).toBe(1600);
    expect(layoutUi(ui).maxWidthPx).toBe(0);
  });
});
