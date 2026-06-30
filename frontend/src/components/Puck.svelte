<script lang="ts">
  // The Puck: one circular frame for every token, filled slot, and seat. Icons come from
  // many sources with different sizes/weights; sitting each inside a standard circle at a
  // safe-area inset normalizes the visual chaos into one "game piece". Size is config-driven
  // (config/ui.toml -> save.settings.puckSize, S/M/L) and provided by the Board via context,
  // so the circle AND the glyph scale together - no hardcoded px. The state ring sits in the
  // border so it never reflows the grid. Glyph.svelte stays the only image renderer.
  import { getContext } from "svelte";
  import Glyph from "../lib/Glyph.svelte";
  import type { PuckPreset } from "../lib/config";
  import type { RowState } from "../lib/validate";

  let {
    ref = null,
    label = "",
    state = "empty",
    selected = false,
    locked = false,
  }: {
    ref?: string | null;
    label?: string;
    state?: RowState;
    selected?: boolean;
    locked?: boolean;
  } = $props();

  const FALLBACK: PuckPreset = { diameter: 60, glyph: 0.64 };
  const getSize = getContext<() => PuckPreset>("puckSize");
  const size = $derived(getSize?.() ?? FALLBACK);
  const glyphPx = $derived(Math.round(size.diameter * size.glyph));

  const ring = $derived.by(() => {
    if (selected) return "border-accent";
    if (state === "satisfy") return "border-satisfy";
    if (state === "violate") return "border-violate";
    if (state === "near") return "border-near";
    if (!ref) return "border-dashed border-ink/30"; // empty slot: dashed + visible drop target
    return "border-ink/15"; // a resting placed piece
  });
</script>

<span
  class={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${ring} ${locked ? "bg-accent/20" : "bg-surface"}`}
  style={`width:${size.diameter}px;height:${size.diameter}px`}
>
  {#if ref}<Glyph {ref} {label} size={glyphPx} />{/if}
</span>
