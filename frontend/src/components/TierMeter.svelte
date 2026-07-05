<script lang="ts">
  // TierMeter: a difficulty (tier) drawn as ascending bars - `rank` filled out of the total,
  // rising in height so the LEVEL is carried by the bar COUNT + staircase shape (a non-colour
  // signal), which lets the word be dropped from the badge (colour-is-one-signal, ui-shell.md).
  // Config-driven: order gives the rank, colors gives the per-tier fill colour (config/ui.json
  // [difficulty]) - the cross-app standardized ramp. Pure chrome - tokenized <span> bars (the
  // ResultCard progress-bar precedent), never an SVG icon, so Holy Law #10 is untouched.
  import type { DifficultyUi } from "../lib/config";

  let {
    tier,
    difficulty,
    height = 16,
    label = true,
  }: { tier: string; difficulty: DifficultyUi; height?: number; label?: boolean } = $props();

  const total = $derived(difficulty.order.length);
  const rank = $derived(difficulty.order.indexOf(tier) + 1);
  const color = $derived(difficulty.colors[tier] ?? "var(--accent)");
</script>

<span
  class="inline-flex items-end gap-[3px]"
  style={`height:${height}px`}
  role="img"
  aria-label={label ? `difficulty ${tier}, ${rank} of ${total}` : undefined}
>
  {#each difficulty.order as t, i (t)}
    <span
      class="w-[4px] rounded-[2px]"
      class:opacity-20={i >= rank}
      style={`height:${Math.round(((i + 1) / total) * 100)}%;background-color:${i < rank ? color : "var(--ink)"}`}
    ></span>
  {/each}
</span>
