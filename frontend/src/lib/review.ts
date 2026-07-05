// Which puzzle a Stats-calendar day-dot opens. A day is playable iff the shipped bank still
// holds it (the rolling window); the tier is the one the player played that day (a won slot
// wins, else any slot), else their last-played tier, else standard. Pure; drives Stats.
// See docs/concepts/ui-shell.md (Stats, Route grammar).

import type { Save, Tier } from "../contracts/save";
import type { BankIndex } from "../contracts/bank";
import { bankDates, hasEntry } from "./loader";

const FALLBACK_TIER: Tier = "standard";

/** The (tier) a Stats day-dot opens for `date`, or undefined when that day is not in the
 *  shipped bank (aged out of the rolling window) and so cannot be played. */
export function reviewTarget(save: Save, bank: BankIndex, date: string): { tier: Tier } | undefined {
  if (!bankDates(bank).includes(date)) return undefined;
  const days = Object.values(save.days).filter((d) => d.date === date);
  const played = days.find((d) => d.status === "won") ?? days[0];
  const pref = (played?.tier ?? save.settings.lastTier ?? FALLBACK_TIER) as Tier;
  return { tier: hasEntry(bank, date, pref) ? pref : FALLBACK_TIER };
}
