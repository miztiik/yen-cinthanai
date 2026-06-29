// Save load/save stub (P0). Full read path (migrate chain, validate, prune) lands
// P4 per docs/architecture/contracts/schemas.md. P0 returns a fresh default and
// round-trips it to localStorage; no migration logic yet.

import type { Save } from "../contracts/save";

const SAVE_KEY = "yen-cinthanai/save";

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

export function loadSave(): Save {
  try {
    const raw = globalThis.localStorage?.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    return JSON.parse(raw) as Save;
  } catch {
    return freshSave();
  }
}

export function persistSave(save: Save): void {
  try {
    globalThis.localStorage?.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // P4 handles QuotaExceededError prune; P0 ignores.
  }
}
