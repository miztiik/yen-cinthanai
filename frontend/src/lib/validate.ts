// Validator: evaluate the player's placements against the constraints, never the
// solution (no leak, core-loop.md). Every constraint type ships with a legible glyph
// (ui-shell.md): eq, neq, ends, adjacent, distance, before. Operands name a
// (category, value), never an entity, so the same evaluator serves grid + seating.
// Anchor value i lives in entity i, so position is just that ordinal. Win = every
// fillable slot filled, zero violations, all constraints satisfied. See schemas.md.

import type { PuzzleManifest, Constraint, AttributeCategory } from "../contracts/manifest";
import type { BoardModel } from "./board";
import type { Placements } from "../contracts/save";

export type ClueState = "satisfy" | "violate" | "unknown";
export type RowState = "empty" | "near" | "satisfy" | "violate";

export interface PuzzleEval {
  clues: Record<string, ClueState>;
  rows: Record<string, RowState>;
  filled: number;
  total: number;
  won: boolean;
}

/** Ordinal position of an entity = its anchor value index (value i -> entity i). */
function posOf(b: BoardModel, entity: string): number {
  return b.entities.indexOf(entity);
}

/** Entities holding (cat, value). Anchor is fixed; shared cats may hold many; a
 *  bijective fillable cat holds at most one. eq/neq test set overlap so both work. */
function holders(b: BoardModel, anchor: AttributeCategory, place: Placements, cat: string, value: string): string[] {
  if (cat === anchor.id) {
    const i = anchor.values.findIndex((v) => v.id === value);
    return i >= 0 ? [b.entities[i]] : [];
  }
  return b.entities.filter((e) => place[e]?.[cat] === value);
}

/** First holder (bijective: the only one), or null - for ordinal/position clues. */
function holder(b: BoardModel, anchor: AttributeCategory, place: Placements, cat: string, value: string): string | null {
  return holders(b, anchor, place, cat, value)[0] ?? null;
}

/** Ring distance: min of forward/backward steps when the table wraps, else linear. */
function span(b: BoardModel, a: string, c: string): number {
  const n = b.entities.length;
  const d = Math.abs(posOf(b, a) - posOf(b, c));
  return b.wrap ? Math.min(d, n - d) : d;
}

function evalConstraint(b: BoardModel, anchor: AttributeCategory, place: Placements, k: Constraint): ClueState {
  if (k.type === "eq" || k.type === "neq") {
    const sa = new Set(holders(b, anchor, place, k.operands[0].cat, k.operands[0].value));
    const sb = holders(b, anchor, place, k.operands[1].cat, k.operands[1].value);
    if (sa.size === 0 || sb.length === 0) return "unknown";
    const overlap = sb.some((e) => sa.has(e));
    return (k.type === "eq" ? overlap : !overlap) ? "satisfy" : "violate";
  }
  const ents = k.operands.map((o) => holder(b, anchor, place, o.cat, o.value));
  if (ents.some((e) => e === null)) return "unknown";
  const [a, c, d] = ents as string[];
  switch (k.type) {
    case "ends": {
      const last = b.entities.length - 1;
      const p = posOf(b, a);
      return p === 0 || p === last ? "satisfy" : "violate";
    }
    case "adjacent":
      return span(b, a, c) === 1 ? "satisfy" : "violate";
    case "opposite":
      return span(b, a, c) === b.entities.length / 2 ? "satisfy" : "violate";
    case "between":
      return span(b, a, c) === 1 && span(b, a, d) === 1 ? "satisfy" : "violate";
    case "distance":
      return span(b, a, c) === Number(k.params.k) ? "satisfy" : "violate";
    case "before":
      return posOf(b, a) < posOf(b, c) ? "satisfy" : "violate";
    default:
      return "unknown";
  }
}

/** Entities a constraint currently touches (placed operands only). */
function touched(b: BoardModel, anchor: AttributeCategory, place: Placements, k: Constraint): string[] {
  const out: string[] = [];
  for (const o of k.operands) out.push(...holders(b, anchor, place, o.cat, o.value));
  return out;
}

export function evaluate(m: PuzzleManifest, b: BoardModel, place: Placements): PuzzleEval {
  const anchor = b.anchor;
  const clues: Record<string, ClueState> = {};
  const violate = new Set<string>();
  const ok = new Set<string>();
  for (const k of m.constraints) {
    const s = evalConstraint(b, anchor, place, k);
    clues[k.id] = s;
    for (const e of touched(b, anchor, place, k)) (s === "violate" ? violate : ok).add(e);
  }

  let filled = 0;
  const total = b.entities.length * b.columns.length;
  const rows: Record<string, RowState> = {};
  for (const e of b.entities) {
    const placedCols = b.columns.filter((c) => place[e]?.[c.id]).length;
    filled += placedCols;
    const full = placedCols === b.columns.length;
    if (violate.has(e)) rows[e] = "violate";
    else if (full && ok.has(e)) rows[e] = "satisfy";
    else if (placedCols > 0) rows[e] = "near";
    else rows[e] = "empty";
  }

  const allSat = m.constraints.every((k) => clues[k.id] === "satisfy");
  const won = filled === total && total > 0 && allSat;
  return { clues, rows, filled, total, won };
}
