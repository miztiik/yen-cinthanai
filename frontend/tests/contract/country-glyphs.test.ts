// Contract: the `country` category (datasets/categories.json) is glyph-backed by the flags
// pack - every value id is a real flags-pack slug, so value.glyph = `flags.<id>` resolves to
// a shipped SVG. Guards the kebab -> drop-hyphens slug alignment (united-states-of-america ->
// unitedstatesofamerica) and that the pool is big enough for the largest tier's entities.
// Real files, no mocks. See datasets/categories.json, tools/bake_glyphs.py, config/tiers.json.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { glyphPath } from "../../src/lib/glyphs";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(here, "../../..");
const assetsDir = resolve(here, "../../public/assets/glyphs");
const cats = JSON.parse(readFileSync(resolve(root, "datasets/categories.json"), "utf8"));
const tiers = JSON.parse(readFileSync(resolve(root, "config/tiers.json"), "utf8"));

describe("country category is flags-backed", () => {
  const country = cats.categories.country;

  it("declares the flags glyph pack and a nominal kind", () => {
    expect(country).toBeDefined();
    expect(country.kind).toBe("nominal");
    expect(country.glyphPack).toBe("flags");
  });

  it("carries enough values for the largest tier's entity count", () => {
    const maxEntities = Math.max(...Object.values(tiers).map((t) => (t as { entities: number }).entities));
    expect(country.values.length).toBeGreaterThanOrEqual(maxEntities);
  });

  it("resolves every value id to a shipped flags SVG (slug alignment)", () => {
    for (const v of country.values as { id: string; label: string }[]) {
      const ref = `flags.${v.id}`;
      expect(() => glyphPath(ref), ref).not.toThrow();
      const file = glyphPath(ref).replace("/assets/glyphs/", "");
      expect(existsSync(resolve(assetsDir, file)), file).toBe(true);
    }
  });
});
