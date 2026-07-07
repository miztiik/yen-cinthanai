<script lang="ts">
  // AttemptRing: the tries-left resource drawn as `total` DISCRETE arc wedges forming a ring -
  // one arc per life (small gaps between arcs, NOT a continuous donut). A lit arc (i < left) is
  // coloured by URGENCY - full green (satisfy), middle amber (near), last-life red (violate,
  // which takes precedence over full so a single-arc Expert ring reads red); a spent arc
  // (i >= left) dims to ink. When an arc is burned its opacity fades over `fadeMs`
  // (chrome.attemptFadeMs), transform/opacity ONLY so the compositor stays cheap (Holy Law #2);
  // the urgency RECOLOUR of the survivors SNAPS (a discrete one-paint event - never a per-frame
  // colour / filter / stroke-dashoffset tween, Carmack veto). Reduced-motion zeroes the fade
  // (app.css [data-motion=reduce] !important, no per-component query). role=img carries the
  // count for a screen reader (colour never alone). Pure tokenized SVG; the urgency ramp is
  // config-driven (chrome.attemptColors, the difficulty.colors precedent), no hardcoded hex in
  // markup (Holy Laws #6/#10). The caller hides this for an unlimited tier (total < 0). Distinct
  // from the plain-digit timer beside it (discrete arcs vs digits - Palm's flag). See
  // BoardHeader.svelte, docs/concepts/ui-shell.md.
  let {
    left,
    total,
    fadeMs = 150,
    colors = { full: "#22c55e", mid: "#f59e0b", low: "#ef4444" },
  }: {
    left: number;
    total: number;
    fadeMs?: number;
    colors?: { full: string; mid: string; low: string };
  } = $props();

  const R = 15; // arc radius in the 36x36 viewBox
  const C = 18; // centre
  const GAP = 32; // degrees of gap between adjacent arcs (reads as clearly discrete wedges)

  function pt(angle: number): string {
    const a = ((angle - 90) * Math.PI) / 180; // 0deg = 12 o'clock, sweeping clockwise
    return `${(C + R * Math.cos(a)).toFixed(2)} ${(C + R * Math.sin(a)).toFixed(2)}`;
  }
  function arc(i: number, n: number): string {
    const slot = 360 / n;
    const a0 = i * slot + GAP / 2;
    const a1 = (i + 1) * slot - GAP / 2;
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M${pt(a0)}A${R} ${R} 0 ${large} 1 ${pt(a1)}`;
  }

  const arcs = $derived(Array.from({ length: Math.max(0, total) }, (_, i) => arc(i, total)));
  // Urgency colour of a LIT arc (snaps; never tweened). last-life (left===1) beats full so an
  // Expert single arc reads red; full (left===total) is green; anything between is amber.
  const litColor = $derived(left === 1 ? colors.low : left >= total ? colors.full : colors.mid);
</script>

<span
  class="relative inline-grid shrink-0 place-items-center"
  style="width:26px;height:26px"
  role="img"
  aria-label={`${left} of ${total} attempts left`}
>
  <svg viewBox="0 0 36 36" class="col-start-1 row-start-1 h-full w-full" aria-hidden="true">
    {#each arcs as d, i (i)}
      <path
        {d}
        fill="none"
        stroke-width="4"
        stroke-linecap="round"
        class="transition-opacity"
        class:opacity-20={i >= left}
        style={`stroke:${i < left ? litColor : "var(--ink)"};transition-duration:${fadeMs}ms`}
      ></path>
    {/each}
  </svg>
  <span
    class="col-start-1 row-start-1 select-none text-[10px] font-bold leading-none tabular-nums text-ink"
    aria-hidden="true">{left}</span
  >
</span>
