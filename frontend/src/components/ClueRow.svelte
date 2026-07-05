<script lang="ts">
  // ClueRow: one full-sentence clue in the numbered list. Number + sentence + a trailing
  // check-dot the player taps to strike the clue (a manual, reversible bookkeeping mark -
  // never required, never nagged; the clue starts bright). `struck` is the MANUAL state and
  // drives aria-pressed; `dimmed` is the visual (manual OR a gated auto-dim, see clues.ts)
  // and drives the line-through. A11y: real labelled button, aria-pressed, visible focus
  // ring, keyboard reachable (native button). The leading circle is the toggle affordance:
  // the clue NUMBER at rest, an accent check when handled. No glyph in the clue TEXT.
  import Glyph from "../lib/Glyph.svelte";
  let {
    n,
    text,
    struck = false,
    dimmed = false,
    strikeLabel,
    onToggle,
  }: {
    n: number;
    text: string;
    struck?: boolean;
    dimmed?: boolean;
    strikeLabel: string;
    onToggle: () => void;
  } = $props();
</script>

<li>
  <button
    type="button"
    class="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-ink/[0.04] active:bg-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    aria-pressed={struck}
    aria-label={strikeLabel}
    onclick={onToggle}
  >
    <span class="mt-px w-5 shrink-0" aria-hidden="true">
      {#if dimmed}
        <span class="grid h-[22px] w-[22px] place-items-center rounded-full border border-accent bg-accent/15 text-accent"><Glyph ref="ui.check" size={12} tint /></span>
      {:else}
        <span class="grid h-[22px] w-[22px] place-items-center rounded-full border border-ink/25 text-xs tabular-nums text-ink/70">{n}</span>
      {/if}
    </span>
    <span class="flex-1 text-sm leading-relaxed transition-opacity duration-150 {dimmed ? 'line-through decoration-ink/40 opacity-50' : 'opacity-100'}">
      {text}
    </span>
  </button>
</li>
