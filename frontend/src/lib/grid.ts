// Cross-out elimination grid model (the B-prime verb). Pure + DOM-free so it is
// unit-testable; the .svelte views are thin over this. A grid is the classic logic
// matrix: one BLOCK per unordered pair of BIJECTIVE categories, each block a rowCat x
// colCat matrix of cells. A cell asserts a relationship between two category endpoints
// ("name:ana" and "craft:pottery"); its key is the two endpoints order-normalized, so
// the same relationship has ONE key regardless of which axis is the row.
//
// Only two marks are AUTHORED + persisted: a TICK (the player dropped a glyph - the
// positive) and a MANUAL-X (the player tapped - a hand elimination). The other two
// states are DERIVED by a full recompute: an AUTO-X (implied when a tick elsewhere in
// the same block shares this cell's row or column - one endpoint) and BLANK. We NEVER
// auto-TICK a cell (only ever auto-X) so the last-cell-standing aha is preserved, and
// auto-X SKIPS a manual-X (manual-X survives, since it lives in its own authored set).
// See TODO/2026-07-01-story-first-pivot.md sec 8 (Decisions 1-4) and core-loop.md.

import type { AttributeCategory } from "../contracts/manifest";
import type { BoardModel } from "./board";
import type { Placements } from "../contracts/save";

/** One (category, value) endpoint - the coordinate a cell relates. */
export interface GridEndpoint {
  cat: string;
  val: string;
}

/** A single category-pair block: rowCat x colCat. `id` is order-independent. */
export interface GridBlock {
  id: string;
  rowCat: AttributeCategory;
  colCat: AttributeCategory;
}

/** One cell of a block, with its order-normalized key and its two endpoints. */
export interface GridCellRef {
  key: string;
  row: GridEndpoint;
  col: GridEndpoint;
}

/** The four cell states. Only `tick` + `manualX` are authored; the rest are derived. */
export type CellMark = "blank" | "manualX" | "autoX" | "tick";

/** Stable endpoint token `cat:val` (ids are simple ASCII, no `:` or `|`). */
export function endpointKey(e: GridEndpoint): string {
  return `${e.cat}:${e.val}`;
}

/** Order-normalized cell key `catA:valA|catB:valB` - one key per relationship. */
export function cellKey(a: GridEndpoint, b: GridEndpoint): string {
  const [x, y] = [endpointKey(a), endpointKey(b)].sort();
  return `${x}|${y}`;
}

/** Split an endpoint token back into its (cat, val). */
function splitEndpoint(token: string): GridEndpoint {
  const i = token.indexOf(":");
  return { cat: token.slice(0, i), val: token.slice(i + 1) };
}

/** Parse a cell key into its two endpoints (order as stored). */
export function parseCellKey(key: string): [GridEndpoint, GridEndpoint] {
  const [a, b] = key.split("|");
  return [splitEndpoint(a), splitEndpoint(b)];
}

/** Order-independent block id for a category pair. */
export function blockId(catA: string, catB: string): string {
  return [catA, catB].sort().join("|");
}

/** The bijective categories the grid covers: the anchor plus every bijective column
 *  (shared-cardinality categories stay token-only - Decision 7). */
export function gridCategories(board: BoardModel): AttributeCategory[] {
  return [board.anchor, ...board.columns.filter((c) => c.cardinality === "bijective")];
}

/** Every category-pair block, in a stable order (manifest order, i < j). */
export function gridBlocks(cats: AttributeCategory[]): GridBlock[] {
  const out: GridBlock[] = [];
  for (let i = 0; i < cats.length; i++)
    for (let j = i + 1; j < cats.length; j++)
      out.push({ id: blockId(cats[i].id, cats[j].id), rowCat: cats[i], colCat: cats[j] });
  return out;
}

/** The cells of a block (rowCat.values x colCat.values), row-major. */
export function blockCells(block: GridBlock): GridCellRef[] {
  const out: GridCellRef[] = [];
  for (const rv of block.rowCat.values)
    for (const cv of block.colCat.values) {
      const row = { cat: block.rowCat.id, val: rv.id };
      const col = { cat: block.colCat.id, val: cv.id };
      out.push({ key: cellKey(row, col), row, col });
    }
  return out;
}

/** How many endpoints two cells share (0, 1, or 2). */
function sharedEndpoints(a: [GridEndpoint, GridEndpoint], b: [GridEndpoint, GridEndpoint]): number {
  const ka = [endpointKey(a[0]), endpointKey(a[1])];
  const kb = new Set([endpointKey(b[0]), endpointKey(b[1])]);
  return ka.filter((k) => kb.has(k)).length;
}

/** A cell is AUTO-X iff another TICK in the SAME block shares exactly one endpoint with
 *  it (same row or same column) - the bijective elimination. Pure recompute, no storage. */
export function impliedX(key: string, ticks: ReadonlySet<string>): boolean {
  if (ticks.has(key)) return false;
  const cell = parseCellKey(key);
  const cellBlock = blockId(cell[0].cat, cell[1].cat);
  for (const t of ticks) {
    const tp = parseCellKey(t);
    if (blockId(tp[0].cat, tp[1].cat) !== cellBlock) continue;
    if (sharedEndpoints(cell, tp) === 1) return true;
  }
  return false;
}

/** Derive one cell's state from the authored marks. tick > manualX > autoX > blank.
 *  Manual-X wins over auto-X so a hand elimination never gets silently reclassified. */
export function cellState(
  key: string,
  ticks: ReadonlySet<string>,
  manualX: ReadonlySet<string>,
): CellMark {
  if (ticks.has(key)) return "tick";
  if (manualX.has(key)) return "manualX";
  if (impliedX(key, ticks)) return "autoX";
  return "blank";
}

/** Project the grid TICKS that involve the anchor category onto a placements copy, so
 *  the grid contributes to the win exactly like the token board (Decision 7). A tick
 *  between two NON-anchor categories has no single entity, so it stays scratch-only.
 *  The original placements take precedence (token board owns the shared column). The
 *  anchor is whatever board.ts derived - this function never re-derives it (Row 9). */
export function mergeGridPlacements(
  board: BoardModel,
  placements: Placements,
  ticks: ReadonlySet<string>,
): Placements {
  const merged: Placements = structuredClone(placements);
  const anchorId = board.anchor.id;
  for (const key of ticks) {
    const [p, q] = parseCellKey(key);
    const anchorEp = p.cat === anchorId ? p : q.cat === anchorId ? q : null;
    if (!anchorEp) continue; // cross-block tick: bookkeeping only, no entity
    const other = anchorEp === p ? q : p;
    const idx = board.anchor.values.findIndex((v) => v.id === anchorEp.val);
    if (idx < 0) continue;
    const entity = board.entities[idx];
    if (merged[entity]?.[other.cat] == null) merged[entity] = { ...merged[entity], [other.cat]: other.val };
  }
  return merged;
}
