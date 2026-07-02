<script lang="ts">
  // GridMap: the read-only overview of EVERY block at once (Jony: the full grid is too
  // dense to EDIT on a phone, but a glanceable map is the navigator). Each block is a tap
  // target that opens it in the NotesGrid editor; inside, a mini matrix paints each cell's
  // derived state (grid.ts) as a colour chip - colour encodes STATE not category: accent =
  // tick, ink = manual-X, dim ink = auto-X, faint = blank. No editing here, no drag; the
  // block buttons are the only interactive elements. Chrome only. See ui-shell.md.
  import { blockCells, cellState, type GridBlock } from "../lib/grid";
  import type { GridCopy } from "../lib/config";
  import type { Game } from "../state/play.svelte";

  let {
    game,
    blocks,
    active,
    copy,
    onselect,
  }: {
    game: Game;
    blocks: GridBlock[];
    active: number;
    copy: GridCopy;
    onselect: (index: number) => void;
  } = $props();

  const ticks = $derived(new Set(Object.keys(game.gridTicks)));
  const manualX = $derived(new Set(Object.keys(game.gridManualX)));

  function chip(mark: string): string {
    if (mark === "tick") return "bg-accent";
    if (mark === "manualX") return "bg-ink";
    if (mark === "autoX") return "bg-ink/40";
    return "bg-ink/10";
  }
  function label(b: GridBlock): string {
    return copy.openBlock.replace("{row}", b.rowCat.label).replace("{col}", b.colCat.label);
  }
</script>

<section class="flex flex-col gap-2" aria-label={copy.mapHeading}>
  <h2 class="text-xs font-semibold uppercase tracking-wide opacity-60">{copy.mapHeading}</h2>
  <div class="flex flex-wrap gap-2">
    {#each blocks as b, i (b.id)}
      <button
        type="button"
        aria-label={label(b)}
        aria-current={i === active ? "true" : undefined}
        onclick={() => onselect(i)}
        class={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${i === active ? "border-accent bg-accent/10" : "border-ink/15 bg-surface"}`}
      >
        <span class="grid gap-px" style={`grid-template-columns: repeat(${b.colCat.values.length}, 0.5rem)`} aria-hidden="true">
          {#each blockCells(b) as cell (cell.key)}
            <span class={`h-2 w-2 rounded-[2px] ${chip(cellState(cell.key, ticks, manualX))}`}></span>
          {/each}
        </span>
        <span class="max-w-[6rem] truncate text-[0.65rem] leading-tight opacity-70">{b.rowCat.label}/{b.colCat.label}</span>
      </button>
    {/each}
  </div>
</section>
