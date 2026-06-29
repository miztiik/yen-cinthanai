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

/** Copy templates for the spoiler-free share string (config/copy.toml [share]). */
export interface ShareCopy {
  title: string;
  line: string;
  streak: string;
}

/** Stars as a fixed-width silhouette - the only "shape" the card shows, never a slot. */
function starBar(stars: number): string {
  const n = Math.max(0, Math.min(3, stars));
  return "*".repeat(n) + ".".repeat(3 - n);
}

/** Round ms to whole seconds for display. */
function secs(ms: number): number {
  return Math.max(0, Math.round(ms / 1000));
}

/**
 * Spoiler-free clipboard text built from a ShareCard + stars: tier, star bar,
 * time, wrong, hints, streak. No value id, placement, or solution can appear -
 * only stats. Mirrors ShareCard's no-leak contract (schemas.md sec 5.5).
 */
export function shareText(card: ShareCard, stars: number, t: ShareCopy): string {
  const fill = (s: string) =>
    s
      .replace("{tier}", card.tier)
      .replace("{stars}", starBar(stars))
      .replace("{time}", String(secs(card.solveMs)))
      .replace("{wrong}", String(card.wrong))
      .replace("{hints}", String(card.hintsUsed))
      .replace("{streak}", String(card.streak));
  return [fill(t.title), fill(t.line), fill(t.streak)].join("\n");
}
