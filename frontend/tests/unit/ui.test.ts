import { describe, it, expect } from "vitest";
import { puckPreset, type UiConfig } from "../../src/lib/config";

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
