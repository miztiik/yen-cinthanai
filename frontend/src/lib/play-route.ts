// Play-route grammar. Canonical form is DATE-FIRST: /play/<date>/<tier>, aligned with the
// served file `puzzles/<date>-<tier>.json` and the save key `<date>|<tier>|<shapeId>`
// (dayKey). Parsing is order-tolerant (a bare /play/<tier> or /play still resolve); the
// canonical builder is always date-first. Pure; no DOM. See docs/concepts/ui-shell.md.

import type { Tier } from "../contracts/save";
import { isIsoDate } from "./dates";

const TIERS: readonly Tier[] = ["easy", "standard", "sharp", "expert"];

export interface PlayTarget {
  date?: string;
  tier?: Tier;
}

/** Parse an app route (/play, /play/<tier>, /play/<date>, /play/<date>/<tier>) into its
 *  date + tier parts. Non-play routes and unknown segments yield an empty target. */
export function parsePlay(route: string): PlayTarget {
  const seg = route.replace(/^\/+/, "").split("/");
  if (seg[0] !== "play") return {};
  const out: PlayTarget = {};
  for (const p of seg.slice(1)) {
    if (isIsoDate(p)) out.date = p;
    else if (TIERS.includes(p as Tier)) out.tier = p as Tier;
  }
  return out;
}

/** Canonical date-first app path for a resolved day. */
export function playPath(date: string, tier: Tier): string {
  return `play/${date}/${tier}`;
}
