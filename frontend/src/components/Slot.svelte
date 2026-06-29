<script lang="ts">
  // Slot: one fillable cell. Drop target (data attrs read by drag.ts hit-test) and a
  // tap target for the fallback. State ring is the only feedback: satisfy/violate/near
  // via transform+opacity, colour-is-one-signal (ui-shell.md). No solution shown.
  import Glyph from "../lib/Glyph.svelte";
  import type { RowState } from "../lib/validate";

  let {
    entity,
    cat,
    glyph = null,
    label = "",
    state = "empty",
    pulse = false,
    locked = false,
    ontap,
  }: {
    entity: string;
    cat: string;
    glyph?: string | null;
    label?: string;
    state?: RowState;
    pulse?: boolean;
    locked?: boolean;
    ontap: () => void;
  } = $props();
</script>

<button
  data-slot-entity={entity}
  data-slot-cat={cat}
  aria-label={glyph ? label : `empty ${cat}`}
  onclick={ontap}
  class={`flex h-12 w-12 items-center justify-center rounded-2xl border-2 transition-transform duration-150 ${locked ? "bg-accent/20" : "bg-surface"} ${state === "satisfy" ? "border-satisfy" : state === "violate" ? "border-violate" : state === "near" ? "border-near" : "border-ink/25"} ${pulse ? "animate-pulse" : ""}`}
>
  {#if glyph}<Glyph ref={glyph} {label} size={28} />{/if}
</button>
