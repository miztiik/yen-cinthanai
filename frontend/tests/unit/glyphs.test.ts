import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { glyphPath, glyphRefs, glyphs } from "../../src/lib/glyphs";

const here = fileURLToPath(new URL(".", import.meta.url));
const assetsDir = resolve(here, "../../public/assets/glyphs");
const configToml = resolve(here, "../../../config/glyphpacks.toml");

/** Minimal "pack.id" extractor for [household.tea] section headers. */
function configRefs(): string[] {
  const text = readFileSync(configToml, "utf8");
  const refs: string[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\[([a-z0-9]+)\.([a-z0-9]+)\]\s*$/i);
    if (m) refs.push(`${m[1]}.${m[2]}`);
  }
  return refs.sort();
}

describe("glyph registry", () => {
  it("maps every registered glyph to a file that exists", () => {
    for (const ref of glyphRefs()) {
      const file = glyphPath(ref).replace("/assets/glyphs/", "");
      expect(existsSync(resolve(assetsDir, file)), file).toBe(true);
    }
  });

  it("ships the six glyph packs", () => {
    expect(Object.keys(glyphs.packs).sort()).toEqual(["abstract", "color", "creatures", "food", "household", "shapes"]);
  });
});

describe("config <-> registry", () => {
  it("has a registry entry for every config id and vice versa", () => {
    expect(configRefs()).toEqual(glyphRefs());
  });
});

describe("resolver", () => {
  it("round-trips a ref to a base-aware POSIX path", () => {
    expect(glyphPath("household.tea")).toBe("/assets/glyphs/household/tea.svg");
  });

  it("throws on an unknown ref", () => {
    expect(() => glyphPath("nope.zzz")).toThrow(/unknown glyph/);
  });
});
