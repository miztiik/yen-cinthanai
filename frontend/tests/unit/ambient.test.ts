// Unit: ambient shell timing vars. ambientVars is pure (formats config numbers to CSS
// values); applyAmbient touches the DOM behind a guard, so it no-ops in node (no document).
// The keyframes live in app.css and only read these custom properties. See lib/ambient.ts,
// config/ui.json [ambient], docs/concepts/ui-shell.md.

import { describe, it, expect } from "vitest";
import { ambientVars, applyAmbient } from "../../src/lib/ambient";
import type { UiConfig } from "../../src/lib/config";

const withAmbient = { ambient: { driftSeconds: 200, shiftSeconds: 90, shiftDepth: 0.4 } } as UiConfig;

describe("ambient", () => {
  it("formats config numbers into CSS custom property values", () => {
    expect(ambientVars(withAmbient)).toEqual({
      "--ambient-drift-s": "200s",
      "--ambient-shift-s": "90s",
      "--ambient-shift-depth": "0.4",
    });
  });

  it("falls back to the default timing when no ambient block is present", () => {
    const vars = ambientVars({} as UiConfig);
    expect(vars["--ambient-drift-s"]).toBe("240s");
    expect(vars["--ambient-shift-s"]).toBe("150s");
    expect(vars["--ambient-shift-depth"]).toBe("0.55");
  });

  it("applyAmbient no-ops without a document", () => {
    expect(() => applyAmbient(withAmbient)).not.toThrow();
  });
});
