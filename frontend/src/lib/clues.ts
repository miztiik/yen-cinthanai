// Clue-list logic for story-first manifests. TEXT is primary (core-loop.md): a clue is
// a full sentence, numbered, never a glyph. Two dimming signals: a MANUAL strike the
// player toggles (reversible, never required), and an AUTO-DIM on a satisfied clue that
// is GATED by the tier feedback dial so withheld feedback never leaks (only the soft
// dials - realtime-names / count-wrong - may auto-dim; binary-check / submit-binary must
// not). Pure + config-driven (CLAUDE.md #6): the soft-dial set comes from config/ui.json,
// never a hardcoded tier name. No DOM here - the .svelte views are thin over this.

import type { Feedback } from "./config";
import type { Constraint } from "../contracts/manifest";
import type { ClueState } from "./validate";

/** One numbered, full-sentence clue row (order preserved, 1-based number). */
export interface ClueRowData {
  id: string;
  n: number;
  text: string;
}

/** The numbered clue rows for the list, in manifest order (1-based). */
export function clueRows(constraints: Constraint[]): ClueRowData[] {
  return constraints.map((c, i) => ({ id: c.id, n: i + 1, text: c.clueText }));
}

/** Auto-dim is allowed only for the soft feedback dials (config-driven; no tier names). */
export function autoDimAllowed(feedback: Feedback, softFeedback: readonly Feedback[]): boolean {
  return softFeedback.includes(feedback);
}

/** A clue reads as struck when the player struck it, or (soft dial) it is satisfied. */
export function isClueStruck(struck: boolean, autoDim: boolean, state: ClueState): boolean {
  return struck || (autoDim && state === "satisfy");
}
