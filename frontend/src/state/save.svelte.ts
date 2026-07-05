// Save read/write path - the only migrating surface (schemas.md sec 5.3). Pure
// (no $state) so it is unit-testable; runes wrap it elsewhere. Read: parse ->
// fresh-on-throw -> version<1 migrate chain -> validate (drop bad day, keep
// hero/streak) -> caller. Write: prune oldest under QuotaExceededError, today
// never pruned. ASCII, no game logic.

import type { Save, DayState, Tier, ShapeId, DayStatus, Settings } from "../contracts/save";
import { updateHero, updateStreak } from "../lib/scoring";

const SAVE_KEY = "yen-cinthanai/save";
const TARGET_VERSION = 1;

const TIERS: readonly Tier[] = ["easy", "standard", "sharp", "expert"];
const SHAPES: readonly ShapeId[] = ["grid", "seating-row", "round-table"];
const STATUSES: readonly DayStatus[] = ["unplayed", "playing", "won", "lost"];

/** Composite day-slot key: one slot per (date, tier, shape) so multiple tiers/shapes
 *  the same calendar day coexist instead of overwriting one slot. Older date-only saves
 *  normalize to this on read (validateSave), so schemaVersion stays 1 (backward compat). */
export function dayKey(date: string, tier: Tier, shapeId: ShapeId): string {
  return `${date}|${tier}|${shapeId}`;
}

export function freshSave(): Save {
  return {
    schemaVersion: 1,
    days: {},
    hero: { bestMs: 0, date: "" },
    streak: { count: 0, lastDate: "", skipsLeft: 1 },
    settings: {
      sound: false,
      volume: 0,
      theme: "light",
      palette: "hearth",
      reducedMotion: false,
      puckSize: "medium",
      display: { color: true, glyphs: true, labels: true },
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

const isStringArray = (v: unknown): boolean => Array.isArray(v) && v.every((x) => typeof x === "string");

/** A notes block is valid when every present field is a string[]; absent is fine (older
 *  save). A malformed notes fails the day so it is dropped rather than half-loaded. */
function isNotes(n: unknown): boolean {
  if (n === undefined) return true;
  if (typeof n !== "object" || n === null) return false;
  const o = n as Record<string, unknown>;
  return (
    (o.manualX === undefined || isStringArray(o.manualX)) &&
    (o.scratchTicks === undefined || isStringArray(o.scratchTicks)) &&
    (o.struckClues === undefined || isStringArray(o.struckClues))
  );
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
    typeof o.stars === "number" &&
    isNotes(o.notes)
  );
}

/** Merge stored settings over defaults; the nested display object is deep-merged (so an older
 *  save without it - or a partial one - still yields a full display) and clamped to the
 *  invariant that at least one of glyphs/labels stays on. */
function mergeSettings(base: Settings, raw: unknown): Settings {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<Settings>;
  const display = { ...base.display, ...(r.display ?? {}) };
  if (!display.glyphs && !display.labels) display.labels = true;
  return { ...base, ...r, display };
}

/** Validate: drop malformed days; hero/streak/settings survive (fall back fresh). */
export function validateSave(raw: Record<string, unknown>): Save {
  const base = freshSave();
  const days: Record<string, DayState> = {};
  const rawDays = (raw.days ?? {}) as Record<string, unknown>;
  // Rebuild keyed by dayKey DERIVED from each day's own fields (never trust the incoming
  // map key), so an older date-only save normalizes transparently to the composite key.
  for (const d of Object.values(rawDays)) if (isDay(d)) days[dayKey(d.date, d.tier, d.shapeId)] = d;
  return {
    schemaVersion: 1,
    days,
    hero: { ...base.hero, ...(raw.hero as object) },
    streak: { ...base.streak, ...(raw.streak as object) },
    settings: mergeSettings(base.settings, raw.settings),
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

/** Drop the oldest slot whose DATE portion != today; today is never pruned. Keys are
 *  composite (date|tier|shape); the date prefix orders chronologically. Returns true if pruned. */
function pruneOldest(save: Save, today: string): boolean {
  const keys = Object.keys(save.days)
    .filter((k) => k.split("|")[0] !== today)
    .sort((a, b) => a.split("|")[0].localeCompare(b.split("|")[0]));
  if (keys.length === 0) return false;
  delete save.days[keys[0]];
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

/** On a fresh win, advance the streak once and set best-time only on a clean solve. */
export function recordWin(save: Save, day: DayState): Save {
  if (save.streak.lastDate === day.date) return save; // already counted today
  save.streak = updateStreak(save.streak, day.date);
  save.hero = updateHero(save.hero, day.solveMs, day.hintsUsed, day.date);
  return save;
}

/** Merge a settings patch and persist (today never pruned). Returns the new save. */
export function updateSettings(patch: Partial<Settings>, today: string): Save {
  const save = loadSave();
  save.settings = { ...save.settings, ...patch };
  persistSave(save, today);
  return save;
}
