<script lang="ts">
  // SlotBoard: rows = entities, columns = anchor header (fixed identity) + fillable
  // categories. Value->glyph/label derives from the manifest (no hardcode). Cells are
  // generic Slots; the anchor cell shows the row's ordinal glyph as a label, never a
  // leak. Grid layout is chrome (Tailwind); the glyphs are the only images.
  import Slot from "./Slot.svelte";
  import Glyph from "../lib/Glyph.svelte";
  import { anchorValue } from "../lib/board";
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
        state={game.evalState.rows[e]}
        locked={game.locked}
        ontap={() => game.tapSlot(e, col.id)}
      />
    {/each}
  {/each}
</div>
