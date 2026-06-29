// Contract: the baked tier dials drive feedback/par/caps for all four tiers. The game
// never hardcodes balance - it reads config/tiers.toml via bake. Easy is realtime &
// uncapped; harder tiers tighten attempts, hints, and feedback. par climbs by tier.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { TierDial } from "../../src/lib/config";

const here = fileURLToPath(new URL(".", import.meta.url));
const tiers = JSON.parse(
  readFileSync(resolve(here, "../../public/config/tiers.json"), "utf8"),
) as Record<string, TierDial>;

describe("tier dials", () => {
  it("ships all four tiers", () => {
    expect(Object.keys(tiers).sort()).toEqual(["easy", "expert", "sharp", "standard"]);
  });
  it("easy is realtime and uncapped", () => {
    expect(tiers.easy.feedback).toBe("realtime-names");
    expect(tiers.easy.hints).toBe(-1);
    expect(tiers.easy.attempts).toBe(-1);
  });
  it("feedback tightens by tier", () => {
    expect(tiers.standard.feedback).toBe("count-wrong");
    expect(tiers.sharp.feedback).toBe("binary-check");
    expect(tiers.expert.feedback).toBe("submit-binary");
  });
  it("expert is single-attempt, zero-hint", () => {
    expect(tiers.expert.attempts).toBe(1);
    expect(tiers.expert.hints).toBe(0);
  });
  it("par climbs easy < standard < sharp < expert", () => {
    expect(tiers.easy.par_s).toBeLessThan(tiers.standard.par_s);
    expect(tiers.standard.par_s).toBeLessThan(tiers.sharp.par_s);
    expect(tiers.sharp.par_s).toBeLessThan(tiers.expert.par_s);
  });
});
