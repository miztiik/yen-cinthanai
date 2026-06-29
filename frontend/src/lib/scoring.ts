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

/** Last-N solve times for the sparkline, oldest->newest (won days only). */
export function recentSolveMs(days: Record<string, DayState>, window: number): number[] {
  return Object.keys(days)
    .sort()
    .map((d) => days[d])
    .filter((d) => d.status === "won" && d.solveMs > 0)
    .slice(-window)
    .map((d) => d.solveMs);
}
