<script lang="ts">
  // Generic, metadata-driven glyph loader. The ONLY component that renders a glyph;
  // no per-glyph bespoke SVG anywhere (CLAUDE.md #10, ui-shell.md). Vector file by ref.
  // `size` is the square box edge in px; object-contain letterboxes ANY aspect inside that
  // box (and the explicit style width+height beat Tailwind Preflight's `img{height:auto}`),
  // so even a tall illustration can never overflow the Puck's safe area. Throws on unknown ref.
  import { glyphPath } from "./glyphs";

  let { ref, label = "", size = 24 }: { ref: string; label?: string; size?: number } = $props();
</script>

<img
  class="inline-block align-middle object-contain"
  src={glyphPath(ref)}
  alt={label}
  style={`width:${size}px;height:${size}px`}
/>
