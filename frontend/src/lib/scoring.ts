// Scoring + forgiving streak (difficulty-and-scoring.md). Pure, unit-tested - no
// runes, no IO. Stars: 1 solved, 2 +0 hints, 3 +0 hints +0 wrong + solveMs<=PAR.
// Best-time (hero) ships beside stars but a hinted solve never sets it (brag-cost,
// core-loop.md). Streak (D13): skipsLeft=1, refills each Monday 00:00 UTC; a missed
// day burns a skip and holds, none left resets to 0. ASCII; no hardcoded PAR (config).

import type { TierDial } from "./config";
import type { DayState, Hero, Streak } from "../contracts/save";

const MS_PER_DAY = 86_400_000;

/** PAR in ms from the tier dial (config/tiers.toml). */
export function parMs(dial: TierDial): number {
  return dial.par_s * 1000;
}

/** Stars for a solved day. 1=solved, 2=+0 hints, 3=+0 hints+0 wrong+<=PAR. */
export function computeStars(solveMs: number, hintsUsed: number, wrong: number, dial: TierDial): number {
  if (hintsUsed > 0) return 1;
  if (wrong === 0 && solveMs <= parMs(dial)) return 3;
  return 2;
}

/** Midnight-UTC epoch for a YYYY-MM-DD date. */
function dayEpoch(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Whole days from->to (>=0 forward). 0 if either is missing. */
export function dayGap(from: string, to: string): number {
  if (!from || !to) return 0;
  return Math.round((dayEpoch(to) - dayEpoch(from)) / MS_PER_DAY);
}

/** UTC ISO week index since epoch (Mon=boundary); refill skips on a new week. */
function weekIndex(date: string): number {
  return Math.floor((dayEpoch(date) - dayEpoch("1970-01-05")) / (7 * MS_PER_DAY));
}

/** Best-time only on a clean (0-hint) solve. date stamps which day set it. */
export function updateHero(hero: Hero, solveMs: number, hintsUsed: number, date: string): Hero {
  if (hintsUsed > 0 || solveMs <= 0) return hero;
  if (hero.bestMs > 0 && hero.bestMs <= solveMs) return hero;
  return { bestMs: solveMs, date };
}

/** Did this clean solve set a new record (drives the HERO copy bag)? */
export function isHero(hero: Hero, solveMs: number, hintsUsed: number): boolean {
  return hintsUsed === 0 && solveMs > 0 && (hero.bestMs === 0 || solveMs < hero.bestMs);
}

/** Forgiving streak: gap 0 same day, 1 increment, >1 burn skips else reset. Refill Monday. */
export function updateStreak(streak: Streak, today: string): Streak {
  const refilled = streak.skipsLeft + (weekIndex(today) > weekIndex(streak.lastDate || today) ? 1 : 0);
  const skips = Math.min(refilled, 1); // cap 1/week (config skips_per_week)
  const gap = dayGap(streak.lastDate, today);
  if (!streak.lastDate) return { count: 1, lastDate: today, skipsLeft: skips };
  if (gap === 0) return { count: Math.max(1, streak.count), lastDate: today, skipsLeft: skips };
  if (gap === 1) return { count: streak.count + 1, lastDate: today, skipsLeft: skips };
  const missed = gap - 1;
  if (skips >= missed) return { count: streak.count + 1, lastDate: today, skipsLeft: skips - missed };
  return { count: 1, lastDate: today, skipsLeft: skips };
}

/** Last-N solve times for the sparkline, oldest->newest (won days only). Days are keyed
 *  by date|tier|shape; the date prefix keeps the key sort chronological. */
export function recentSolveMs(days: Record<string, DayState>, window: number): number[] {
  return Object.keys(days)
    .sort()
    .map((d) => days[d])
    .filter((d) => d.status === "won" && d.solveMs > 0)
    .slice(-window)
    .map((d) => d.solveMs);
}

/** Per-tier solve summary for the Stats difficulty breakdown. bestMs 0 = never solved. */
export interface TierStat {
  tier: string;
  solved: number;
  bestMs: number;
}

/** Solve history grouped by difficulty (won slots only), in the given tier `order`. Every tier
 *  in the order appears (solved 0, bestMs 0 when unplayed) so the Stats table stays stable, and
 *  bestMs is the fastest won solve for that tier across all days. Pure; days are keyed
 *  date|tier|shape, so a tier spans many days. */
export function tierHistory(days: Record<string, DayState>, order: string[]): TierStat[] {
  return order.map((tier) => {
    const times = Object.values(days)
      .filter((d) => d.tier === tier && d.status === "won" && d.solveMs > 0)
      .map((d) => d.solveMs);
    return { tier, solved: times.length, bestMs: times.length ? Math.min(...times) : 0 };
  });
}

/** Did any saved slot for this calendar date end won? Days are keyed by date|tier|shape,
 *  so a date can hold several slots; a day counts as won if any of them won. */
export function wonOnDate(days: Record<string, DayState>, date: string): boolean {
  return Object.values(days).some((d) => d.date === date && d.status === "won");
}

/** Did today's puzzle for a SPECIFIC tier end won? Per-tier variant of wonOnDate, used to
 *  decide whether PLAY should resume a tier or move past it. */
export function wonTierOnDate(days: Record<string, DayState>, date: string, tier: string): boolean {
  return Object.values(days).some((d) => d.date === date && d.tier === tier && d.status === "won");
}

/** The tier the landing PLAY button should launch so it always lands on a PLAYABLE puzzle,
 *  never resuming into a solved board's result card: the player's last tier when today's
 *  puzzle for it is still unsolved (resume an in-progress solve), else the first tier in
 *  `order` not yet won today (the next challenge), else - when every tier is solved today -
 *  the last tier (PLAY then shows its result, the honest "done for today"). Pure; `order`
 *  is the difficulty ramp (config/ui.json [difficulty].order). */
export function nextPlayableTier(days: Record<string, DayState>, date: string, order: string[], last: string): string {
  if (!wonTierOnDate(days, date, last)) return last;
  return order.find((t) => !wonTierOnDate(days, date, t)) ?? last;
}
