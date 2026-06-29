// Contract: the baked palette config drives the live theme/palette swap. Every palette
// ships a light + dark variant defining all eight tokens (bg/surface/ink/accent/satisfy/
// violate/near/gold); the default palette resolves and the three theme modes are present.
// The game reads these via lib/theme; no colour is hardcoded in code (CLAUDE.md #6).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Palettes } from "../../src/lib/config";

const here = fileURLToPath(new URL(".", import.meta.url));
const palettes = JSON.parse(
  readFileSync(resolve(here, "../../public/config/palettes.json"), "utf8"),
) as Palettes;

const TOKENS = ["accent", "bg", "gold", "ink", "near", "satisfy", "surface", "violate"];

describe("palettes config", () => {
  it("declares the eight tokens and the three theme modes", () => {
    expect([...palettes.tokens].sort()).toEqual(TOKENS);
    expect(palettes.themes).toEqual(["light", "dark", "system"]);
  });

  it("names a default palette that exists", () => {
    expect(palettes.palette[palettes.default]).toBeDefined();
  });

  it("ships at least two palettes", () => {
    expect(Object.keys(palettes.palette).length).toBeGreaterThanOrEqual(2);
  });

  it("every palette defines light + dark with all eight tokens as colours", () => {
    for (const [id, p] of Object.entries(palettes.palette)) {
      expect(typeof p.label, id).toBe("string");
      for (const scheme of ["light", "dark"] as const) {
        const set = p[scheme];
        expect(set, `${id}.${scheme}`).toBeDefined();
        for (const t of TOKENS) {
          expect(set[t], `${id}.${scheme}.${t}`).toMatch(/^#[0-9a-f]{3,8}$/i);
        }
      }
    }
  });
});
