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
</script>

<div class="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-6" role="dialog" aria-modal="true" aria-label={variant === "win" ? "solved" : "result"}>
  <div
    class="flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl bg-surface p-8 text-center"
    class:ring-4={hero}
    class:ring-gold={hero}
  >
    {#if hero}<p class="text-xs font-bold uppercase tracking-widest text-gold" aria-label="new best">crown - personal best</p>{/if}
    <Glyph ref={shapeGlyph} label="result" size={48} />
    <p class="flex gap-1 text-2xl" class:text-gold={hero} aria-label={`${stars} of 3 stars`}>
      {#each [1, 2, 3] as s (s)}<span class:opacity-25={stars < s}>{stars >= s ? "*" : "."}</span>{/each}
    </p>
    <p class="text-2xl font-bold" class:text-gold={hero}>{phrase}</p>

    <div class="flex w-full justify-around text-sm tabular-nums opacity-80">
      <span aria-label="time">{secs}s</span>
      <span aria-label="wrong">w{wrong}</span>
      <span aria-label="hints">h{hintsUsed}</span>
      <span aria-label="streak">flame {streak}</span>
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
