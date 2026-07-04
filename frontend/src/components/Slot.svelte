<script lang="ts">
  // Slot: one fillable cell, rendered as a Puck. Drop target (data attrs read by drag.ts
  // for hit-test + magnet) and a tap target for the fallback. Empty = an outlined circle;
  // filled = the placed glyph. The state ring (satisfy/violate/near) is the only feedback,
  // colour-is-one-signal (ui-shell.md). No solution shown. Size scales from config via Puck.
  import Puck from "./Puck.svelte";
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
  class={`flex place-self-center items-center justify-center rounded-full transition-transform duration-150 ${pulse ? "animate-pulse" : ""}`}
>
  <Puck ref={glyph} {label} {state} {locked} />
</button>
