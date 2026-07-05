// Ambient shell timing applier. The whole-app background is a fixed, composited two-layer
// aurora: layer A (body::before) slowly transform-drifts; layer B (html::before) warm-tinted
// and opacity cross-fades so the palette appears to shift imperceptibly ("a minute or two to
// notice"). The keyframes live in app.css (static); only the DURATIONS + cross-fade depth come
// from config/ui.json [ambient] (no hardcoding, CLAUDE.md #6), written here as CSS custom
// properties on :root - exactly the token-injection pattern of lib/theme.ts + lib/motion.ts.
// Pure ambientVars() is unit-tested; applyAmbient() touches the DOM behind a guard (node tests
// have no document). reduced-motion zeroes animation-duration in app.css, so this is a free
// no-op there. See docs/concepts/ui-shell.md and config/ui.json.

import { ambientUi, type UiConfig } from "./config";

/** The CSS custom properties that drive the ambient shell, formatted from config numbers.
 *  --ambient-drift-s / --ambient-shift-s carry seconds; --ambient-shift-depth is a unitless
 *  0..1 opacity ceiling for the cross-fade layer. Pure - no DOM. */
export function ambientVars(ui: UiConfig): Record<string, string> {
  const a = ambientUi(ui);
  return {
    "--ambient-drift-s": `${a.driftSeconds}s`,
    "--ambient-shift-s": `${a.shiftSeconds}s`,
    "--ambient-shift-depth": `${a.shiftDepth}`,
  };
}

/** Write the ambient custom properties onto <html>; no-op without a document (tests). */
export function applyAmbient(ui: UiConfig): void {
  const el = globalThis.document?.documentElement;
  if (!el) return;
  const vars = ambientVars(ui);
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
}
