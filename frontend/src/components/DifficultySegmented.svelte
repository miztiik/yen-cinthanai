<script lang="ts">
  // DifficultySegmented: the desktop inline difficulty switch (a segmented control) - one
  // segment per tier over difficulty.order, each showing its TierMeter bars + name, the
  // current one raised and inked in its standardized ramp colour (difficulty.colors[tier]).
  // Picking a segment hands the tier back to the caller, which navigates to that tier's
  // puzzle (no modal on desktop; the phone keeps the DifficultyPicker sheet). Pure chrome:
  // tokenized bars (TierMeter), transform/opacity only (Holy Law #2, #10). A radiogroup with
  // aria-checked/aria-current so a screen reader reads it as a single choice. See ui-shell.md.
  import TierMeter from "./TierMeter.svelte";
  import type { DifficultyUi } from "../lib/config";

  let {
    current,
    difficulty,
    onpick,
  }: { current: string; difficulty: DifficultyUi; onpick: (tier: string) => void } = $props();
</script>

<div
  class="inline-flex items-center gap-0.5 rounded-full border border-ink/10 bg-ink/5 p-0.5"
  role="radiogroup"
  aria-label="difficulty"
>
  {#each difficulty.order as t (t)}
    <button
      class={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${t === current ? "bg-surface shadow-e1" : "opacity-60 hover:opacity-100"}`}
      role="radio"
      aria-checked={t === current}
      aria-current={t === current ? "true" : undefined}
      aria-label={`difficulty ${t}`}
      style={t === current ? `color:${difficulty.colors[t] ?? "var(--accent)"}` : ""}
      onclick={() => onpick(t)}
    >
      <TierMeter tier={t} {difficulty} height={12} label={false} />
      <span>{t}</span>
    </button>
  {/each}
</div>
