<script lang="ts">
  // DifficultyPicker: the in-place difficulty switcher (Flow A). A bottom sheet on phone
  // (centered card on desktop) listing every tier as a name + its TierMeter bars, the current
  // one ringed. This is where the level NAMES are taught (the badges elsewhere stay word-less);
  // picking one hands the tier back to the caller, which loads that tier's puzzle - lossless,
  // since each (date,tier,shape) keeps its own save slot. Scrim + Escape close. Transform/
  // opacity only (reduced-motion zeroes it via app.css). Mirrors the ResultCard overlay.
  import TierMeter from "./TierMeter.svelte";
  import type { DifficultyUi } from "../lib/config";

  let {
    current,
    difficulty,
    onpick,
    onclose,
  }: {
    current: string;
    difficulty: DifficultyUi;
    onpick: (tier: string) => void;
    onclose: () => void;
  } = $props();

  function onkey(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }
</script>

<svelte:window onkeydown={onkey} />

<div
  class="fixed inset-0 z-30 flex items-end justify-center sm:items-center"
  role="dialog"
  aria-modal="true"
  aria-label="choose difficulty"
>
  <button class="scrim absolute inset-0 bg-black/60" aria-label="close" onclick={onclose}></button>
  <div class="sheet relative w-full max-w-sm rounded-t-3xl border border-ink/10 bg-surface p-5 shadow-e4 sm:rounded-3xl">
    <p class="mb-3 text-center text-xs uppercase tracking-wide opacity-60">difficulty</p>
    <div class="flex flex-col gap-2">
      {#each difficulty.order as t (t)}
        <button
          class={`flex min-h-12 items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition-transform active:scale-[0.98] ${t === current ? "border-accent bg-bg" : "border-ink/10"}`}
          aria-current={t === current ? "true" : undefined}
          onclick={() => onpick(t)}
        >
          <span class="text-base font-semibold capitalize">{t}</span>
          <TierMeter tier={t} {difficulty} height={22} label={false} />
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .scrim {
    animation: scrim-in 180ms ease-out;
  }
  .sheet {
    animation: sheet-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  @keyframes scrim-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes sheet-in {
    from {
      transform: translateY(8%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>
