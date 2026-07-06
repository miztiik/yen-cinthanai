// Contract: every scenario template's glyph-backed category resolves to shipped glyphs. A value id
// in a glyphPack category is a real pack slug, so value.glyph = `<pack>.<id>` renders at runtime
// (glyphPath throws on an unknown ref). Guards the row-9e mappings dish->food, drink->drinks,
// vegetable->vegetables, ribbon->color, role->occupation, plus enough values for the largest tier.
// Real files + the generated glyph manifest, no mocks. See datasets/templates/*.json,
// docs/reference/glyph-coverage.md, tools/bake_glyphs.py, config/tiers.json.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { glyphPath } from "../../src/lib/glyphs";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(here, "../../..");
const templatesDir = resolve(root, "datasets/templates");
const assetsDir = resolve(here, "../../public/assets/glyphs");
const tiers = JSON.parse(readFileSync(resolve(root, "config/tiers.json"), "utf8")) as Record<
  string,
  { entities: number }
>;
const maxEntities = Math.max(...Object.values(tiers).map((t) => t.entities));

type TemplateValue = { id: string; label: string; glyph?: string };
type TemplateCategory = { id: string; glyphPack?: string; valuePool: TemplateValue[] };
type Template = { id: string; categories: TemplateCategory[] };

const templates = readdirSync(templatesDir)
  .filter((f) => f.endsWith(".json") && f !== "manifest.json") // the catalog index is not a template
  .map((f) => JSON.parse(readFileSync(resolve(templatesDir, f), "utf8")) as Template);

describe("scenario catalog", () => {
  it("ships a diverse batch of templates", () => {
    expect(templates.length).toBeGreaterThanOrEqual(4);
    expect(templates.map((t) => t.id)).toContain("weekend-market");
  });
});

for (const t of templates) {
  for (const cat of t.categories) {
    if (!cat.glyphPack) continue; // text-only categories carry no glyph asset
    describe(`${t.id} / ${cat.id} is glyph-backed by ${cat.glyphPack}`, () => {
      it("resolves every value id to a shipped glyph file (slug alignment)", () => {
        for (const v of cat.valuePool) {
          const ref = `${cat.glyphPack}.${v.id}`;
          expect(() => glyphPath(ref), ref).not.toThrow();
          const file = glyphPath(ref).replace("/assets/glyphs/", "");
          expect(existsSync(resolve(assetsDir, file)), file).toBe(true);
        }
      });

      it("carries enough values for the largest tier's entity count", () => {
        expect(cat.valuePool.length).toBeGreaterThanOrEqual(maxEntities);
      });
    });
  }
}

// Per-value glyph overrides: a value may carry its own non-empty `glyph` ref independent of the
// category glyphPack (used when a pack is only partly backfilled - e.g. weekend-market bloom wires
// jasmine + sunflower while the rest of the column stays text). Every such override must resolve.
for (const t of templates) {
  const overrides = t.categories.flatMap((c) =>
    c.valuePool.filter((v) => v.glyph).map((v) => ({ cat: c.id, id: v.id, glyph: v.glyph as string })),
  );
  if (!overrides.length) continue;
  describe(`${t.id} per-value glyph overrides resolve`, () => {
    for (const o of overrides) {
      it(`${o.cat}/${o.id} -> ${o.glyph}`, () => {
        expect(() => glyphPath(o.glyph), o.glyph).not.toThrow();
        const file = glyphPath(o.glyph).replace("/assets/glyphs/", "");
        expect(existsSync(resolve(assetsDir, file)), file).toBe(true);
      });
    }
  });
}
