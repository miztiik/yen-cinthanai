<script lang="ts">
  // SlotBoard: one skin per shape topology, chosen by the registry (no per-shape code).
  // matrix -> rows = entities, columns = anchor header + fillable categories. linear ->
  // seats laid left-to-right. circular -> seats on a ring, adjacency wraps and clues
  // stay in the flat panel (never on the ring); tapping a seat overlays wrap arcs for
  // opposite/between. Value->glyph/label derives from the manifest (no hardcode). Cells
  // are generic Slots; layout is chrome (Tailwind); glyphs are the only images.
  import Slot from "./Slot.svelte";
  import Glyph from "../lib/Glyph.svelte";
  import { anchorValue, ringSeats } from "../lib/board";
  import type { Topology } from "../lib/shapes";
  import type { Game } from "../state/play.svelte";

  let {
    game,
    topology = "matrix",
    revealed = true,
    pulse = false,
  }: { game: Game; topology?: Topology; revealed?: boolean; pulse?: boolean } = $props();
  const b = $derived(game.board);
  let arcSeat = $state<number | null>(null); // seat whose wrap links are shown (tap)

  function glyphOf(cat: string, value: string): string {
    return b.values[cat].find((v) => v.id === value)?.glyph ?? "";
  }
  function labelOf(cat: string, value: string): string {
    return b.values[cat].find((v) => v.id === value)?.label ?? value;
  }
  const seats = $derived(ringSeats(b.entities.length)); // seat centres (0..1 box)
  // Arc chords for the tapped seat: opposite/between clues that name its position value.
  const arcs = $derived.by(() => {
    if (arcSeat === null) return [] as { x1: number; y1: number; x2: number; y2: number }[];
    const seatOf = (v: string) => b.anchor.values.findIndex((a) => a.id === v);
    const out: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (const k of game.m.constraints) {
      if (k.type !== "opposite" && k.type !== "between") continue;
      const ix = k.operands.map((o) => seatOf(o.value)).filter((p) => p >= 0);
      if (!ix.includes(arcSeat)) continue;
      const c = seats[arcSeat];
      for (const p of ix) if (p !== arcSeat) out.push({ x1: c.x, y1: c.y, x2: seats[p].x, y2: seats[p].y });
    }
    return out;
  });
</script>

{#if topology === "circular"}
  <div class="relative h-72 w-72 sm:h-80 sm:w-80">
    <svg viewBox="0 0 1 1" class="pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-150" style:opacity={arcs.length ? 1 : 0}>
      {#each arcs as a (a.x2 + "" + a.y2)}<line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="currentColor" stroke-width="0.012" stroke-linecap="round" class="text-accent" />{/each}
    </svg>
    {#each b.entities as e, i (e)}
      {@const c = seats[i]}
      <div class="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1" style={`left:${c.x * 100}%;top:${c.y * 100}%`}>
        <button class="flex h-11 w-11 items-center justify-center rounded-full bg-surface" aria-label={`seat ${i + 1}`} onclick={() => (arcSeat = arcSeat === i ? null : i)}>
          <Glyph ref={anchorValue(b.anchor, i).glyph} label={anchorValue(b.anchor, i).label} size={22} />
        </button>
        {#each b.columns as col (col.id)}
          {@const v = game.placements[e]?.[col.id] ?? null}
          <Slot entity={e} cat={col.id} glyph={v ? glyphOf(col.id, v) : null} label={v ? labelOf(col.id, v) : ""}
            state={revealed ? game.evalState.rows[e] : v ? "near" : "empty"} pulse={pulse && !v} locked={game.locked} ontap={() => game.tapSlot(e, col.id)} />
        {/each}
      </div>
    {/each}
  </div>
{:else if topology === "linear"}
  <div class="flex gap-2 overflow-x-auto pb-1">
    {#each b.entities as e, i (e)}
      <div class="flex flex-col items-center gap-2">
        <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface">
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
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface">
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
