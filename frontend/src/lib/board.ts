// Board model: derive the playable grid from a manifest, nothing hardcoded. One
// engine, many skins (core-loop.md): entities are rows, categories are columns,
// values are the draggable tokens. The anchor (ordinal if present, else cats[0]) is
// the row identity - value i sits in slot i - so it renders as a fixed header, not a
// fillable column. Every other category is a pool the player drains. No solution is
// ever read here, so nothing leaks. See docs/concepts/core-loop.md, ui-shell.md.

import type { PuzzleManifest, AttributeCategory, AttributeValue } from "../contracts/manifest";

export interface BoardModel {
  entities: string[]; // rows, in manifest order
  anchor: AttributeCategory; // fixed identity column (header), value i -> entity i
  columns: AttributeCategory[]; // fillable categories, in manifest order
  values: Record<string, AttributeValue[]>; // catId -> token pool source
  wrap: boolean; // circular table: adjacency wraps end-to-end (round-table)
}

/** Pick the anchor: the ordinal category if any, else the first category. */
export function anchorCategory(m: PuzzleManifest): AttributeCategory {
  return m.categories.list.find((c) => c.ordinal) ?? m.categories.list[0];
}

/** Anchor value for a row index (value i -> slot i). */
export function anchorValue(anchor: AttributeCategory, row: number): AttributeValue {
  return anchor.values[row];
}

/** Build the board: anchor fixed, all other categories fillable. */
export function buildBoard(m: PuzzleManifest): BoardModel {
  const anchor = anchorCategory(m);
  const columns = m.categories.list.filter((c) => c.id !== anchor.id);
  const values: Record<string, AttributeValue[]> = {};
  for (const c of m.categories.list) values[c.id] = c.values;
  return { entities: m.entities, anchor, columns, values, wrap: m.shapeId === "round-table" };
}

/** Total fillable slots = entities x fillable columns. */
export function slotCount(b: BoardModel): number {
  return b.entities.length * b.columns.length;
}

/** Ring seat centres as box fractions (0..1), seat 0 at top, clockwise. The circular
 *  skin places seats here; capped at maxEntities 6 so each stays a >=44px target. */
export function ringSeats(n: number, r = 0.42): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI - Math.PI / 2;
    return { x: 0.5 + r * Math.cos(t), y: 0.5 + r * Math.sin(t) };
  });
}
