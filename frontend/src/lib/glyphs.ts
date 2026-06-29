// Glyph resolver. ZERO inline SVG: every icon ships as a file under
// public/assets/glyphs/ and is referenced "pack.id" (CLAUDE.md #6, #10). The file
// map is the registry; labels live in config/glyphpacks.toml. Base-aware so the
// same ref resolves under '/' (dev) and '/yen-cinthanai/' (Pages).
// See docs/concepts/ui-shell.md and docs/architecture/runtime/stack-and-bundle.md.

import registry from "../../public/assets/glyphs/index.json";

const BASE = import.meta.env.BASE_URL;
const ROOT = "assets/glyphs/";

export interface GlyphRegistry {
  schemaVersion: number;
  packs: Record<string, Record<string, string>>;
}

export const glyphs: GlyphRegistry = registry;

/** Every valid "pack.id" reference, sorted. */
export function glyphRefs(): string[] {
  const refs: string[] = [];
  for (const pack of Object.keys(glyphs.packs)) {
    for (const id of Object.keys(glyphs.packs[pack])) refs.push(`${pack}.${id}`);
  }
  return refs.sort();
}

/** Resolve a "pack.id" reference to a base-aware, POSIX URL. Throws if unknown. */
export function glyphPath(ref: string): string {
  const dot = ref.indexOf(".");
  const pack = dot < 0 ? "" : ref.slice(0, dot);
  const id = dot < 0 ? "" : ref.slice(dot + 1);
  const file = glyphs.packs[pack]?.[id];
  if (!file) throw new Error(`unknown glyph ref: ${ref}`);
  return BASE + ROOT + file;
}
