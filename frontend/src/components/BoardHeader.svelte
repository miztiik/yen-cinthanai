<script lang="ts">
  // BoardHeader: the board's Command Bar - one panel with TWO tiers over a hairline. Tier 1
  // (nav / context) carries LEAVE (back), the DAY (a DayNav whose label opens the DayPicker
  // calendar), and ADJUST (difficulty + display): on desktop the difficulty is an inline
  // DifficultySegmented switch, on phone a chip that opens the DifficultyPicker sheet. Tier 2
  // (the live-solve cluster) carries the timer, the attempts as depleting AttemptPips (the
  // ui.target crosshair is gone), and the hint action. Icon controls carry a desktop Tooltip
  // (focus-instant, hover-delayed by chrome.tooltipDelayMs) and a visible focus ring; every
  // labelled meaning survives on touch via aria-label. Blur-free, transform/opacity only, so
  // it holds 60fps on the mid-tier Android (Holy Law #2). Tokenized chrome + Glyph icons only
  // (Holy Laws #6/#10). All wiring is props/callbacks from Board. See docs/concepts/ui-shell.md.
  import Glyph from "../lib/Glyph.svelte";
  import TierMeter from "./TierMeter.svelte";
  import DayNav from "./DayNav.svelte";
  import AttemptPips from "./AttemptPips.svelte";
  import Tooltip from "./Tooltip.svelte";
  import DifficultySegmented from "./DifficultySegmented.svelte";
  import DayPicker from "./DayPicker.svelte";
  import type { Game } from "../state/play.svelte";
  import type { DifficultyUi, ChromeUi } from "../lib/config";

  interface Props {
    game: Game | null;
    difficulty: DifficultyUi;
    chrome: ChromeUi;
    elapsedS: number;
    desktop: boolean;
    homeHref: string;
    dayLabel: string;
    currentDate: string;
    tierDates: string[];
    today: string;
    hasPrev: boolean;
    hasNext: boolean;
    dayPickerOpen: boolean;
    onhome: () => void;
    onhint: () => void;
    ondisplay: () => void;
    ondifficulty: () => void;
    onpickTier: (tier: string) => void;
    onprev: () => void;
    onnext: () => void;
    onopenDay: () => void;
    oncloseDay: () => void;
    onpickDay: (date: string) => void;
  }
  let {
    game,
    difficulty,
    chrome,
    elapsedS,
    desktop,
    homeHref,
    dayLabel,
    currentDate,
    tierDates,
    today,
    hasPrev,
    hasNext,
    dayPickerOpen,
    onhome,
    onhint,
    ondisplay,
    ondifficulty,
    onpickTier,
    onprev,
    onnext,
    onopenDay,
    oncloseDay,
    onpickDay,
  }: Props = $props();

  const tier = $derived(game?.m.tier ?? "");
  const attemptsTotal = $derived(game?.dial.attempts ?? -1);
  const attemptsLeft = $derived(game?.attemptsLeft ?? -1);
  const hintsLeft = $derived(game?.hintsLeft ?? -1);
  const canHint = $derived(!!game && !game.locked && hintsLeft !== 0);
</script>

<header class="mx-auto flex w-fit max-w-full flex-col gap-1.5 rounded-3xl border border-ink/10 bg-surface px-1.5 py-1.5 text-sm shadow-e1">
  <!-- Tier 1: nav / context - LEAVE | DAY | ADJUST -->
  <div class="flex items-center gap-1 whitespace-nowrap">
    <Tooltip text="Back to puzzles" delayMs={chrome.tooltipDelayMs}>
      {#snippet children(tip)}
        <a
          class="grid h-11 w-11 place-items-center rounded-full text-ink/70 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          href={homeHref}
          aria-label="back"
          aria-describedby={tip}
          onclick={(e) => {
            e.preventDefault();
            onhome();
          }}
        >
          <Glyph ref="ui.back" size={18} tint />
        </a>
      {/snippet}
    </Tooltip>

    <div class="flex min-w-0 flex-1 justify-center">
      {#if game}
        <DayNav label={dayLabel} {hasPrev} {hasNext} {onprev} {onnext} onlabel={onopenDay} />
      {/if}
    </div>

    <div class="flex items-center gap-1">
      {#if game}
        {#if desktop}
          <DifficultySegmented current={tier} {difficulty} onpick={onpickTier} />
        {:else}
          <button
            class="flex min-h-11 items-center gap-2 rounded-full bg-ink/5 px-3 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label={`difficulty ${tier}, tap to change`}
            aria-haspopup="dialog"
            title={`difficulty: ${tier}`}
            onclick={ondifficulty}
          >
            <TierMeter {tier} {difficulty} height={14} label={false} />
            <span class="hidden capitalize sm:inline" style={`color:${difficulty.colors[tier] ?? "var(--accent)"}`}>{tier}</span>
            <span class="inline-flex rotate-90 opacity-50"><Glyph ref="ui.chevron" size={11} tint /></span>
          </button>
        {/if}
      {/if}
      <Tooltip text="Display options" delayMs={chrome.tooltipDelayMs}>
        {#snippet children(tip)}
          <button
            class="grid h-11 w-11 place-items-center rounded-full text-ink/70 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="display options"
            aria-describedby={tip}
            onclick={ondisplay}
          >
            <Glyph ref="ui.gear" size={18} tint />
          </button>
        {/snippet}
      </Tooltip>
    </div>
  </div>

  <span class="mx-1 h-px bg-ink/10" aria-hidden="true"></span>

  <!-- Tier 2: live-solve cluster - timer | attempts pips | hint -->
  <div class="flex items-center justify-center gap-2 whitespace-nowrap px-1">
    <span class="flex items-center gap-1">
      <span class="opacity-50"><Glyph ref="ui.timer" size={14} tint /></span>
      <span class="tabular-nums opacity-80">{elapsedS}s</span>
    </span>
    {#if game && attemptsTotal >= 0}
      <span class="h-3.5 w-px bg-ink/15" aria-hidden="true"></span>
      <AttemptPips left={attemptsLeft} total={attemptsTotal} />
    {/if}
    <span class="h-3.5 w-px bg-ink/15" aria-hidden="true"></span>
    <Tooltip text="Reveal a step" delayMs={chrome.tooltipDelayMs}>
      {#snippet children(tip)}
        <button
          class="flex min-h-11 items-center gap-1 rounded-full px-2 font-medium tabular-nums transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30"
          aria-label={hintsLeft >= 0 ? `use hint, ${hintsLeft} left` : "use hint"}
          aria-describedby={tip}
          disabled={!canHint}
          onclick={onhint}
        >
          <span class="opacity-70"><Glyph ref="ui.hint" size={16} tint /></span>{#if hintsLeft >= 0}{hintsLeft}{/if}
        </button>
      {/snippet}
    </Tooltip>
  </div>
</header>

{#if dayPickerOpen && game}
  <DayPicker current={currentDate} dates={tierDates} {today} onpick={onpickDay} onclose={oncloseDay} />
{/if}
