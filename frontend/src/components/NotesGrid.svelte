<script lang="ts">
  // NotesGrid: the one-block editor for the cross-out grid (Jony: a full triangular grid
  // is unusable at phone cell sizes, so we edit ONE category-pair block at a readable size
  // and navigate between blocks). Real <table> semantics: a <th scope="col"> per column
  // value, a <th scope="row"> per row value, each row header carrying a DRAGGABLE handle
  // (the drag source - drop it into a cell to TICK that pairing). Cells are GridCells with
  // a roving tabindex (arrow keys move focus, Enter ticks, Space crosses out). Ticking is
  // the B-prime verb; auto-X of the rest of the row/col is derived (grid.ts), never stored.
  // Chrome is Tailwind; the only image is the glyph. See TODO story-first-pivot sec 8.
  import { getContext } from "svelte";
  import GridCell from "./GridCell.svelte";
  import Glyph from "../lib/Glyph.svelte";
  import GlyphSeat from "./GlyphSeat.svelte";
  import { blockCells, cellState, axisGlyphs, onCrosshair, type GridBlock } from "../lib/grid";
  import { glyphExists } from "../lib/glyphs";
  import type { GridCopy } from "../lib/config";
  import type { AttributeValue } from "../contracts/manifest";
  import type { DisplaySettings } from "../contracts/save";
  import type { Game } from "../state/play.svelte";

  let {
    game,
    block,
    blocks,
    index,
    copy,
    size = 40,
    labelPx = 12,
    gapPx = 4,
    flashMs = 550,
    onnav,
  }: {
    game: Game;
    block: GridBlock;
    blocks: GridBlock[];
    index: number;
    copy: GridCopy;
    size?: number;
    // labelPx/gapPx TRACK the cell edge (Board -> lib/fit.ts scaleClamp) so the axis labels and
    // the inter-cell gap stay proportional to the cell instead of a fixed size.
    labelPx?: number;
    gapPx?: number;
    flashMs?: number;
    onnav: (dir: 1 | -1) => void;
  } = $props();

  let container = $state<HTMLElement | null>(null);
  let activeCell = $state(0);
  // Hint reveal pulse (PR-4): when the store bumps hintFlash, stamp the just-ticked cell of the
  // CURRENT block so it pulses (app.css [data-flash]) and scroll it into view. Board switches
  // activeBlock to the hinted cell's block first, so by the time this runs the cell is on screen.
  let flashKey = $state<string | null>(null);
  $effect(() => {
    const nonce = game.hintFlash;
    const key = game.lastHintKey;
    if (!nonce || !key) return;
    flashKey = key;
    queueMicrotask(() => container?.querySelector<HTMLElement>(`[data-cell-key="${key}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" }));
    const t = setTimeout(() => (flashKey = null), flashMs);
    return () => clearTimeout(t);
  });
  // The hover/focus crosshair: ONE source of truth, STAMPED with the block id so a block switch
  // auto-clears it. `hov` is the {r,c} view valid for the CURRENT block only - so there is NO
  // reset effect (an effect that WROTE hovered would re-run on every hover and clobber it, a
  // Svelte 5 write-back). Cleared outright on pointer-leave / focus leaving the grid.
  let hovered = $state<{ block: string; r: number; c: number } | null>(null);
  const hov = $derived(hovered && hovered.block === block.id ? hovered : null);
  // Reset the roving focus to the first cell whenever the active block changes.
  $effect(() => {
    void block.id;
    activeCell = 0;
  });
  // Delegated crosshair: resolve the cell under the pointer/focus (dataset ONLY - never
  // getBoundingClientRect, so no forced reflow) and stamp the single hovered {block,r,c}.
  // pointer-leave clears; focusout clears only when focus left the whole grid (roving BETWEEN
  // cells keeps it).
  function markFrom(target: EventTarget | null) {
    const el = (target as HTMLElement | null)?.closest<HTMLElement>("[data-cell-key]");
    if (el && el.dataset.r != null && el.dataset.c != null) hovered = { block: block.id, r: +el.dataset.r, c: +el.dataset.c };
  }
  function onFocusOut(e: FocusEvent) {
    if (!container?.contains(e.relatedTarget as Node)) hovered = null;
  }

  const cols = $derived(block.colCat.values);
  const rows = $derived(block.rowCat.values);
  const cells = $derived(blockCells(block)); // row-major, matches DOM order of the buttons
  const ticks = $derived(new Set(Object.keys(game.gridTicks)));
  const manualX = $derived(new Set(Object.keys(game.gridManualX)));
  // Conflict cells (PR-6): only when the tier has revealed feedback. A TICKED cell in a violated
  // clue is ringed red (never a blank, no spoiler). See lib/validate.ts conflicts, app.css.
  const conflicts = $derived(game.revealed ? game.evalState.conflicts : null);
  // No-mix glyph rule: each axis shows images only when ALL its values have art, else text.
  // Display mode: the player's `glyphs` toggle gates this - glyphs off forces the axis to text.
  const display = getContext<(() => DisplaySettings) | undefined>("display");
  const glyphsOn = $derived(display?.().glyphs ?? true);
  const rowGlyphs = $derived(axisGlyphs(glyphsOn, block.rowCat, glyphExists));
  const colGlyphs = $derived(axisGlyphs(glyphsOn, block.colCat, glyphExists));

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
    ><span class="inline-block -scale-x-100"><Glyph ref="ui.chevron" size={16} tint /></span></button>
    <span class="font-semibold">
      {block.rowCat.label} <span class="opacity-50">/</span> {block.colCat.label}
      <span class="ml-1 opacity-50 tabular-nums">({index + 1}/{blocks.length})</span>
    </span>
    <button
      type="button"
      class="rounded-lg bg-surface px-2 py-1 disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={copy.nextBlock}
      onclick={() => onnav(1)}
    ><Glyph ref="ui.chevron" size={16} tint /></button>
  </header>

  <!-- The scroll container also DELEGATES the crosshair pointer/focus events for its cells. It
       is a passive wrapper, not an interactive control (the real controls are the cell <button>s,
       each labelled + keyboard-reachable), and the handlers only paint a decorative row/column
       highlight - so a static-interaction role does not apply here. -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="overflow-x-auto"
    bind:this={container}
    style={`--hint-flash-ms:${flashMs}ms`}
    onpointerover={(e) => markFrom(e.target)}
    onpointerleave={() => (hovered = null)}
    onfocusin={(e) => markFrom(e.target)}
    onfocusout={onFocusOut}
  >
    <table class="border-separate" style={`border-spacing:${gapPx}px`}>
      <caption class="sr-only">{block.rowCat.label} versus {block.colCat.label}</caption>
      <thead>
        <tr>
          <th scope="col"><span class="sr-only">{block.rowCat.label}</span></th>
          {#each cols as cv, ci (cv.id)}
            <th scope="col" data-crosshair-hdr={hov?.c === ci ? "" : undefined} class="px-1 text-center font-medium opacity-70" style={`width:${size}px;font-size:${labelPx}px`}>
              <span class="flex flex-col items-center gap-1">
                {#if colGlyphs && cv.glyph}<GlyphSeat ref={cv.glyph} label={cv.label} d={Math.round(size * 0.62)} />{/if}
                <span>{cv.label}</span>
              </span>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as rv, ri (rv.id)}
          <tr>
            <th scope="row" data-crosshair-hdr={hov?.r === ri ? "" : undefined} style={`font-size:${labelPx}px`} class="pr-1 text-right font-medium">
              <span class="inline-flex select-none items-center gap-1.5">
                {#if rowGlyphs && rv.glyph}<GlyphSeat ref={rv.glyph} label={rv.label} d={Math.round(size * 0.62)} />{/if}
                <span>{rv.label}</span>
              </span>
            </th>
            {#each cols as cv, ci (cv.id)}
              {@const idx = ri * cols.length + ci}
              <td class="p-0">
                <GridCell
                  cellKey={keyAt(rv, cv)}
                  block={block.id}
                  state={stateAt(rv, cv)}
                  glyph={colGlyphs && cv.glyph ? cv.glyph : null}
                  ariaLabel={ariaAt(rv, cv)}
                  tabindex={idx === activeCell ? 0 : -1}
                  crosshair={onCrosshair(hov, ri, ci)}
                  row={ri}
                  col={ci}
                  flash={keyAt(rv, cv) === flashKey}
                  conflict={!!conflicts && ticks.has(keyAt(rv, cv)) && conflicts.has(keyAt(rv, cv))}
                  {size}
                  locked={game.locked}
                  ontap={() => {
                    activeCell = idx;
                    game.gridCycle(keyAt(rv, cv));
                  }}
                  ontick={() => {
                    activeCell = idx;
                    game.gridCycle(keyAt(rv, cv));
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
