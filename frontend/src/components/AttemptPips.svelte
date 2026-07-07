<script lang="ts">
  // AttemptPips: the tries-left resource drawn as a row of dots - `total` pips, the leading
  // `left` filled and the trailing spent ones dimmed - so the count reads at a glance and a
  // burned attempt visibly depletes (opacity only, compositor-cheap, Holy Law #2). Replaces
  // the mis-reading ui.target crosshair + number. Pure chrome: tokenized <span> dots (the
  // TierMeter precedent), never an SVG glyph, so Holy Law #10 is untouched. The caller hides
  // this entirely for an unlimited tier (total < 0). See BoardHeader.svelte, ui-shell.md.
  let { left, total }: { left: number; total: number } = $props();
</script>

<span class="inline-flex items-center gap-1" role="img" aria-label={`${left} of ${total} attempts left`}>
  {#each Array.from({ length: total }) as _, i (i)}
    <span
      class="h-2 w-2 rounded-full bg-ink transition-opacity"
      class:opacity-70={i < left}
      class:opacity-20={i >= left}
    ></span>
  {/each}
</span>
