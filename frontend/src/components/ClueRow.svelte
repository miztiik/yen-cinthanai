<script lang="ts">
  // ClueRow: one full-sentence clue in the numbered list. Number + sentence + a trailing
  // check-dot the player taps to strike the clue (a manual, reversible bookkeeping mark -
  // never required, never nagged; the clue starts bright). `struck` is the MANUAL state and
  // drives aria-pressed; `dimmed` is the visual (manual OR a gated auto-dim, see clues.ts)
  // and drives the line-through. A11y: real labelled button, aria-pressed, visible focus
  // ring, keyboard reachable (native button). Text is primary; no glyphs in the clue.
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

<li class="flex items-start gap-3 py-2">
  <span class="mt-0.5 w-5 shrink-0 text-right text-sm tabular-nums opacity-60" aria-hidden="true">{n}.</span>
  <span class="flex-1 text-sm leading-relaxed transition-opacity" class:line-through={dimmed} class:opacity-50={dimmed}>
    {text}
  </span>
  <button
    type="button"
    class="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent {struck
      ? 'border-accent bg-accent'
      : 'border-ink/30 bg-transparent'}"
    aria-pressed={struck}
    aria-label={strikeLabel}
    onclick={onToggle}
  >
    <span class="h-2 w-2 rounded-full {struck ? 'bg-bg' : 'bg-transparent'}" aria-hidden="true"></span>
  </button>
</li>
