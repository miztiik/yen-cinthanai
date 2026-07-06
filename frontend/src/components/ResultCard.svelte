<script lang="ts">
  // Held end-card (screenshot-ready): win / hero / fail. Never auto-dismisses; the
  // player taps to leave. Shows bag phrase, star bar, time/wrong/hints/streak, and a
  // spoiler-safe progress bar (stars only - no slot data). Hero = gold tint + crown.
  // SHARE copies the spoiler-free string and toasts. transform/opacity only; reduced
  // motion handled globally via app.css. See ui-shell.md, schemas.md (ShareCard).
  import Glyph from "../lib/Glyph.svelte";
  import AnswerSummary from "./AnswerSummary.svelte";
  import type { AnswerGrid } from "../lib/answer";
  import { play } from "../lib/audio";

  let {
    variant = "win",
    hero = false,
    phrase,
    stars,
    solveMs,
    hintsUsed,
    wrong,
    streak,
    shapeGlyph,
    share,
    answer,
    answerHeading = "Solution",
    answerCaption,
    onhome,
    onstats,
    onretry,
    ondismiss,
  }: {
    variant?: "win" | "fail";
    hero?: boolean;
    phrase: string;
    stars: number;
    solveMs: number;
    hintsUsed: number;
    wrong: number;
    streak: number;
    shapeGlyph: string;
    share: string;
    answer?: AnswerGrid;
    answerHeading?: string;
    answerCaption?: string;
    onhome: () => void;
    onstats: () => void;
    onretry?: () => void;
    ondismiss?: () => void;
  } = $props();

  let copied = $state(false);
  const secs = $derived(Math.max(0, Math.round(solveMs / 1000)));

  async function copyShare() {
    play("win");
    const text = share;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      // Clipboard blocked (insecure ctx): keep the card; nothing to leak.
      copied = true;
    }
    setTimeout(() => (copied = false), 1600);
  }

  // Held card, but never a trap: Escape (and a tap on the scrim) dismisses it to review the
  // board underneath, mirroring DifficultyPicker/DisplaySheet. home/stats/retry/share stay.
  function onkey(e: KeyboardEvent) {
    if (e.key === "Escape") ondismiss?.();
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="fixed inset-0 z-20 flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label={variant === "win" ? "solved" : "result"}>
  <button class="absolute inset-0 bg-black/70" aria-label="close" onclick={() => ondismiss?.()}></button>
  <div
    class="relative flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl border border-ink/10 bg-surface p-8 text-center shadow-e4"
    class:ring-4={hero}
    class:ring-gold={hero}
  >
    {#if hero}<p class="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gold" aria-label="new best"><Glyph ref="ui.crown" size={14} tint />personal best</p>{/if}
    <Glyph ref={shapeGlyph} label="result" size={48} />
    <p class="flex gap-1.5" class:text-gold={hero} class:text-accent={!hero} aria-label={`${stars} of 3 stars`}>
      {#each [1, 2, 3] as s (s)}<span class:opacity-20={stars < s} class:text-ink={stars < s}><Glyph ref="ui.star" size={26} tint /></span>{/each}
    </p>
    <p class="text-2xl font-bold" class:text-gold={hero}>{phrase}</p>

    <div class="flex w-full justify-around text-sm tabular-nums opacity-80">
      <span aria-label="time">{secs}s</span>
      <span aria-label={`${wrong} wrong`}>{wrong} wrong</span>
      <span aria-label={`${hintsUsed} hints`}>{hintsUsed} hints</span>
      <span class="flex items-center gap-1" aria-label={`streak ${streak}`}><span class="text-near"><Glyph ref="ui.flame" size={14} tint /></span>{streak}</span>
    </div>

    <!-- spoiler-safe progress: stars only, never a slot. -->
    <div class="flex w-full gap-1" aria-hidden="true">
      {#each [1, 2, 3] as s (s)}
        <div class="h-2 flex-1 rounded-full" class:bg-accent={variant === "win" && stars >= s} class:bg-gold={hero && stars >= s} class:bg-bg={stars < s}></div>
      {/each}
    </div>

    <!-- private answer reveal (win only): the solved grid, shown to the solver alone. Never
         a share CTA - the shareable ShareCard stays stats-only (share-noleak.test.ts). -->
    {#if variant === "win" && answer}
      <AnswerSummary grid={answer} heading={answerHeading} caption={answerCaption} />
    {/if}

    {#if variant === "win"}
      <button class="w-full rounded-2xl bg-accent px-6 py-3 font-bold text-black active:scale-95 transition-transform" onclick={copyShare}>{copied ? "copied" : "share"}</button>
    {:else if onretry}
      <button class="w-full rounded-2xl bg-accent px-6 py-3 font-bold active:scale-95 transition-transform" onclick={onretry}>retry</button>
    {/if}
    <div class="flex w-full gap-3">
      <button class="flex-1 rounded-2xl bg-bg px-4 py-3 font-bold active:scale-95 transition-transform" onclick={onhome}>home</button>
      <button class="flex-1 rounded-2xl bg-bg px-4 py-3 font-bold active:scale-95 transition-transform" onclick={onstats}>stats</button>
    </div>
    {#if copied}<p class="text-xs opacity-60" role="status">copied to clipboard</p>{/if}
  </div>
</div>
