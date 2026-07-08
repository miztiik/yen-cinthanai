// Private post-win answer reveal: the solved grid as entity -> attribute LABELS. This is
// the only module that reads the solution for display, and it is shown solely on the win
// screen (AnswerSummary.svelte inside the ResultCard flow), never shared - the ShareCard
// stays stats-only (share-noleak.test.ts). Kept out of board.ts so the play board never
// touches the solution. See docs/concepts/ui-shell.md, core-loop.md.

import type { BoardModel } from "./board";
import type { Placements } from "../contracts/save";
import { mergeGridPlacements } from "./grid";

export interface AnswerCell {
  label: string;
  glyph: string; // glyph ref, or "" when the axis has no glyph (story-first text values)
}
export interface AnswerRow {
  head: AnswerCell; // the anchor value = this row's identity
  cells: AnswerCell[]; // fillable columns, in board order
}
export interface AnswerGrid {
  columns: string[]; // fillable category labels (table headers), in board order
  rows: AnswerRow[]; // one per entity, in board order
}

/** Build the solved grid for the private win reveal: each row's identity is the anchor value
 *  (value i -> entity i), and the fillable columns are read from the solution. Only labels and
 *  glyph refs surface - never value ids - so the on-screen reveal reads cleanly. */
export function answerGrid(b: BoardModel, solution: Placements): AnswerGrid {
  const columns = b.columns.map((c) => c.label);
  const rows: AnswerRow[] = b.entities.map((e, i) => {
    const av = b.anchor.values[i];
    const head: AnswerCell = { label: av?.label ?? e, glyph: av?.glyph ?? "" };
    const cells: AnswerCell[] = b.columns.map((c) => {
      const vid = solution[e]?.[c.id];
      const v = vid ? c.values.find((x) => x.id === vid) : undefined;
      return { label: v?.label ?? vid ?? "", glyph: v?.glyph ?? "" };
    });
    return { head, cells };
  });
  return { columns, rows };
}

/** The player's CURRENT deductions in the SAME grid shape, fed ONLY by their committed
 *  placements + grid ticks (via mergeGridPlacements) - NEVER the solution, so the live results
 *  roster can never spoil the puzzle. Undeduced cells come back empty ({label:""}); the partial
 *  AnswerSummary paints those as a muted "-". It reuses answerGrid (one shape, two feeds). */
export function playerGrid(b: BoardModel, placements: Placements, ticks: ReadonlySet<string>): AnswerGrid {
  return answerGrid(b, mergeGridPlacements(b, placements, ticks));
}
