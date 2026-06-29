<script lang="ts">
  // Pool: the still-unplaced tokens of one fillable category. Drains as the player
  // commits deductions (core-loop.md). Tokens carry their glyph + label from the
  // manifest; selection drives the tap fallback. Chrome only; no inline SVG.
  import Token from "./Token.svelte";
  import type { Game } from "../state/play.svelte";

  let { game }: { game: Game } = $props();
  const b = $derived(game.board);

  function glyphOf(cat: string, value: string): string {
    return b.values[cat].find((v) => v.id === value)?.glyph ?? "";
  }
  function labelOf(cat: string, value: string): string {
    return b.values[cat].find((v) => v.id === value)?.label ?? value;
  }
</script>

<div class="flex flex-col gap-3">
  {#each b.columns as col (col.id)}
    <div class="flex flex-wrap items-center gap-2">
      {#each game.remaining(col.id) as v (v)}
        <Token
          ref={glyphOf(col.id, v)}
          label={labelOf(col.id, v)}
          selected={game.selected?.cat === col.id && game.selected?.value === v}
          onpick={() => game.tapToken(col.id, v)}
          ondrop={(e, c) => c === col.id && game.place(e, c, v)}
        />
      {/each}
    </div>
  {/each}
</div>
