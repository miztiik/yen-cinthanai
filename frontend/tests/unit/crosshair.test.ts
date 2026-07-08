// Unit: grid crosshair wash vars. crosshairVars is pure (formats config intensities to CSS
// percentages); applyCrosshair touches the DOM behind a guard, so it no-ops in node (no
// document). The wash rules live in app.css and only read these custom properties. See
// lib/crosshair.ts, config/ui.json [grid.crosshair], docs/concepts/ui-shell.md.

import { describe, it, expect } from "vitest";
import { crosshairVars, applyCrosshair } from "../../src/lib/crosshair";
import type { UiConfig } from "../../src/lib/config";

const withCrosshair = {
  grid: { cell: { small: 34, medium: 40, large: 48 }, snap: { ease: 0.6, radius_factor: 0.9 }, crosshair: { cell: 8, header: 22 } },
} as UiConfig;

describe("crosshair", () => {
  it("formats config intensities into CSS custom property percentages", () => {
    expect(crosshairVars(withCrosshair)).toEqual({
      "--grid-crosshair-pct": "8%",
      "--grid-crosshair-hdr-pct": "22%",
    });
  });

  it("falls back to the default intensity when no crosshair block is present", () => {
    const vars = crosshairVars({} as UiConfig);
    expect(vars["--grid-crosshair-pct"]).toBe("12%");
    expect(vars["--grid-crosshair-hdr-pct"]).toBe("18%");
  });

  it("applyCrosshair no-ops without a document", () => {
    expect(() => applyCrosshair(withCrosshair)).not.toThrow();
  });
});
