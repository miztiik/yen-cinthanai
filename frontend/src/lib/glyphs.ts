// Glyph resolver. ZERO inline SVG: every icon ships as a file under
// public/assets/glyphs/ and is referenced "pack.slug" (CLAUDE.md #6, #10). The map
// is the registry (slug -> file + label), generated every build by
// tools/bake_glyphs.py. Base-aware so the same ref resolves under '/' (dev) and
// '/yen-cinthanai/' (Pages).
// See docs/concepts/ui-shell.md and docs/architecture/runtime/stack-and-bundle.md.

import registry from "../../public/assets/glyphs/index.json";

const BASE = import.meta.env.BASE_URL;
const ROOT = "assets/glyphs/";

export interface GlyphEntry {
  file: string;
  label: string;
}
export interface GlyphRegistry {
  schemaVersion: number;
  generatedAt: string;
  packs: Record<string, Record<string, GlyphEntry>>;
}

export const glyphs: GlyphRegistry = registry;

/** Every valid "pack.slug" reference, sorted. */
export function glyphRefs(): string[] {
  const refs: string[] = [];
  for (const pack of Object.keys(glyphs.packs)) {
    for (const slug of Object.keys(glyphs.packs[pack])) refs.push(`${pack}.${slug}`);
  }
  return refs.sort();
}

function entryOf(ref: string): GlyphEntry | undefined {
  const dot = ref.indexOf(".");
  if (dot < 0) return undefined;
  return glyphs.packs[ref.slice(0, dot)]?.[ref.slice(dot + 1)];
}

/** Resolve a "pack.slug" reference to a base-aware, POSIX URL. Throws if unknown. */
export function glyphPath(ref: string): string {
  const e = entryOf(ref);
  if (!e) throw new Error(`unknown glyph ref: ${ref}`);
  return BASE + ROOT + e.file;
}

/** Human label for a "pack.slug" reference. Throws if unknown. */
export function glyphLabel(ref: string): string {
  const e = entryOf(ref);
  if (!e) throw new Error(`unknown glyph ref: ${ref}`);
  return e.label;
}
