<script lang="ts">
  // The Puck: one circular frame for every token, filled slot, and seat. Icons come from
  // many sources with different sizes/weights; sitting each inside a standard circle at a
  // safe-area inset normalizes the visual chaos into one "game piece". Size is config-driven
  // (config/ui.toml -> save.settings.puckSize, S/M/L) and provided by the Board via context,
  // so the circle AND the glyph scale together - no hardcoded px. The state ring sits in the
  // border so it never reflows the grid. Glyph.svelte stays the only image renderer.
  import { getContext } from "svelte";
  import Glyph from "../lib/Glyph.svelte";
  import { isChipRef } from "../lib/glyphs";
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
  // A flags-pack glyph is landscape (4:3): render it as a rounded-rect CHIP that hugs the
  // flag edge-to-edge, not the circular crop that would letterbox it. Same width as a puck
  // (keeps grid + pool alignment) but 3:4 as tall. Pack-driven - no per-country logic.
  const chip = $derived(ref != null && isChipRef(ref));
  const chipH = $derived(Math.round((size.diameter * 3) / 4));

  const ring = $derived.by(() => {
    if (selected) return "border-accent";
    if (state === "satisfy") return "border-satisfy";
    if (state === "violate") return "border-violate";
    if (state === "near") return "border-near";
    if (!ref) return "border-dashed border-ink/30"; // empty slot: dashed + visible drop target
    return "border-ink/15"; // a resting placed piece
  });
</script>

{#if chip}
  <span
    class={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border-2 ${ring} ${locked ? "bg-accent/20" : "bg-surface"}`}
    style={`width:${size.diameter}px;height:${chipH}px`}
  >
    {#if ref}<Glyph {ref} {label} fill />{/if}
  </span>
{:else}
  <span
    class={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 ${ring} ${locked ? "bg-accent/20" : "bg-surface"}`}
    style={`width:${size.diameter}px;height:${size.diameter}px`}
  >
    {#if ref}<Glyph {ref} {label} size={glyphPx} />{/if}
  </span>
{/if}
