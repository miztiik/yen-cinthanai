// Runtime config reader: pull the baked tiers + copy JSON, base-aware. These come
// from config/*.toml via tools/bake_config.py (no hardcoded balance, CLAUDE.md #6).
// Caps, par, and celebration text all flow from here. Fail-soft to empty so a missing
// optional file never blocks play. See docs/concepts/difficulty-and-scoring.md.

const BASE = import.meta.env.BASE_URL;

export type Feedback = "realtime-names" | "count-wrong" | "binary-check" | "submit-binary";

export interface TierDial {
  par_s: number;
  hints: number;
  attempts: number;
  feedback: Feedback;
}
export interface CopyBags {
  success: string[];
  encourage: string[];
  hero: string[];
  share?: { title: string; line: string; streak: string };
  credits?: { intro: string; license: string };
  clues?: CluesCopy;
  grid?: GridCopy;
}

/** Chrome copy for the story-first clue list (config/copy.json [clues]). `{n}` = number. */
export interface CluesCopy {
  heading: string;
  show: string;
  hide: string;
  strike: string;
  unstrike: string;
  struck: string;
  restored: string;
}

/** Fail-soft clue chrome so a missing copy.json never blanks the labels. */
export const CLUES_COPY_FALLBACK: CluesCopy = {
  heading: "Clues",
  show: "Clues",
  hide: "Hide clues",
  strike: "Cross out clue {n}",
  unstrike: "Restore clue {n}",
  struck: "Clue {n} crossed out",
  restored: "Clue {n} restored",
};

/** Chrome copy for the cross-out grid (config/copy.json [grid]). `{row}`/`{col}` = the two
 *  endpoint labels, `{state}` = the resolved state word. */
export interface GridCopy {
  heading: string;
  mapHeading: string;
  state: { blank: string; manualX: string; autoX: string; tick: string };
  cell: string;
  cross: string;
  prevBlock: string;
  nextBlock: string;
  openBlock: string;
}

/** Fail-soft grid chrome so a missing copy.json never blanks the cell labels. */
export const GRID_COPY_FALLBACK: GridCopy = {
  heading: "Grid",
  mapHeading: "All blocks",
  state: { blank: "unmarked", manualX: "crossed out", autoX: "eliminated", tick: "matched" },
  cell: "{row} and {col}: {state}",
  cross: "Cross out {row} and {col}",
  prevBlock: "Previous block",
  nextBlock: "Next block",
  openBlock: "Open {row} vs {col}",
};
export interface Pace {
  idle_pulse_s: number;
  idle_glow_s: number;
  stats_window: number;
}

/** A palette's token values for one scheme: token name -> CSS colour. */
export type TokenSet = Record<string, string>;
export interface PaletteSet {
  label: string;
  light: TokenSet;
  dark: TokenSet;
}
export interface Palettes {
  default: string;
  themes: string[]; // theme modes: light | dark | system
  tokens: string[]; // ordered token names (bg, surface, ink, ...)
  palette: Record<string, PaletteSet>;
}

const PACE_FALLBACK: Pace = { idle_pulse_s: 12, idle_glow_s: 25, stats_window: 10 };

const PALETTES_FALLBACK: Palettes = {
  default: "midnight",
  themes: ["light", "dark", "system"],
  tokens: ["bg", "surface", "ink", "accent", "satisfy", "violate", "near", "gold"],
  palette: {},
};

async function fetchJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${BASE}config/${file}`, { cache: "no-cache" });
    return res.ok ? ((await res.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function loadTiers(): Promise<Record<string, TierDial>> {
  return fetchJson("tiers.json", {});
}

export async function loadCopy(): Promise<CopyBags> {
  return fetchJson("copy.json", { success: [], encourage: [], hero: [] });
}

/** Stuck-moment pacing + stats window (config/retention.toml [pace]). Fail-soft. */
export async function loadPace(): Promise<Pace> {
  const r = await fetchJson<{ pace?: Pace }>("retention.json", { pace: PACE_FALLBACK });
  return r.pace ?? PACE_FALLBACK;
}

/** Theme palettes (config/palettes.toml). Fail-soft to an empty palette map so the
 *  app.css bootstrap fallback keeps rendering when the JSON is missing. */
export async function loadPalettes(): Promise<Palettes> {
  return fetchJson("palettes.json", PALETTES_FALLBACK);
}

// --- Puck sizing + drag magnet (config/ui.toml) ---------------------------------

export type PuckSize = "small" | "medium" | "large";
export interface PuckPreset {
  diameter: number; // the circle edge, in px
  glyph: number; // inner glyph as a fraction of the diameter (safe-area inset)
}
/** Clue-list behaviour tunables (config/ui.json [clue]). Which feedback dials may
 *  auto-dim a satisfied clue - the soft dials only, so harder tiers never leak. */
export interface ClueUi {
  autoDimFeedback: Feedback[];
}
/** Cross-out grid tunables (config/ui.json [grid]): square cell edge per puck size + the
 *  cell magnet (capture radius scales with the cell edge). */
export interface GridUi {
  cell: { small: number; medium: number; large: number };
  snap: { radius_factor: number; ease: number };
}
export interface UiConfig {
  puck: { default: PuckSize; small: PuckPreset; medium: PuckPreset; large: PuckPreset };
  snap: { radius_factor: number; ease: number };
  clue?: ClueUi;
  grid?: GridUi;
}

/** Soft-feedback fallback: easy (realtime-names) + standard (count-wrong) auto-dim. */
const SOFT_FEEDBACK_FALLBACK: Feedback[] = ["realtime-names", "count-wrong"];

/** Fail-soft cross-out grid sizing + magnet. */
const GRID_UI_FALLBACK: GridUi = {
  cell: { small: 34, medium: 40, large: 48 },
  snap: { radius_factor: 0.9, ease: 0.6 },
};

const UI_FALLBACK: UiConfig = {
  puck: {
    default: "medium",
    small: { diameter: 46, glyph: 0.6 },
    medium: { diameter: 60, glyph: 0.64 },
    large: { diameter: 74, glyph: 0.66 },
  },
  snap: { radius_factor: 1.4, ease: 0.55 },
  clue: { autoDimFeedback: SOFT_FEEDBACK_FALLBACK },
  grid: GRID_UI_FALLBACK,
};

/** Puck sizing + drag-magnet tunables (config/ui.toml). Fail-soft to bootstrap sizes. */
export async function loadUi(): Promise<UiConfig> {
  return fetchJson("ui.json", UI_FALLBACK);
}

/** Resolve a size name to its preset, falling back to the config default. */
export function puckPreset(ui: UiConfig, size: string): PuckPreset {
  if (size === "small" || size === "medium" || size === "large") return ui.puck[size];
  return ui.puck[ui.puck.default];
}

/** The feedback dials that may auto-dim a satisfied clue (config-driven, fail-soft). */
export function softFeedback(ui: UiConfig): Feedback[] {
  return ui.clue?.autoDimFeedback ?? SOFT_FEEDBACK_FALLBACK;
}

/** Cross-out grid tunables (config-driven, fail-soft). */
export function gridUi(ui: UiConfig): GridUi {
  return ui.grid ?? GRID_UI_FALLBACK;
}

/** Square cell edge (px) for the player's puck-size preset. */
export function gridCellPx(ui: UiConfig, size: string): number {
  const g = gridUi(ui);
  return size === "small" || size === "medium" || size === "large" ? g.cell[size] : g.cell.medium;
}

/** Pick one line from a bag; empty bag yields "". */
export function pick(bag: string[]): string {
  return bag.length ? bag[Math.floor(Math.random() * bag.length)] : "";
}
