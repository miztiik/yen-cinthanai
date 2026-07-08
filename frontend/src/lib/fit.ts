// Desktop grid-fit sizing: the fused GridMatrix cell edge that fills the available column
// width without overflowing. Pure + DOM-free (Board measures the container via ResizeObserver
// and passes the width), so it is unit-tested. size = clamp(minCell, floor((width - lead -
// slack) / leafCount), maxCell); maxCell = 0 means UNCAPPED (the grid fills any monitor). See
// Board.svelte, config/ui.json [grid.desktop], docs/concepts/ui-shell.md.

export interface FitCfg {
  minCell: number;
  maxCell: number; // 0 = uncapped
  leadPx: number; // the fixed lead columns (row-group label + row label), in px
  slackPx: number; // a small margin so group borders never trip a 1px overflow
}

/** The largest cell edge (px) that fits `leafCount` value columns in `width`, floored at
 *  minCell and (when maxCell > 0) capped at maxCell. leafCount <= 0 -> minCell. */
export function fitCellSize(width: number, leafCount: number, cfg: FitCfg): number {
  if (leafCount <= 0) return cfg.minCell;
  const budget = Math.floor((width - cfg.leadPx - cfg.slackPx) / leafCount);
  const floored = Math.max(cfg.minCell, budget);
  return cfg.maxCell > 0 ? Math.min(cfg.maxCell, floored) : floored;
}

/** A derived grid dimension (px) that TRACKS the cell edge so the chrome stays proportional
 *  to the box - the axis-label font and the inter-cell gap both scale with `cellPx` rather
 *  than sitting at a fixed size next to a grown cell. Pure: `round(cellPx * scale)` clamped
 *  to [min, max]. Used for the label font size and the cell gap (config/ui.json [grid.label],
 *  [grid.gap]); mirrors the GlyphSeat `d = cellPx * ratio` pattern. */
export interface ScaleCfg {
  scale: number; // fraction of the cell edge
  min: number; // px floor (stays legible / present at the smallest cell)
  max: number; // px ceiling (never dwarfs the cell on a grown grid)
}
export function scaleClamp(cellPx: number, cfg: ScaleCfg): number {
  return Math.max(cfg.min, Math.min(cfg.max, Math.round(cellPx * cfg.scale)));
}
