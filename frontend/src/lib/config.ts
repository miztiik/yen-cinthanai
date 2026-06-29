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
}
export interface Pace {
  idle_pulse_s: number;
  idle_glow_s: number;
  stats_window: number;
}

const PACE_FALLBACK: Pace = { idle_pulse_s: 12, idle_glow_s: 25, stats_window: 10 };

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

/** Pick one line from a bag; empty bag yields "". */
export function pick(bag: string[]): string {
  return bag.length ? bag[Math.floor(Math.random() * bag.length)] : "";
}
