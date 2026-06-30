// Contract: the baked UI tunables drive puck (token/slot/seat) sizing + the drag magnet.
// The game never hardcodes sizes - it reads config/ui.toml via bake (CLAUDE.md #6). Pins
// the invariants the layout + glyph safe-area depend on so a future size edit can't break
// them silently. See docs/concepts/ui-shell.md and config/ui.toml.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { UiConfig, PuckSize } from "../../src/lib/config";

const here = fileURLToPath(new URL(".", import.meta.url));
const ui = JSON.parse(readFileSync(resolve(here, "../../public/config/ui.json"), "utf8")) as UiConfig;

const SIZES: PuckSize[] = ["small", "medium", "large"];

describe("puck sizing", () => {
  it("ships all three size presets + a valid default", () => {
    for (const s of SIZES) expect(ui.puck[s]).toBeDefined();
    expect(SIZES).toContain(ui.puck.default);
  });

  it("every preset diameter is a positive px size", () => {
    for (const s of SIZES) {
      expect(ui.puck[s].diameter).toBeGreaterThan(0);
      expect(Number.isFinite(ui.puck[s].diameter)).toBe(true);
    }
  });

  it("the glyph stays inside the circle's safe area (fraction < 0.707, never touches the rim)", () => {
    for (const s of SIZES) {
      expect(ui.puck[s].glyph).toBeGreaterThan(0);
      expect(ui.puck[s].glyph).toBeLessThan(0.707);
    }
  });

  it("sizes are ordered small < medium < large", () => {
    expect(ui.puck.small.diameter).toBeLessThan(ui.puck.medium.diameter);
    expect(ui.puck.medium.diameter).toBeLessThan(ui.puck.large.diameter);
  });
});

describe("drag magnet", () => {
  it("captures with a positive radius and eases within 0..1", () => {
    expect(ui.snap.radius_factor).toBeGreaterThan(0);
    expect(ui.snap.ease).toBeGreaterThanOrEqual(0);
    expect(ui.snap.ease).toBeLessThanOrEqual(1);
  });
});
