<script lang="ts">
  // SlotBoard: one skin per shape topology, chosen by the registry (no per-shape code).
  // matrix -> rows = entities, columns = anchor header + fillable categories. linear ->
  // seats laid left-to-right, each a fixed seat-number header above its fillable slots.
  // Value->glyph/label derives from the manifest (no hardcode). Cells are generic Slots;
  // grid layout is chrome (Tailwind), glyphs are the only images. transform/opacity only.
  import Slot from "./Slot.svelte";
  import Glyph from "../lib/Glyph.svelte";
  import { anchorValue } from "../lib/board";
  import type { Topology } from "../lib/shapes";
  import type { Game } from "../state/play.svelte";

  let {
    game,
    topology = "matrix",
    revealed = true,
    pulse = false,
  }: { game: Game; topology?: Topology; revealed?: boolean; pulse?: boolean } = $props();
  const b = $derived(game.board);

  function glyphOf(cat: string, value: string): string {
    return b.values[cat].find((v) => v.id === value)?.glyph ?? "";
  }
  function labelOf(cat: string, value: string): string {
    return b.values[cat].find((v) => v.id === value)?.label ?? value;
  }
</script>

{#if topology === "linear"}
  <div class="flex gap-2 overflow-x-auto pb-1">
    {#each b.entities as e, i (e)}
      <div class="flex flex-col items-center gap-2">
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
          <Glyph ref={anchorValue(b.anchor, i).glyph} label={anchorValue(b.anchor, i).label} size={24} />
        </div>
        {#each b.columns as col (col.id)}
          {@const v = game.placements[e]?.[col.id] ?? null}
          <Slot
            entity={e}
            cat={col.id}
            glyph={v ? glyphOf(col.id, v) : null}
            label={v ? labelOf(col.id, v) : ""}
            state={revealed ? game.evalState.rows[e] : v ? "near" : "empty"}
            pulse={pulse && !v}
            locked={game.locked}
            ontap={() => game.tapSlot(e, col.id)}
          />
        {/each}
      </div>
    {/each}
  </div>
{:else}
  <div class="grid gap-2" style={`grid-template-columns: repeat(${b.columns.length + 1}, auto)`}>
    <div></div>
    {#each b.columns as col (col.id)}
      <div class="text-center text-xs uppercase tracking-wide opacity-70">{col.label}</div>
    {/each}
    {#each b.entities as e, i (e)}
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
        <Glyph ref={anchorValue(b.anchor, i).glyph} label={anchorValue(b.anchor, i).label} size={24} />
      </div>
      {#each b.columns as col (col.id)}
        {@const v = game.placements[e]?.[col.id] ?? null}
        <Slot
          entity={e}
          cat={col.id}
          glyph={v ? glyphOf(col.id, v) : null}
          label={v ? labelOf(col.id, v) : ""}
          state={revealed ? game.evalState.rows[e] : v ? "near" : "empty"}
          pulse={pulse && !v}
          locked={game.locked}
          ontap={() => game.tapSlot(e, col.id)}
        />
      {/each}
    {/each}
  </div>
{/if}
