<script lang="ts">
  // Generic, metadata-driven glyph loader. The ONLY component that renders a glyph;
  // no per-glyph bespoke SVG anywhere (CLAUDE.md #10, ui-shell.md). Vector file by ref.
  // `size` is the square box edge in px; object-contain letterboxes ANY aspect inside that
  // box (and the explicit style width+height beat Tailwind Preflight's `img{height:auto}`),
  // so even a tall illustration can never overflow the Puck's safe area. `fill` instead makes
  // the glyph cover the parent's content box edge-to-edge - the flag CHIP (Puck.svelte) uses
  // it so a landscape flag fills its rounded-rect instead of being letterboxed. Throws on
  // unknown ref.
  import { glyphPath } from "./glyphs";

  let { ref, label = "", size = 24, fill = false }: { ref: string; label?: string; size?: number; fill?: boolean } = $props();
</script>

{#if fill}
  <img class="block h-full w-full object-cover" src={glyphPath(ref)} alt={label} draggable={false} />
{:else}
  <img
    class="inline-block align-middle object-contain"
    src={glyphPath(ref)}
    alt={label}
    draggable={false}
    style={`width:${size}px;height:${size}px`}
  />
{/if}
