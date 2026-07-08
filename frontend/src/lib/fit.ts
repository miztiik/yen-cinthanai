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
