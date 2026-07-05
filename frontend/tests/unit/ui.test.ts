import { describe, it, expect } from "vitest";
import { puckPreset, tierRank, tierColor, difficultyUi, type UiConfig } from "../../src/lib/config";

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
