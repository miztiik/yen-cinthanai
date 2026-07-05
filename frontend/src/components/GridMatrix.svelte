<script lang="ts">
  // GridMatrix: the classic fused logic-grid ("staircase") for desktop (>=lg) - every
  // category-pair block at once, shared axes, rotated column headers, blank bottom-right
  // corner (the printed logic-puzzle layout). A pure LAYOUT over the SAME keys/store as the
  // phone NotesGrid: each cell is a cellKey tapped via game.gridCycle (blank -> X -> tick);
  // auto-X derives (grid.ts). No drag (tap-cycle only). Roving focus spans the whole matrix
  // in value coords, clamped to the staircase prefix. Phone keeps NotesGrid + GridMap.
  // See docs/concepts/core-loop.md, docs/concepts/ui-shell.md, grid.ts staircase().
  import { getContext } from "svelte";
  import GridCell from "./GridCell.svelte";
  import GlyphSeat from "./GlyphSeat.svelte";
  import { staircase, cellKey, cellState, axisGlyphs } from "../lib/grid";
  import { glyphExists } from "../lib/glyphs";
  import type { GridCopy } from "../lib/config";
  import type { AttributeCategory, AttributeValue } from "../contracts/manifest";
  import type { DisplaySettings } from "../contracts/save";
  import type { Game } from "../state/play.svelte";

  let { game, cats, copy, size = 40 }: { game: Game; cats: AttributeCategory[]; copy: GridCopy; size?: number } = $props();

  const layout = $derived(staircase(cats));
  const ticks = $derived(new Set(Object.keys(game.gridTicks)));
  const manualX = $derived(new Set(Object.keys(game.gridManualX)));
  // Per-axis glyph completeness: an axis shows images only if ALL its values have art, else the
  // whole axis falls back to green checks (no mix). Auto-upgrades when the missing art is added.
  // Display mode: the player's `glyphs` toggle gates this - glyphs off forces the axis to text.
  const display = getContext<(() => DisplaySettings) | undefined>("display");
  const glyphsOn = $derived(display?.().glyphs ?? true);
  const glyphCats = $derived(new Set(cats.filter((c) => axisGlyphs(glyphsOn, c, glyphExists)).map((c) => c.id)));

  interface Leaf {
    cat: AttributeCategory;
    axisIdx: number; // this value's category index within layout.cols / layout.rows
    v: AttributeValue;
    lastInGroup: boolean;
  }
  const colLeaves = $derived<Leaf[]>(
    layout.cols.flatMap((cat, c) => cat.values.map((v, vi) => ({ cat, axisIdx: c, v, lastInGroup: vi === cat.values.length - 1 }))),
  );
  const rowLeaves = $derived<Leaf[]>(
    layout.rows.flatMap((cat, r) => cat.values.map((v, vi) => ({ cat, axisIdx: r, v, lastInGroup: vi === cat.values.length - 1 }))),
  );
  const gcOf = $derived(new Map(colLeaves.map((l, i) => [l.v, i])));
  const grOf = $derived(new Map(rowLeaves.map((l, i) => [l.v, i])));

  let container = $state<HTMLElement | null>(null);
  let active = $state({ gr: 0, gc: 0 });
  $effect(() => {
    void cats;
    active = { gr: 0, gc: 0 };
  });

  function keyOf(rc: AttributeCategory, rv: AttributeValue, cc: AttributeCategory, cv: AttributeValue): string {
    return cellKey({ cat: rc.id, val: rv.id }, { cat: cc.id, val: cv.id });
  }
  function ariaAt(rv: AttributeValue, cv: AttributeValue, key: string): string {
    return copy.cell.replace("{row}", rv.label).replace("{col}", cv.label).replace("{state}", copy.state[cellState(key, ticks, manualX)]);
  }
  /** The cell's decorative glyph under the no-mix rule: prefer the column axis's glyph, else the
   *  row axis's - but only from an axis whose every value has art (else null -> green check). */
  function cellGlyph(rc: AttributeCategory, rv: AttributeValue, cc: AttributeCategory, cv: AttributeValue): string | null {
    if (glyphCats.has(cc.id) && cv.glyph) return cv.glyph;
    if (glyphCats.has(rc.id) && rv.glyph) return rv.glyph;
    return null;
  }
  function present(r: number, c: number): boolean {
    return !!layout.present[r]?.[c];
  }
  function focusActive() {
    const rl = rowLeaves[active.gr];
    const cl = colLeaves[active.gc];
    if (!rl || !cl) return;
    container?.querySelector<HTMLButtonElement>(`[data-cell-key="${keyOf(rl.cat, rl.v, cl.cat, cl.v)}"]`)?.focus();
  }
  function lastGc(gr: number): number {
    const r = rowLeaves[gr].axisIdx;
    let last = 0;
    colLeaves.forEach((cl, gc) => {
      if (present(r, cl.axisIdx)) last = gc;
    });
    return last;
  }
  function lastGr(gc: number): number {
    const c = colLeaves[gc].axisIdx;
    let last = 0;
    rowLeaves.forEach((rl, gr) => {
      if (present(rl.axisIdx, c)) last = gr;
    });
    return last;
  }
  function moveFrom(k: string) {
    let { gr, gc } = active;
    if (k === "ArrowRight") gc = Math.min(gc + 1, lastGc(gr));
    else if (k === "ArrowLeft") gc = Math.max(gc - 1, 0);
    else if (k === "ArrowDown") gr = Math.min(gr + 1, lastGr(gc));
    else if (k === "ArrowUp") gr = Math.max(gr - 1, 0);
    else return;
    active = { gr, gc };
    focusActive();
  }
