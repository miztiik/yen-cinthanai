<script lang="ts">
  // Generic, metadata-driven glyph loader. The ONLY component that renders a glyph;
  // no per-glyph bespoke SVG anywhere (CLAUDE.md #10, ui-shell.md). Vector file by
  // ref; size is the box edge in px. Throws via glyphPath on an unknown ref.
  import { glyphPath } from "./glyphs";

  let { ref, label = "", size = 24 }: { ref: string; label?: string; size?: number } = $props();
</script>

<img class="inline-block align-middle" src={glyphPath(ref)} alt={label} width={size} height={size} />
