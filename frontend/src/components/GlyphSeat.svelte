<script lang="ts">
  // GlyphSeat: a fixed circular frame that seats ANY value glyph at a safe-area inset, so a
  // grid axis of heterogeneous-source art (a tight-artboard dog next to a padded cat) reads
  // as one aligned set. This is the Puck principle (fixed frame + inset normalizes the chaos)
  // at header scale - a static, context-free primitive, so it carries none of Puck's token
  // sizing or state-ring / chip baggage that a header must not inherit. Used on BOTH axes of
  // BOTH grids (GridMatrix + NotesGrid) so every animal/crop circle lands identically, phone
  // and desktop. `d` is the circle diameter in px, derived by the caller from the grid cell
  // size (no hardcoded px - Holy Law #6). Glyph.svelte stays the only image renderer.
  // See docs/concepts/ui-shell.md (Puck), GridMatrix.svelte, NotesGrid.svelte.
  import Glyph from "../lib/Glyph.svelte";

  // 0.64 = the medium Puck inset (config/ui.json [puck].medium.glyph); < 0.707 keeps the
  // glyph clear of the rim for any aspect ratio, so no circle ever looks crowded.
  const INSET = 0.64;

  let { ref, label = "", d = 24 }: { ref: string; label?: string; d?: number } = $props();
</script>

<span
  class="grid shrink-0 place-items-center rounded-full bg-surface ring-1 ring-ink/10"
  style={`width:${d}px;height:${d}px`}
>
  <Glyph {ref} {label} size={Math.round(d * INSET)} />
</span>