</script>

<div bind:this={container} class="overflow-x-auto" aria-label={copy.heading}>
  <table class="table-fixed border-separate border-spacing-0 text-ink">
    <caption class="sr-only">{copy.mapHeading}</caption>
    <colgroup>
      <col style="width:1.75rem" />
      <col style="width:7rem" />
      {#each colLeaves as cl (cl.cat.id + cl.v.id)}<col style={`width:${size}px`} />{/each}
    </colgroup>
    <thead>
      <tr>
        <td colspan="2" rowspan="2" aria-hidden="true"></td>
        {#each layout.cols as cc (cc.id)}
          <th scope="colgroup" colspan={cc.values.length} class="border-b border-ink/15 px-1 pb-1 text-center text-xs font-semibold uppercase tracking-wide">{cc.label}</th>
        {/each}
      </tr>
      <tr>
        {#each colLeaves as cl (cl.cat.id + cl.v.id)}
          <th scope="col" class={`h-28 align-bottom pb-1 text-xs font-medium opacity-80 ${cl.lastInGroup ? "border-r-2 border-ink/15" : ""}`}>
            <span class="flex h-full flex-col items-center justify-end gap-1.5">
              <span class="[writing-mode:vertical-rl]">{cl.v.label}</span>
              {#if glyphCats.has(cl.cat.id) && cl.v.glyph}<GlyphSeat ref={cl.v.glyph} label={cl.v.label} d={Math.round(size * 0.62)} />{/if}
            </span>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each layout.rows as rc, r (rc.id)}
        {#each rc.values as rv, vi (rv.id)}
          <tr>
            {#if vi === 0}
              <th scope="rowgroup" rowspan={rc.values.length} class="border-r border-ink/15 text-xs font-semibold uppercase tracking-wide">
                <span class="mx-auto block rotate-180 [writing-mode:vertical-rl]">{rc.label}</span>
              </th>
            {/if}
            <th scope="row" class="whitespace-nowrap py-px pr-2 text-right text-xs font-medium">
              <span class="inline-flex items-center justify-end gap-1.5">
                {#if glyphCats.has(rc.id) && rv.glyph}<GlyphSeat ref={rv.glyph} label={rv.label} d={Math.round(size * 0.62)} />{/if}
                <span>{rv.label}</span>
              </span>
            </th>
            {#each layout.cols as cc, c (cc.id)}
              {#if layout.present[r][c]}
                {#each cc.values as cv (cv.id)}
                  {@const key = keyOf(rc, rv, cc, cv)}
                  {@const gr = grOf.get(rv) ?? 0}
                  {@const gc = gcOf.get(cv) ?? 0}
                  <td class="p-0 text-center">
                    <GridCell
                      cellKey={key}
                      block={`${rc.id}|${cc.id}`}
                      state={cellState(key, ticks, manualX)}
                      glyph={cellGlyph(rc, rv, cc, cv)}
                      ariaLabel={ariaAt(rv, cv, key)}
                      tabindex={gr === active.gr && gc === active.gc ? 0 : -1}
                      {size}
                      locked={game.locked}
                      ontap={() => {
                        active = { gr, gc };
                        game.gridCycle(key);
                      }}
                      ontick={() => {
                        active = { gr, gc };
                        game.gridCycle(key);
                      }}
                      onmove={moveFrom}
                    />
                  </td>
                {/each}
              {:else}
                <td colspan={cc.values.length} aria-hidden="true"></td>
              {/if}
            {/each}
          </tr>
        {/each}
      {/each}
    </tbody>
  </table>
</div>
