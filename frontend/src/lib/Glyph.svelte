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

  // `tint` renders the glyph as a CSS mask filled with currentColor (theme-tinted mono
  // chrome icons - the ui.* pack), so a gear/flame/star adopts text-ink/gold/accent and dims
  // via opacity, unlike a plain <img> which cannot recolour. Content glyphs stay <img>.
  let { ref, label = "", size = 24, fill = false, tint = false }: { ref: string; label?: string; size?: number; fill?: boolean; tint?: boolean } = $props();
</script>

{#if tint}
  <span
    class="inline-block shrink-0 align-middle"
    role="img"
    aria-label={label || undefined}
    aria-hidden={label ? undefined : "true"}
    style={`width:${size}px;height:${size}px;background-color:currentColor;-webkit-mask:url('${glyphPath(ref)}') center/contain no-repeat;mask:url('${glyphPath(ref)}') center/contain no-repeat`}
  ></span>
{:else if fill}
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
