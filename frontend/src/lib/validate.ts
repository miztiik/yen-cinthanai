// Validator: evaluate the player's placements against the constraints, never the
// solution (no leak, core-loop.md). Positional types (eq, neq, ends, adjacent, distance,
// before) plus the story-first types (numDiff, threshold, oneOf, oneEachOf, ifThen) all
// resolve here, mirroring the generator's _add_clue semantics (tools/generate.py) so a
// full correct board wins. Operands name a (category, value), never an entity, so the same
// evaluator serves grid + seating. Anchor value i lives in entity i, so position is just
// that ordinal. Each clue is satisfy / violate / unknown - unknown when too few cells are
// placed to decide. Win = every fillable slot filled, zero violations, all satisfied. See
// docs/architecture/contracts/schemas.md, docs/concepts/difficulty-and-scoring.md.

import type { PuzzleManifest, Constraint, AttributeCategory, Operand } from "../contracts/manifest";
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

// --- story-first clue helpers (mirror tools/generate.py _add_clue) ---------------

/** The entity an anchor value names (identity: value i -> entity i), or null if unknown. */
function anchorEntity(b: BoardModel, anchor: AttributeCategory, value: string): string | null {
  const i = anchor.values.findIndex((v) => v.id === value);
  return i >= 0 ? b.entities[i] : null;
}

/** The value id currently at (entity, cat): the anchor's fixed identity value, or a placed
 *  token, or undefined when that cell is still empty. */
function valueAt(b: BoardModel, anchor: AttributeCategory, place: Placements, entity: string, cat: string): string | undefined {
  if (cat === anchor.id) {
    const i = b.entities.indexOf(entity);
    return i >= 0 ? anchor.values[i]?.id : undefined;
  }
  return place[entity]?.[cat];
}

/** Tri-state of "entity holds value in cat" read from the CURRENT board: yes, no, or maybe
 *  (the cell is unplaced, so it is not yet decidable). Bijective cats hold one value, so a
 *  placed-but-different value is a definite no. */
type Tri = "yes" | "no" | "maybe";
function fact(b: BoardModel, anchor: AttributeCategory, place: Placements, entity: string, cat: string, value: string): Tri {
  const cur = valueAt(b, anchor, place, entity, cat);
  if (cur === undefined) return "maybe";
  return cur === value ? "yes" : "no";
}
function andTri(a: Tri, c: Tri): Tri {
  if (a === "no" || c === "no") return "no";
  return a === "yes" && c === "yes" ? "yes" : "maybe";
}
function orTri(a: Tri, c: Tri): Tri {
  if (a === "yes" || c === "yes") return "yes";
  return a === "no" && c === "no" ? "no" : "maybe";
}
function triState(t: Tri): ClueState {
  return t === "yes" ? "satisfy" : t === "no" ? "violate" : "unknown";
}

/** Magnitude of the numeric category at the entity an operand names, or null when that
 *  entity has no numeric token placed yet (so the comparison is not decidable). */
function magAt(b: BoardModel, anchor: AttributeCategory, place: Placements, numericCat: string, o: Operand): number | null {
  const e = holder(b, anchor, place, o.cat, o.value);
  if (e === null) return null;
  const vid = place[e]?.[numericCat];
  if (vid === undefined) return null;
  const v = b.values[numericCat]?.find((x) => x.id === vid);
  return v?.magnitude ?? null;
}

function evalConstraint(b: BoardModel, anchor: AttributeCategory, place: Placements, k: Constraint): ClueState {
  if (k.type === "eq" || k.type === "neq") {
    const sa = new Set(holders(b, anchor, place, k.operands[0].cat, k.operands[0].value));
    const sb = holders(b, anchor, place, k.operands[1].cat, k.operands[1].value);
    if (sa.size === 0 || sb.length === 0) return "unknown";
    const overlap = sb.some((e) => sa.has(e));
    return (k.type === "eq" ? overlap : !overlap) ? "satisfy" : "violate";
  }
  // Numeric: compare magnitudes of the numeric category at the operands' entities.
  if (k.type === "numDiff") {
    const nc = String(k.params.numericCat);
    const ma = magAt(b, anchor, place, nc, k.operands[0]);
    const mb = magAt(b, anchor, place, nc, k.operands[1]);
    if (ma === null || mb === null) return "unknown";
    const delta = Number(k.params.delta);
    const ok = k.params.dir === "greater" ? ma === mb + delta : Math.abs(ma - mb) === delta;
    return ok ? "satisfy" : "violate";
  }
  if (k.type === "threshold") {
    const nc = String(k.params.numericCat);
    const ma = magAt(b, anchor, place, nc, k.operands[0]);
    if (ma === null) return "unknown";
    const bound = Number(k.params.bound);
    const ok = k.params.dir === "atmost" ? ma <= bound : ma >= bound;
    return ok ? "satisfy" : "violate";
  }
  // Compound: the first operand is an anchor value (its entity is always known); the rest
  // name (cat, value) facts at those entities.
  if (k.type === "oneOf") {
    const ea = anchorEntity(b, anchor, k.operands[0].value);
    if (ea === null) return "unknown";
    const fx = fact(b, anchor, place, ea, k.operands[1].cat, k.operands[1].value);
    const fy = fact(b, anchor, place, ea, k.operands[2].cat, k.operands[2].value);
    return triState(orTri(fx, fy));
  }
  if (k.type === "oneEachOf") {
    const ex = anchorEntity(b, anchor, k.operands[0].value);
    const ey = anchorEntity(b, anchor, k.operands[1].value);
    if (ex === null || ey === null) return "unknown";
    const a2 = k.operands[2];
    const b2 = k.operands[3];
    const branch1 = andTri(fact(b, anchor, place, ex, a2.cat, a2.value), fact(b, anchor, place, ey, b2.cat, b2.value));
    const branch2 = andTri(fact(b, anchor, place, ey, a2.cat, a2.value), fact(b, anchor, place, ex, b2.cat, b2.value));
    return triState(orTri(branch1, branch2));
  }
  if (k.type === "ifThen") {
    const ea = anchorEntity(b, anchor, k.operands[0].value);
    const eb = anchorEntity(b, anchor, k.operands[2].value);
    if (ea === null || eb === null) return "unknown";
    const bp = fact(b, anchor, place, ea, k.operands[1].cat, k.operands[1].value);
    const bq = fact(b, anchor, place, eb, k.operands[3].cat, k.operands[3].value);
    // Material implication (a holds P) => not (b holds Q): violated only when BOTH hold.
    const conj = andTri(bp, bq);
    return conj === "yes" ? "violate" : conj === "no" ? "satisfy" : "unknown";
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
