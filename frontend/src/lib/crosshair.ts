// Grid crosshair wash applier. The hover/focus crosshair (NotesGrid) washes the active
// cell's whole row + column and its two axis headers so the player sees which pairing a cell
// asserts. The WASH itself is painted in app.css from the --ink token (so it follows a theme
// swap); only the INTENSITY (percent of --ink) comes from config/ui.json [grid.crosshair] (no
// hardcoding, CLAUDE.md #6), written here as CSS custom properties on :root - exactly the
// token-injection pattern of lib/ambient.ts + lib/theme.ts. Pure crosshairVars() is
// unit-tested; applyCrosshair() touches the DOM behind a guard (node tests have no document).
// See docs/concepts/ui-shell.md and config/ui.json.

import { gridCrosshair, type UiConfig } from "./config";

/** The CSS custom properties that drive the crosshair wash, formatted from config numbers.
 *  --grid-crosshair-pct / --grid-crosshair-hdr-pct carry a percent of --ink for the cell /
 *  header wash. Pure - no DOM. */
export function crosshairVars(ui: UiConfig): Record<string, string> {
  const c = gridCrosshair(ui);
  return {
    "--grid-crosshair-pct": `${c.cell}%`,
    "--grid-crosshair-hdr-pct": `${c.header}%`,
  };
}

/** Write the crosshair custom properties onto <html>; no-op without a document (tests). */
export function applyCrosshair(ui: UiConfig): void {
  const el = globalThis.document?.documentElement;
  if (!el) return;
  const vars = crosshairVars(ui);
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
}
