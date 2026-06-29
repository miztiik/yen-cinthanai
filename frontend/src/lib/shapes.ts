// Shape registry reader: pull baked config/shapes.json, base-aware. The engine reads
// a puzzle's shapeId, looks it up here, and skins by topology - never per-shape code
// (one engine, many skins; core-loop.md, sec 6). Snake config -> camel runtime. Fail
// soft to grid so a missing registry never blocks play. See docs/concepts/ui-shell.md.

const BASE = import.meta.env.BASE_URL;

export type Topology = "matrix" | "linear" | "circular";

export interface ShapeDef {
  topology: Topology;
  ordinalAxis: boolean;
  maxEntities: number;
  slotRules: string[];
  glyph: string;
  v: number;
}

const GRID_FALLBACK: ShapeDef = {
  topology: "matrix",
  ordinalAxis: false,
  maxEntities: 6,
  slotRules: ["eq", "neq"],
  glyph: "abstract.grid",
  v: 1,
};

interface RawShape {
  topology: string;
  ordinal_axis: boolean;
  max_entities: number;
  slot_rules: string[];
  glyph: string;
  v: number;
}

function fromRaw(r: RawShape): ShapeDef {
  const t = r.topology === "linear" ? "linear" : r.topology === "circular" ? "circular" : "matrix";
  return {
    topology: t,
    ordinalAxis: r.ordinal_axis,
    maxEntities: r.max_entities,
    slotRules: r.slot_rules,
    glyph: r.glyph,
    v: r.v,
  };
}

/** All registered shapes, keyed by shapeId. Fail-soft to a grid-only registry. */
export async function loadShapes(): Promise<Record<string, ShapeDef>> {
  try {
    const res = await fetch(`${BASE}config/shapes.json`, { cache: "no-cache" });
    if (!res.ok) return { grid: GRID_FALLBACK };
    const raw = (await res.json()) as Record<string, RawShape>;
    return Object.fromEntries(Object.entries(raw).map(([id, r]) => [id, fromRaw(r)]));
  } catch {
    return { grid: GRID_FALLBACK };
  }
}

/** Resolve a shapeId; unknown ids fall back to grid so the board still renders. */
export function shapeOf(reg: Record<string, ShapeDef>, id: string): ShapeDef {
  return reg[id] ?? GRID_FALLBACK;
}
