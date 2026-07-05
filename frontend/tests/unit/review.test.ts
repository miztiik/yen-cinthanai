// Unit: reviewTarget picks which (tier) a Stats day-dot opens, against the REAL shipped bank.
// A day in the bank is playable; a day outside the rolling window is not. The tier is the
// played tier (a won slot wins), else the player's lastTier, else standard. Pure - no fetch,
// no mount. See src/lib/review.ts, docs/concepts/ui-shell.md.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewTarget } from "../../src/lib/review";
import { freshSave } from "../../src/state/save.svelte";
import type { BankIndex } from "../../src/contracts/bank";
import type { Save, DayState } from "../../src/contracts/save";

const here = fileURLToPath(new URL(".", import.meta.url));
const bank: BankIndex = JSON.parse(readFileSync(resolve(here, "../../public/puzzles/index.json"), "utf8"));
const shipped = [...new Set(bank.puzzles.map((p) => p.date))].sort();
const newest = shipped[shipped.length - 1];

function day(date: string, tier: DayState["tier"], status: DayState["status"]): DayState {
  return { date, tier, shapeId: "grid", status, placements: {}, attempts: 0, solveMs: 0, hintsUsed: 0, stars: 0 };
}

describe("reviewTarget", () => {
  it("returns undefined for a day not in the shipped bank (aged out / future)", () => {
    expect(reviewTarget(freshSave(), bank, "1999-01-01")).toBeUndefined();
  });

  it("defaults to standard for a shipped day the player never touched", () => {
    expect(reviewTarget(freshSave(), bank, newest)).toEqual({ tier: "standard" });
  });

  it("uses the player's lastTier when set and no slot exists for that day", () => {
    const s: Save = { ...freshSave(), settings: { ...freshSave().settings, lastTier: "sharp" } };
    expect(reviewTarget(s, bank, newest)).toEqual({ tier: "sharp" });
  });

  it("prefers the tier the player WON that day over lastTier", () => {
    const s: Save = { ...freshSave(), settings: { ...freshSave().settings, lastTier: "sharp" } };
    s.days[`${newest}|expert|grid`] = day(newest, "expert", "won");
    expect(reviewTarget(s, bank, newest)).toEqual({ tier: "expert" });
  });
});
