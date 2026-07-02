<script lang="ts">
  // NotesGrid: the one-block editor for the cross-out grid (Jony: a full triangular grid
  // is unusable at phone cell sizes, so we edit ONE category-pair block at a readable size
  // and navigate between blocks). Real <table> semantics: a <th scope="col"> per column
  // value, a <th scope="row"> per row value, each row header carrying a DRAGGABLE handle
  // (the drag source - drop it into a cell to TICK that pairing). Cells are GridCells with
  // a roving tabindex (arrow keys move focus, Enter ticks, Space crosses out). Ticking is
  // the B-prime verb; auto-X of the rest of the row/col is derived (grid.ts), never stored.
  // Chrome is Tailwind; the only image is the glyph. See TODO story-first-pivot sec 8.
  import GridCell from "./GridCell.svelte";
  import Glyph from "../lib/Glyph.svelte";
  import { blockCells, cellState, type GridBlock } from "../lib/grid";
  import { draggable, type DragHandlers } from "../lib/drag";
  import type { GridCopy } from "../lib/config";
  import type { AttributeValue } from "../contracts/manifest";
  import type { Game } from "../state/play.svelte";

  let {
    game,
    block,
    blocks,
    index,
    copy,
    size = 40,
    snap,
    onnav,
  }: {
    game: Game;
    block: GridBlock;
    blocks: GridBlock[];
    index: number;
    copy: GridCopy;
    size?: number;
    snap: { radius_factor: number; ease: number };
    onnav: (dir: 1 | -1) => void;
  } = $props();

  let container = $state<HTMLElement | null>(null);
  let activeCell = $state(0);
  // Reset the roving focus to the first cell whenever the active block changes.
  $effect(() => {
    void block.id;
    activeCell = 0;
  });

  const cols = $derived(block.colCat.values);
  const rows = $derived(block.rowCat.values);
  const cells = $derived(blockCells(block)); // row-major, matches DOM order of the buttons
  const ticks = $derived(new Set(Object.keys(game.gridTicks)));
  const manualX = $derived(new Set(Object.keys(game.gridManualX)));

  function stateAt(rv: AttributeValue, cv: AttributeValue) {
    return cellState(keyAt(rv, cv), ticks, manualX);
  }
  function keyAt(rv: AttributeValue, cv: AttributeValue): string {
    return cells[rows.indexOf(rv) * cols.length + cols.indexOf(cv)].key;
  }
  function ariaAt(rv: AttributeValue, cv: AttributeValue): string {
    return copy.cell
      .replace("{row}", rv.label)
      .replace("{col}", cv.label)
      .replace("{state}", copy.state[stateAt(rv, cv)]);
  }

  // Row-header drag handle: dropping it into a cell ticks that cell (the magnet retargets
  // to this block's cell centres, snapshot at pointerdown). Pointer-only; keyboard ticks
  // via a focused cell + Enter, so the handle stays out of the tab order (tabindex -1).
  function handlers(): DragHandlers {
    return {
      cellBlock: block.id,
      onTap: () => {},
      onDropCell: (key) => game.gridDrop(key),
      snap: { radius: size * snap.radius_factor, ease: snap.ease },
    };
  }

  function focusCell(idx: number) {
    const btns = container ? container.querySelectorAll<HTMLButtonElement>("[data-cell-key]") : null;
    btns?.[idx]?.focus();
  }
  // Move the roving focus from the active cell, clamped at the block edges. Driven by the
  // focused GridCell's arrow keydown (onmove), so no static wrapper owns the interaction.
  function moveFrom(key: string) {
    const nc = cols.length;
    const n = cells.length;
    let idx = activeCell;
    if (key === "ArrowRight") idx += 1;
    else if (key === "ArrowLeft") idx -= 1;
    else if (key === "ArrowDown") idx += nc;
    else if (key === "ArrowUp") idx -= nc;
    else return;
    activeCell = Math.max(0, Math.min(n - 1, idx));
    focusCell(activeCell);
  }
</script>

<section class="flex flex-col gap-2" aria-label={copy.heading}>
  <header class="flex items-center justify-between gap-2 text-sm">
    <button
      type="button"
      class="rounded-lg bg-surface px-2 py-1 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={copy.prevBlock}
      onclick={() => onnav(-1)}
    >&lt;</button>
    <span class="font-semibold">
      {block.rowCat.label} <span class="opacity-50">/</span> {block.colCat.label}
      <span class="ml-1 opacity-50 tabular-nums">({index + 1}/{blocks.length})</span>
    </span>
    <button
      type="button"
      class="rounded-lg bg-surface px-2 py-1 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={copy.nextBlock}
      onclick={() => onnav(1)}
    >&gt;</button>
  </header>

  <div class="overflow-x-auto" bind:this={container}>
    <table class="border-separate border-spacing-1">
      <caption class="sr-only">{block.rowCat.label} versus {block.colCat.label}</caption>
      <thead>
        <tr>
          <th scope="col"><span class="sr-only">{block.rowCat.label}</span></th>
          {#each cols as cv (cv.id)}
            <th scope="col" class="px-1 text-center text-xs font-medium opacity-70" style={`width:${size}px`}>{cv.label}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as rv (rv.id)}
          <tr>
            <th scope="row" class="pr-1 text-right text-xs font-medium">
              <span
                use:draggable={handlers()}
                tabindex="-1"
                role="button"
                aria-label={rv.label}
                class="inline-flex cursor-grab touch-none select-none items-center gap-1 rounded-full active:cursor-grabbing"
              >
                {#if rv.glyph}<Glyph ref={rv.glyph} label={rv.label} size={Math.round(size * 0.5)} />{/if}
                <span>{rv.label}</span>
              </span>
            </th>
            {#each cols as cv (cv.id)}
              {@const idx = rows.indexOf(rv) * cols.length + cols.indexOf(cv)}
              <td class="p-0">
                <GridCell
                  cellKey={keyAt(rv, cv)}
                  block={block.id}
                  state={stateAt(rv, cv)}
                  glyph={cv.glyph || null}
                  ariaLabel={ariaAt(rv, cv)}
                  tabindex={idx === activeCell ? 0 : -1}
                  {size}
                  locked={game.locked}
                  ontap={() => {
                    activeCell = idx;
                    game.gridTap(keyAt(rv, cv));
                  }}
                  ontick={() => {
                    activeCell = idx;
                    game.gridDrop(keyAt(rv, cv));
                  }}
                  onmove={moveFrom}
                />
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
