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

/** Find the entity holding (cat, value): anchor is fixed, others come from play. */
function holder(b: BoardModel, anchor: AttributeCategory, place: Placements, cat: string, value: string): string | null {
  if (cat === anchor.id) {
    const i = anchor.values.findIndex((v) => v.id === value);
    return i >= 0 ? b.entities[i] : null;
  }
  for (const e of b.entities) if (place[e]?.[cat] === value) return e;
  return null;
}

function evalConstraint(b: BoardModel, anchor: AttributeCategory, place: Placements, k: Constraint): ClueState {
  const ents = k.operands.map((o) => holder(b, anchor, place, o.cat, o.value));
  if (ents.some((e) => e === null)) return "unknown";
  const [a, c] = ents as string[];
  switch (k.type) {
    case "eq":
      return a === c ? "satisfy" : "violate";
    case "neq":
      return a !== c ? "satisfy" : "violate";
    case "ends": {
      const last = b.entities.length - 1;
      const p = posOf(b, a);
      return p === 0 || p === last ? "satisfy" : "violate";
    }
    case "adjacent":
      return Math.abs(posOf(b, a) - posOf(b, c)) === 1 ? "satisfy" : "violate";
    case "distance":
      return Math.abs(posOf(b, a) - posOf(b, c)) === Number(k.params.k) ? "satisfy" : "violate";
    case "before":
      return posOf(b, a) < posOf(b, c) ? "satisfy" : "violate";
    default:
      return "unknown";
  }
}

/** Entities a constraint currently touches (placed operands only). */
function touched(b: BoardModel, anchor: AttributeCategory, place: Placements, k: Constraint): string[] {
  const out: string[] = [];
  for (const o of k.operands) {
    const e = holder(b, anchor, place, o.cat, o.value);
    if (e) out.push(e);
  }
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
