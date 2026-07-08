// Save v1 - the only migrating surface. See docs/architecture/contracts/schemas.md.
// Types only; no logic here.

export type Tier = "easy" | "standard" | "sharp" | "expert";
export type ShapeId = "grid" | "seating-row" | "round-table";
export type DayStatus = "unplayed" | "playing" | "won" | "lost";

/** Puck (token/slot circle) size preset; a player setting, scaled from config/ui.toml. */
export type PuckSize = "small" | "medium" | "large";

/** How board values render - a display/clarity setting (Settings > Display + the in-puzzle
 *  display sheet). color: use the difficulty/state hues; glyphs: show glyph art; labels: show
 *  text labels. Invariant: at least one of glyphs/labels is true (a value must render). */
export interface DisplaySettings {
  color: boolean;
  glyphs: boolean;
  labels: boolean;
}

/** entity id -> category id -> value id. */
export type Placements = Record<string, Record<string, string>>;

/** Optional grid + clue-strip bookkeeping (Row 7). Endpoint-keyed scratch state, additive
 *  and omitted when empty, so a save without it still loads (schemaVersion stays 1). */
export interface DayNotes {
  manualX?: string[];
  scratchTicks?: string[];
  struckClues?: string[];
  /** Free-text scratch pad (Board right rail / mobile disclosure). Additive-optional and
   *  omitted when empty, so a save without it still loads (schemaVersion stays 1). */
  scratch?: string;
}

export interface DayState {
  date: string;
  tier: Tier;
  shapeId: ShapeId;
  status: DayStatus;
  placements: Placements;
  attempts: number;
  solveMs: number;
  hintsUsed: number;
  stars: number;
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
  /** Display/clarity mode (color, glyphs, labels). Additive-optional: an older save without
   *  it still loads and is defaulted on read (schemaVersion stays 1). */
  display: DisplaySettings;
  /** Last-played difficulty, so PLAY resumes it (first-ever play = easy cold-open).
   *  Additive-optional: an older save without it still loads (schemaVersion stays 1). */
  lastTier?: Tier;
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
