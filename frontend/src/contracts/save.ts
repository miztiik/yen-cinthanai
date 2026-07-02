// Save v1 - the only migrating surface. See docs/architecture/contracts/schemas.md
// and TODO/2026-06-29-system-design.md sec 5.3. Types only; no logic here.

export type Tier = "easy" | "standard" | "sharp" | "expert";
// Matrix-only at v2: a manifest/bank entry is always grid (seating-row/round-table retired).
export type ShapeId = "grid";
// The save surface is the migrating one, so a day persisted before the retirement may still
// carry a legacy shapeId - accepted on read (back-compat) though new days are always grid.
export type SaveShapeId = "grid" | "seating-row" | "round-table";
export type DayStatus = "unplayed" | "playing" | "won" | "lost";

/** Puck (token/slot circle) size preset; a player setting, scaled from config/ui.toml. */
export type PuckSize = "small" | "medium" | "large";

/** entity id -> category id -> value id. */
export type Placements = Record<string, Record<string, string>>;

/** Cross-out grid + clue-strip bookkeeping (Row 7). ADDITIVE + OPTIONAL: older saves
 *  without it still load and schemaVersion stays 1. Keyed by order-normalized semantic
 *  endpoints `catA:valA|catB:valB` (grid.ts cellKey); struckClues holds clue ids. The
 *  positive grid ticks persist here as `scratchTicks`; those that name the anchor also
 *  reconstruct into `placements` at eval time (grid.ts mergeGridPlacements). */
export interface DayNotes {
  manualX?: string[];
  scratchTicks?: string[];
  struckClues?: string[];
}

export interface DayState {
  date: string;
  tier: Tier;
  shapeId: SaveShapeId;
  status: DayStatus;
  placements: Placements;
  attempts: number;
  solveMs: number;
  hintsUsed: number;
  stars: number;
  /** Grid + clue bookkeeping; omitted when empty (backward-compatible). */
  notes?: DayNotes;
}

export interface Hero {
  bestMs: number;
  date: string;
}

export interface Streak {
  count: number;
  lastDate: string;
  skipsLeft: number;
}

export interface Settings {
  sound: boolean;
  volume: number;
  theme: string;
  palette: string;
  reducedMotion: boolean;
  puckSize: PuckSize;
}

export interface Save {
  schemaVersion: 1;
  /** Keyed by dayKey(date, tier, shapeId) = `date|tier|shapeId` (save.svelte). Older
   *  date-only saves normalize to this on read; the value's own fields are the truth. */
  days: Record<string, DayState>;
  hero: Hero;
  streak: Streak;
  settings: Settings;
}
