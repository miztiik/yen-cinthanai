<script lang="ts">
  // Day navigator on the Board: prev/next-day carets flanking the current-day label. Next is
  // disabled at today (never navigates to a future puzzle); prev is disabled at the oldest
  // shipped day (the rolling-window floor). Chrome only, transform/opacity. Caret grammar
  // (ui-shell.md): horizontal chevrons are RESERVED for this day timeline, drawn thin + light
  // so the bold day word is the hero and the carets never twin the header's bold back-arrow.
  // The chevron glyph points right by default; the prev caret rotates it. See ui-shell.md.
  import Glyph from "../lib/Glyph.svelte";

  interface Props {
    label: string;
    hasPrev: boolean;
    hasNext: boolean;
    onprev: () => void;
    onnext: () => void;
  }
  let { label, hasPrev, hasNext, onprev, onnext }: Props = $props();
</script>

<nav class="mx-auto flex w-fit items-center gap-1 text-sm" aria-label="puzzle day">
  <button
    class="grid h-11 w-11 place-items-center rounded-full text-ink/45 transition-transform active:scale-95 disabled:pointer-events-none disabled:opacity-25"
    aria-label="previous day"
    disabled={!hasPrev}
    onclick={onprev}
  >
    <span class="inline-flex rotate-180"><Glyph ref="ui.chevron" size={13} tint /></span>
  </button>
  <span class="min-w-[6rem] text-center text-[15px] font-semibold text-ink/80" aria-live="polite">{label}</span>
  <button
    class="grid h-11 w-11 place-items-center rounded-full text-ink/45 transition-transform active:scale-95 disabled:pointer-events-none disabled:opacity-25"
    aria-label="next day"
    disabled={!hasNext}
    onclick={onnext}
  >
    <Glyph ref="ui.chevron" size={13} tint />
  </button>
</nav>
