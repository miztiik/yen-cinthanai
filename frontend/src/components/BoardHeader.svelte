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
  // CHECK/SUBMIT lives in the Command Bar (2c): non-realtime tiers only; a spent attempt cap
  // swaps it for RETRY. Realtime (easy) auto-wins, so it shows no submit button. The feedback
  // pill renders directly under the header (Board), so it stays adjacent to this button.
  const live = $derived(!!game && game.live);
  const failed = $derived(!!game && !game.locked && attemptsLeft === 0);
  const submitLabel = $derived(game?.dial.feedback === "submit-binary" ? "submit" : "check");
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

    <!-- DAY: prev/next carets flanking the label; the label opens the DayPicker calendar -->
    <div class="hdr-day">
      {#if game}
        <DayNav label={dayLabel} {hasPrev} {hasNext} {onprev} {onnext} onlabel={onopenDay} />
      {/if}
    </div>

    <!-- ADJUST: a single current-tier chip -> DifficultyPicker (no desktop segmented), + gear -->
    <div class="hdr-adjust">
      {#if game}
        <button
          class="flex min-h-10 items-center gap-1 rounded-full bg-ink/5 px-2 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={`difficulty ${tier}, tap to change`}
          aria-haspopup="dialog"
          title={`difficulty: ${tier}`}
          onclick={ondifficulty}
        >
          <TierMeter {tier} {difficulty} height={14} label={false} />
          <span class="hdr-tier-name capitalize" style={`color:${difficulty.colors[tier] ?? "var(--accent)"}`}>{tier}</span>
          <span class="inline-flex rotate-90 opacity-50"><Glyph ref="ui.chevron" size={10} tint /></span>
        </button>
      {/if}
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

    <!-- LIVE-SOLVE cluster: timer | attempt ring | hint. One row where it fits; wraps to a slim
         second zone under a hairline when the header is narrow (the container query below). -->
    <div class="hdr-live">
      <span class="flex items-center gap-1.5">
        <span class="inline-flex opacity-50"><Glyph ref="ui.timer" size={14} tint /></span>
        <span class="tabular-nums leading-none opacity-80">{formatClock(elapsedS)}</span>
      </span>
      {#if game && attemptsTotal >= 0}
        <AttemptRing left={attemptsLeft} total={attemptsTotal} fadeMs={chrome.attemptFadeMs} colors={chrome.attemptColors} />
      {/if}
      <Tooltip text="Reveal a step" delayMs={chrome.tooltipDelayMs}>
        {#snippet children(tip)}
          <button
            class="flex min-h-10 items-center gap-1 rounded-full px-2 font-medium tabular-nums transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30"
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
        <span class="h-3.5 w-px shrink-0 bg-ink/15" aria-hidden="true"></span>
        <button
          class="grid h-9 w-9 place-items-center rounded-full text-ink/70 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={game.locked ? "play again" : "reset the board"}
          title={game.locked ? "play again" : "reset the board"}
          onclick={game.locked ? onagain : onreset}
        ><Glyph ref="ui.reset" size={17} tint /></button>
        {#if !live}
          {#if failed}
            <button
              class="grid h-9 w-9 place-items-center rounded-full text-ink/70 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="retry"
              title="retry"
              onclick={onretry}
            ><Glyph ref="ui.reset" size={16} tint /></button>
          {:else}
            <button
              class="grid h-9 w-9 place-items-center rounded-full text-ink/70 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-30"
              aria-label={submitLabel}
              title={submitLabel}
              disabled={game.locked}
              onclick={oncheck}
            ><Glyph ref="ui.check" size={16} tint /></button>
          {/if}
        {/if}
        {#if !game.locked}
          <button
            class="grid h-9 w-9 place-items-center rounded-full text-ink/70 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="reveal solution"
            title="reveal solution"
            onclick={onreveal}
          ><Glyph ref="ui.eye" size={17} tint /></button>
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
    justify-content: center;
  }
  .hdr-adjust {
    order: 3;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  /* The tier NAME rides in the chip only when the header genuinely has room (a wide desktop
     container), gated on the container - not a viewport breakpoint - because the board caps
     the header at ~max-w-md until lg, so a viewport sm: gate would show the word with no space
     and overflow the single line. The bars + colour + aria-label carry the tier otherwise. */
  .hdr-tier-name {
    display: none;
  }
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
  /* Wide enough for one row: pull the live cluster back into the middle, drop the hairline. */
  @container boardhdr (min-width: 400px) {
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
  /* Only a genuinely wide header (desktop lg container) has room for the tier NAME text. */
  @container boardhdr (min-width: 460px) {
    .hdr-tier-name {
      display: inline;
    }
  }
</style>
