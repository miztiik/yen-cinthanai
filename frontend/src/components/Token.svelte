<script lang="ts">
  // Pool token: a draggable + tappable Puck. Drag follows on the compositor (drag.ts) and a
  // config-driven magnet snaps it to the nearest slot of its category; tap selects for the
  // tap-token-then-tap-slot fallback. Chrome is the Puck; the glyph is the sole image.
  import Puck from "./Puck.svelte";
  import { draggable, type DragHandlers } from "../lib/drag";
  import { getContext } from "svelte";
  import type { PuckPreset } from "../lib/config";

  let {
    ref,
    label,
    cat,
    selected = false,
    onpick,
    ondrop,
  }: {
    ref: string;
    label: string;
    cat: string;
    selected?: boolean;
    onpick: () => void;
    ondrop: (entity: string, cat: string) => void;
  } = $props();

  const getSize = getContext<() => PuckPreset>("puckSize");
  const getSnap = getContext<() => { radius_factor: number; ease: number }>("snap");

  // Magnet capture radius scales with the puck diameter (config/ui.toml [snap]).
  const handlers = $derived.by<DragHandlers>(() => {
    const snapCfg = getSnap?.();
    const diameter = getSize?.()?.diameter ?? 60;
    return {
      cat,
      onTap: () => onpick(),
      onDrop: (e, c) => ondrop(e, c),
      snap: snapCfg ? { radius: diameter * snapCfg.radius_factor, ease: snapCfg.ease } : undefined,
    };
  });
</script>

<button
  use:draggable={handlers}
  aria-pressed={selected}
  aria-label={label}
  class="touch-none select-none rounded-full transition-transform active:scale-95"
>
  <Puck {ref} {label} {selected} />
</button>
