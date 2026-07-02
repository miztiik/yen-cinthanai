// Contract: the lazy-flag PWA policy (frontend/src/lib/pwa.ts). Country flags are routed
// CacheFirst (fetched per file on demand) and excluded from the shell precache, so a country
// puzzle pulls only its N entities' flags, never all 271. Unit-testable without a build; the
// built service worker is smoke-checked in pwa.test.ts. See frontend/vite.config.ts.

import { describe, it, expect } from "vitest";
import { FLAGS_GLOB_IGNORE, isLazyFlagUrl } from "../../src/lib/pwa";

const req = (p: string) => ({ url: new URL(`https://x.test${p}`) });

describe("lazy-flag PWA policy", () => {
  it("matches a flag SVG for on-demand CacheFirst (dev + Pages base)", () => {
    expect(isLazyFlagUrl(req("/assets/glyphs/flags/france.svg"))).toBe(true);
    expect(isLazyFlagUrl(req("/yen-cinthanai/assets/glyphs/flags/united-states-of-america.svg"))).toBe(true);
  });

  it("does not match other glyph packs, the registry, or puzzles", () => {
    expect(isLazyFlagUrl(req("/assets/glyphs/creatures/cat.svg"))).toBe(false);
    expect(isLazyFlagUrl(req("/assets/glyphs/index.json"))).toBe(false);
    expect(isLazyFlagUrl(req("/puzzles/2026-07-02-standard.json"))).toBe(false);
  });

  it("excludes the whole flags dir from the precache glob", () => {
    expect(FLAGS_GLOB_IGNORE).toContain("assets/glyphs/flags");
  });
});
