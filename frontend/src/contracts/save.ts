// Save v1 - the only migrating surface. See docs/architecture/contracts/schemas.md
// and TODO/2026-06-29-system-design.md sec 5.3. Types only; no logic here.

export type Tier = "easy" | "standard" | "sharp" | "expert";
export type ShapeId = "grid" | "seating-row" | "round-table";
export type DayStatus = "unplayed" | "playing" | "won" | "lost";

/** Puck (token/slot circle) size preset; a player setting, scaled from config/ui.toml. */
export type PuckSize = "small" | "medium" | "large";

/** entity id -> category id -> value id. */
export type Placements = Record<string, Record<string, string>>;

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
  days: Record<string, DayState>;
  hero: Hero;
  streak: Streak;
  settings: Settings;
}
