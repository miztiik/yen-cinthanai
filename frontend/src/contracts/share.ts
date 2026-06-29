// ShareCard v1 - bundle/runtime; built ONLY from DayState stats. NO placements,
// solution, or entity values reach this surface (shape-agnostic, spoiler-safe).
// share-noleak contract test asserts no leak. See schemas.md, sec 5.5.

import type { DayState, Tier, DayStatus, Streak } from "./save";

export interface ShareCard {
  schemaVersion: 1;
  date: string;
  tier: Tier;
  shapeGlyph: string;
  status: DayStatus;
  moves: number;
  wrong: number;
  solveMs: number;
  hintsUsed: number;
  streak: number;
}

/** Count committed cells without exposing any value (a stat, never a placement). */
function moveCount(day: DayState): number {
  let n = 0;
  for (const cats of Object.values(day.placements)) n += Object.keys(cats).length;
  return n;
}

/** Build a ShareCard from stats only. shapeGlyph is a glyph ref, not a layout. */
export function buildShareCard(day: DayState, streak: Streak, shapeGlyph: string): ShareCard {
  return {
    schemaVersion: 1,
    date: day.date,
    tier: day.tier,
    shapeGlyph,
    status: day.status,
    moves: moveCount(day),
    wrong: day.attempts,
    solveMs: day.solveMs,
    hintsUsed: day.hintsUsed,
    streak: streak.count,
  };
}
