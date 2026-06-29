// Save read/write path - the only migrating surface (schemas.md sec 5.3). Pure
// (no $state) so it is unit-testable; runes wrap it elsewhere. Read: parse ->
// fresh-on-throw -> version<1 migrate chain -> validate (drop bad day, keep
// hero/streak) -> caller. Write: prune oldest under QuotaExceededError, today
// never pruned. ASCII, no game logic.

import type { Save, DayState, Tier, ShapeId, DayStatus } from "../contracts/save";

const SAVE_KEY = "yen-cinthanai/save";
const TARGET_VERSION = 1;

const TIERS: readonly Tier[] = ["easy", "standard", "sharp", "expert"];
const SHAPES: readonly ShapeId[] = ["grid", "seating-row"];
const STATUSES: readonly DayStatus[] = ["unplayed", "playing", "won", "lost"];

export function freshSave(): Save {
  return {
    schemaVersion: 1,
    days: {},
    hero: { bestMs: 0, date: "" },
    streak: { count: 0, lastDate: "", skipsLeft: 1 },
    settings: {
      sound: false,
      volume: 0,
      theme: "household",
      palette: "default",
      reducedMotion: false,
    },
  };
}

/** v0 (pre-versioned) -> v1. No-op shape today; the chain proves the seam. */
function migrateV0toV1(raw: Record<string, unknown>): Record<string, unknown> {
  return { ...raw, schemaVersion: 1 };
}

/** Run the migrate chain until schemaVersion reaches TARGET_VERSION. */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let cur = raw;
  let v = typeof cur.schemaVersion === "number" ? cur.schemaVersion : 0;
  while (v < TARGET_VERSION) {
    if (v < 1) cur = migrateV0toV1(cur);
    v = typeof cur.schemaVersion === "number" ? cur.schemaVersion : v + 1;
  }
  return cur;
}

function isDay(d: unknown): d is DayState {
  if (typeof d !== "object" || d === null) return false;
  const o = d as Record<string, unknown>;
  return (
    typeof o.date === "string" &&
    TIERS.includes(o.tier as Tier) &&
    SHAPES.includes(o.shapeId as ShapeId) &&
    STATUSES.includes(o.status as DayStatus) &&
    typeof o.placements === "object" &&
    o.placements !== null &&
    typeof o.attempts === "number" &&
    typeof o.solveMs === "number" &&
    typeof o.hintsUsed === "number" &&
    typeof o.stars === "number"
  );
}

/** Validate: drop malformed days; hero/streak/settings survive (fall back fresh). */
export function validateSave(raw: Record<string, unknown>): Save {
  const base = freshSave();
  const days: Record<string, DayState> = {};
  const rawDays = (raw.days ?? {}) as Record<string, unknown>;
  for (const [date, d] of Object.entries(rawDays)) if (isDay(d)) days[date] = d;
  return {
    schemaVersion: 1,
    days,
    hero: { ...base.hero, ...(raw.hero as object) },
    streak: { ...base.streak, ...(raw.streak as object) },
    settings: { ...base.settings, ...(raw.settings as object) },
  };
}

export function loadSave(): Save {
  try {
    const raw = globalThis.localStorage?.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    return validateSave(migrate(JSON.parse(raw) as Record<string, unknown>));
  } catch {
    return freshSave();
  }
}

/** Drop the oldest day != today; today is never pruned. Returns true if pruned. */
function pruneOldest(save: Save, today: string): boolean {
  const dates = Object.keys(save.days)
    .filter((d) => d !== today)
    .sort();
  if (dates.length === 0) return false;
  delete save.days[dates[0]];
  return true;
}

function isQuota(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

export function persistSave(save: Save, today: string): void {
  while (true) {
    try {
      globalThis.localStorage?.setItem(SAVE_KEY, JSON.stringify(save));
      return;
    } catch (e) {
      if (!isQuota(e) || !pruneOldest(save, today)) return;
    }
  }
}
