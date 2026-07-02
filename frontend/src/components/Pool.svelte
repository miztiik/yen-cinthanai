<script lang="ts">
  // Pool: the still-unplaced tokens of one fillable category. Drains as the player
  // commits deductions (core-loop.md). Tokens carry their glyph + label from the
  // manifest; selection drives the tap fallback. Chrome only; no inline SVG. In the
  // story-first grid mode the bijective categories live in the cross-out grid, so `only`
  // can narrow the pool to just the shared-cardinality tokens (Row 7, Decision 7).
  import Token from "./Token.svelte";
  import type { Game } from "../state/play.svelte";

  let { game, only }: { game: Game; only?: "shared" | "bijective" } = $props();
  const b = $derived(game.board);
  const cols = $derived(
    only ? b.columns.filter((c) => (only === "shared") === (c.cardinality === "shared")) : b.columns,
  );

  function glyphOf(cat: string, value: string): string {
    return b.values[cat].find((v) => v.id === value)?.glyph ?? "";
  }
  function labelOf(cat: string, value: string): string {
    return b.values[cat].find((v) => v.id === value)?.label ?? value;
  }
</script>

<div class="flex flex-col gap-3">
  {#each cols as col (col.id)}
    <div class="flex flex-wrap items-center gap-2">
      {#each game.remaining(col.id) as v (v)}
        <Token
          ref={glyphOf(col.id, v)}
          label={labelOf(col.id, v)}
          cat={col.id}
          selected={game.selected?.cat === col.id && game.selected?.value === v}
          onpick={() => game.tapToken(col.id, v)}
          ondrop={(e, c) => c === col.id && game.place(e, c, v)}
        />
      {/each}
    </div>
  {/each}
</div>
