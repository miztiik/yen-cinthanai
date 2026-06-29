<script lang="ts">
  // Pool token: a draggable + tappable glyph chip. Drag follows on the compositor
  // (drag.ts), tap selects for the tap-token-then-tap-slot fallback. Chrome is
  // Tailwind; the glyph is the sole image. transform/opacity only.
  import Glyph from "../lib/Glyph.svelte";
  import { draggable, type DragHandlers } from "../lib/drag";

  let {
    ref,
    label,
    selected = false,
    onpick,
    ondrop,
  }: {
    ref: string;
    label: string;
    selected?: boolean;
    onpick: () => void;
    ondrop: (entity: string, cat: string) => void;
  } = $props();

  const handlers: DragHandlers = { onTap: () => onpick(), onDrop: (e, c) => ondrop(e, c) };
</script>

<button
  use:draggable={handlers}
  aria-pressed={selected}
  aria-label={label}
  class="touch-none select-none flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-ink transition-[outline] duration-150 active:scale-95"
  class:outline={selected}
  class:outline-2={selected}
  class:outline-accent={selected}
>
  <Glyph {ref} {label} size={28} />
</button>
