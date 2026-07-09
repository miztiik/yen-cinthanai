<script lang="ts">
  // BoardHeader (v2): the board's Command Bar as ONE slim line - LEAVE (a house glyph, never
  // twinning the day carets) | the DAY (a DayNav whose label opens the DayPicker calendar) |
  // the live-solve cluster (timer, the attempts as an urgency AttemptRing, hint) | ADJUST (a
  // single current-tier chip that opens the DifficultyPicker sheet + the display gear). The
  // line stays one row where it fits and wraps ONLY the live-solve cluster to a slim second
  // zone below a hairline when the header is narrow (a container query, NOT a fixed two-tier);
  // the vertical padding is cut so the bar stops eating the board. Icon controls carry a
  // desktop Tooltip (focus-instant, hover-delayed by chrome.tooltipDelayMs) and a visible focus
  // ring; every labelled meaning survives on touch via aria-label. Blur-free, transform/opacity
  // only, so it holds 60fps on the mid-tier Android (Holy Law #2). Tokenized chrome + Glyph
  // icons only (Holy Laws #6/#10). All wiring is props/callbacks from Board. See ui-shell.md.
  import Glyph from "../lib/Glyph.svelte";
  import TierMeter from "./TierMeter.svelte";
  import DayNav from "./DayNav.svelte";
  import AttemptRing from "./AttemptRing.svelte";
  import Tooltip from "./Tooltip.svelte";
  import DayPicker from "./DayPicker.svelte";
  import { formatClock } from "../lib/dates";
  import type { Game } from "../state/play.svelte";
  import type { DifficultyUi, ChromeUi } from "../lib/config";

  interface Props {
    game: Game | null;
    difficulty: DifficultyUi;
    chrome: ChromeUi;
    elapsedS: number;
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
    onreset: () => void;
    onagain: () => void;
    oncheck: () => void;
    onretry: () => void;
    onreveal: () => void;
    ondisplay: () => void;
    ondifficulty: () => void;
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
    onreset,
    onagain,
    oncheck,
    onretry,
    onreveal,
    ondisplay,
    ondifficulty,
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
  // Fill progress (filled/total slots) as a solve stat beside the timer, shown as a glyph CHIP
  // (ui.progress) so a bare fraction never reads as hints/lives (Jony + Player review). HIDDEN on
  // easy - a 3-cell grid shows progress on its face - mirroring the AttemptRing "hide when it
  // carries no info on this tier" rule; it earns its pixels on the bigger standard/sharp/expert.
  const progress = $derived(game && game.m.tier !== "easy" ? { filled: game.evalState.filled, total: game.evalState.total } : null);
  // CHECK/SUBMIT lives in the Command Bar (2c): non-realtime tiers only; a spent attempt cap
  // swaps it for RETRY. Realtime (easy) auto-wins, so it shows no submit button. The feedback
  // pill renders directly under the header (Board), so it stays adjacent to this button.
  const live = $derived(!!game && game.live);
  const failed = $derived(!!game && !game.locked && attemptsLeft === 0);
  const submitLabel = $derived(game?.dial.feedback === "submit-binary" ? "submit" : "check");
  const tierCap = $derived(tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : "");

  // Reveal-solution is a TERMINAL give-up (fills the board, locks a loss), so it is a two-tap
  // ARMED action: the first tap arms + warns (the eye turns violate-red), a second tap within
  // chrome.revealArmMs actually reveals; it auto-disarms after the window so a stray later tap
  // is safe. Placement (own divider, far end) + the arm is the fat-thumb fix (Player, Jony).
  let revealArmed = $state(false);
  let revealTimer: ReturnType<typeof setTimeout> | undefined;
  function tapReveal(): void {
    if (revealArmed) {
      clearTimeout(revealTimer);
      revealArmed = false;
      onreveal();
    } else {
      revealArmed = true;
      clearTimeout(revealTimer);
      revealTimer = setTimeout(() => (revealArmed = false), chrome.revealArmMs ?? 2500);
    }
  }
</script>

<div class="board-hdr-wrap mx-auto w-full max-w-2xl">
  <header class="board-hdr rounded-2xl border border-ink/10 bg-surface px-1.5 py-1 text-sm shadow-e1">
    <!-- LEAVE: a house glyph so leave never twins the day-nav carets (Decision 2) -->
    <div class="hdr-home">
      <Tooltip text="Back to puzzles" delayMs={chrome.tooltipDelayMs}>
        {#snippet children(tip)}
          <a
            class="grid h-9 w-9 place-items-center rounded-full text-ink/70 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            href={homeHref}
            aria-label="back"
            aria-describedby={tip}
            onclick={(e) => {
              e.preventDefault();
              onhome();
            }}
          >
            <Glyph ref="ui.home" size={17} tint />
          </a>
        {/snippet}
      </Tooltip>
    </div>

    <!-- IDENTITY: day nav + the tier chip. Date + tier together ARE the puzzle's identity
         (/play/<date>/<tier>), so the difficulty rides here (not with the gear). The chip is
         glyph-only - the TierMeter bars + colour carry the level; the name is taught on the
         landing pill + the DifficultyPicker, and the styled Tooltip names it on desktop. -->
    <div class="hdr-day">
      {#if game}
        <div class="flex w-fit items-center gap-1.5">
        <DayNav label={dayLabel} {hasPrev} {hasNext} {onprev} {onnext} onlabel={onopenDay} />
        <Tooltip text={`Difficulty: ${tierCap}`} delayMs={chrome.tooltipDelayMs}>
          {#snippet children(tip)}
            <button
              class="flex min-h-10 items-center gap-1 rounded-full bg-ink/5 px-2 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label={`difficulty ${tier}, tap to change`}
              aria-haspopup="dialog"
              aria-describedby={tip}
              onclick={ondifficulty}
            >
              <TierMeter {tier} {difficulty} height={14} label={false} />
              <span class="inline-flex rotate-90 opacity-50"><Glyph ref="ui.chevron" size={10} tint /></span>
            </button>
          {/snippet}
        </Tooltip>
        </div>
      {/if}
    </div>

    <!-- FRAME: the display gear - a presentation-only control (colour / glyph / label toggles),
         so it bookends home at the far edge rather than sitting with the content-changing tier. -->
    <div class="hdr-adjust">
      <Tooltip text="Display options" delayMs={chrome.tooltipDelayMs}>
        {#snippet children(tip)}
          <button
            class="grid h-9 w-9 place-items-center rounded-full text-ink/70 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="display options"
            aria-describedby={tip}
            onclick={ondisplay}
          >
            <Glyph ref="ui.gear" size={17} tint />
          </button>
        {/snippet}
      </Tooltip>
    </div>

    <!-- LIVE-SOLVE cluster: STATUS (timer | progress | attempt ring) | divider | ACTIONS (hint |
         check | reset) | divider | terminal REVEAL. One row where it fits; wraps to a slim second
         zone under a hairline when the header is narrow (container query below). Hint is an ACTION
         (spends a resource), so it sits PAST the status divider with check/reset, not with status. -->
    <div class="hdr-live">
      <span class="flex items-center gap-1.5">
        <span class="inline-flex opacity-50"><Glyph ref="ui.timer" size={14} tint /></span>
        <span class="tabular-nums leading-none opacity-80">{formatClock(elapsedS)}</span>
      </span>
      {#if progress}
        <span class="flex items-center gap-1.5" role="status" aria-label={`${progress.filled} of ${progress.total} solved`}>
          <span class="inline-flex opacity-50"><Glyph ref="ui.progress" size={14} tint /></span>
          <span class="tabular-nums leading-none opacity-80">{progress.filled}/{progress.total}</span>
        </span>
      {/if}
      {#if game && attemptsTotal >= 0}
        <AttemptRing left={attemptsLeft} total={attemptsTotal} fadeMs={chrome.attemptFadeMs} colors={chrome.attemptColors} />
      {/if}
      {#if game}
        <span class="h-3.5 w-px shrink-0 bg-ink/15" aria-hidden="true"></span>
      {/if}
      <Tooltip text="Reveal a step" delayMs={chrome.tooltipDelayMs}>
        {#snippet children(tip)}
          <button
            class={`inline-flex h-9 items-center justify-center rounded-full font-medium tabular-nums transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30 ${hintsLeft >= 0 ? "w-auto gap-1 px-2.5" : "w-9"}`}
            aria-label={hintsLeft >= 0 ? `use hint, ${hintsLeft} left` : "use hint"}
            aria-describedby={tip}
            disabled={!canHint}
            onclick={onhint}
          >
            <span class="opacity-70"><Glyph ref="ui.hint" size={16} tint /></span>{#if hintsLeft >= 0}{hintsLeft}{/if}
          </button>
        {/snippet}
      </Tooltip>
      {#if game}
        {#if !live}
          {#if failed}
            <Tooltip text="Retry" delayMs={chrome.tooltipDelayMs}>
              {#snippet children(tip)}
                <button
                  class="grid h-9 w-9 place-items-center rounded-full text-ink/70 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="retry"
                  aria-describedby={tip}
                  onclick={onretry}
                ><Glyph ref="ui.reset" size={16} tint /></button>
              {/snippet}
            </Tooltip>
          {:else}
            <Tooltip text={submitLabel === "submit" ? "Submit" : "Check"} delayMs={chrome.tooltipDelayMs}>
              {#snippet children(tip)}
                <button
                  class="grid h-9 w-9 place-items-center rounded-full text-ink/70 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30"
                  aria-label={submitLabel}
                  aria-describedby={tip}
                  disabled={game.locked}
                  onclick={oncheck}
                ><Glyph ref="ui.check" size={16} tint /></button>
              {/snippet}
            </Tooltip>
          {/if}
        {/if}
        <Tooltip text={game.locked ? "Play again" : "Reset the board"} delayMs={chrome.tooltipDelayMs}>
          {#snippet children(tip)}
            <button
              class="grid h-9 w-9 place-items-center rounded-full text-ink/70 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label={game.locked ? "play again" : "reset the board"}
              aria-describedby={tip}
              onclick={game.locked ? onagain : onreset}
            ><Glyph ref="ui.reset" size={17} tint /></button>
          {/snippet}
        </Tooltip>
        {#if !game.locked}
          <span class="h-3.5 w-px shrink-0 bg-ink/15" aria-hidden="true"></span>
          <Tooltip text={revealArmed ? "Tap again to reveal" : "Reveal the solution"} delayMs={chrome.tooltipDelayMs}>
            {#snippet children(tip)}
              <button
                class={`grid h-9 w-9 place-items-center rounded-full transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${revealArmed ? "text-violate bg-violate/15" : "text-ink/70"}`}
                aria-label={revealArmed ? "tap again to reveal the solution" : "reveal the solution"}
                aria-describedby={tip}
                onclick={tapReveal}
              ><Glyph ref="ui.eye" size={17} tint /></button>
            {/snippet}
          </Tooltip>
        {/if}
      {/if}
    </div>
  </header>
</div>

{#if dayPickerOpen && game}
  <DayPicker current={currentDate} dates={tierDates} {today} onpick={onpickDay} onclose={oncloseDay} />
{/if}

<style>
  /* v2 header layout: one slim flex line that WRAPS ONLY the live-solve cluster to a slim
     second zone (under a hairline) when the header is too narrow to hold everything on one
     row - a container query, not a fixed two-tier. The wrapper is the query container (an
     inline-size container collapses a w-fit child, so the panel is w-full inside it). The
     four zones swap order at the breakpoint: narrow keeps home | day | adjust on row 1 with
     the live cluster on its own full-width row 2; wide slots the live cluster back between
     day and adjust on a single row. Transform/opacity + reflow only (blur-free, Holy Law #2). */
  .board-hdr-wrap {
    container-type: inline-size;
    container-name: boardhdr;
  }
  /* Hover highlight on the command-bar controls (yen-doku style): a subtle ink wash fills the
     icon buttons on hover; the accent action buttons dim slightly instead. Scoped :global so it
     also reaches the DayNav carets. Background/filter/transform only - compositor-cheap, Holy
     Law #2; reduced-motion (app.css) zeroes the transition. */
  .board-hdr :global(button),
  .board-hdr :global(a) {
    transition:
      background-color 120ms ease,
      transform 120ms ease;
  }
  .board-hdr :global(button:not(:disabled):hover),
  .board-hdr :global(a:hover) {
    background-color: color-mix(in oklab, var(--ink) 9%, transparent);
  }
  .board-hdr {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    column-gap: 0.25rem;
    row-gap: 0;
    /* Menu typeface: a thinner, geometric Jost (distinct from the Inter body) so the chrome
       reads lighter + smaller than the board content. font-family inherits, so it cascades to
       every header control including the DayNav label. */
    font-family: "Jost Variable", ui-sans-serif, system-ui, sans-serif;
    font-weight: 400;
    letter-spacing: 0.01em;
  }
  .hdr-home {
    order: 1;
  }
  .hdr-day {
    order: 2;
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
  }
  .hdr-adjust {
    order: 3;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  /* The tier NAME word is gone from the board chip (glyph-only: TierMeter bars + chevron + a
     styled Tooltip name it; the word is taught on the landing pill + DifficultyPicker). */
  .hdr-live {
    order: 4;
    flex-basis: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    margin-top: 0.25rem;
    padding-top: 0.25rem;
    border-top: 1px solid color-mix(in oklab, var(--ink) 12%, transparent);
  }
  /* Wide enough to hold everything on ONE row (desktop / a wide window): pull the live cluster
     back inline between the identity zone and the gear, and drop the hairline. Below this the
     bar is a clean two rows (identity + frame on top, the live-solve cluster on its own row).
     Gated at the width the full cluster genuinely fits so it never wraps a control awkwardly. */
  @container boardhdr (min-width: 640px) {
    .hdr-adjust {
      order: 4;
    }
    .hdr-live {
      order: 3;
      flex-basis: auto;
      margin-top: 0;
      padding-top: 0;
      border-top: 0;
    }
  }
</style>
