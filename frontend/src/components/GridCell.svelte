<script lang="ts">
  // GridCell: one cell of a cross-out block. It is BOTH a drop target (the drag magnet
  // reads data-cell-key / data-cell-block, drag.ts) and a tap/keyboard target, rendered as
  // one real labelled <button> (a11y). Only the two AUTHORED states are actioned here - a
  // TICK (the positive, drag or Enter) and a MANUAL-X (tap/click/Space) - while auto-X +
  // blank are DERIVED upstream (grid.ts) and only painted. Colour encodes STATE not
  // category (Jony, Decision 4): X is neutral ink (never red - red means wrong), the tick
  // shows the value glyph (not a generic checkmark), falling back to a positive accent disc
  // when a story value has no glyph. Roving tabindex is owned by NotesGrid. No inline SVG
  // (the X is two CSS bars); the glyph is the only image. See core-loop.md, ui-shell.md.
  import Glyph from "../lib/Glyph.svelte";
  import type { CellMark } from "../lib/grid";

  let {
    cellKey,
    block,
    state = "blank",
    glyph = null,
    ariaLabel,
    tabindex = -1,
    size = 40,
    locked = false,
    crosshair = false,
    row,
    col,
    flash = false,
    conflict = false,
    ontap,
    ontick,
    onmove,
  }: {
    cellKey: string;
    block: string;
    state?: CellMark;
    glyph?: string | null;
    ariaLabel: string;
    tabindex?: number;
    size?: number;
    locked?: boolean;
    crosshair?: boolean;
    row?: number;
    col?: number;
    flash?: boolean;
    conflict?: boolean;
    ontap: () => void;
    ontick: () => void;
    onmove?: (key: string) => void;
  } = $props();

  const frame = $derived.by(() => {
    if (state === "tick") return "border-accent bg-accent/15";
    if (state === "manualX") return "border-ink/25 bg-surface";
    if (state === "autoX") return "border-ink/10 bg-surface";
    return "border-ink/15 bg-surface"; // blank
  });

  // Keyboard split (a11y): Enter ticks the positive, Space toggles the manual-X (both
  // preventDefault so the native button click never ALSO fires ontap), and the arrow keys
  // ask NotesGrid to move the roving focus. Handling keys on this interactive button (not a
  // static wrapper) keeps the whole grid keyboard-reachable without an ARIA-role hack.
  function keydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      ontick();
    } else if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      ontap();
    } else if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      onmove?.(e.key);
    }
  }
</script>

<button
  type="button"
  data-cell-key={cellKey}
  data-cell-block={block}
  data-r={row}
  data-c={col}
  data-crosshair={crosshair ? "" : undefined}
  data-flash={flash ? "" : undefined}
  data-conflict={conflict ? "" : undefined}
  {tabindex}
  aria-label={ariaLabel}
  disabled={locked}
  onclick={ontap}
  onkeydown={keydown}
  class={`relative isolate grid touch-none place-items-center rounded-md border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${frame}`}
  style={`width:${size}px;height:${size}px`}
>
  {#if state === "tick"}
    {#if glyph}
      <Glyph ref={glyph} size={Math.round(size * 0.68)} />
    {:else}
      <span class="flex items-center justify-center rounded-full bg-accent text-bg" style={`width:${Math.round(size * 0.52)}px;height:${Math.round(size * 0.52)}px`} aria-hidden="true">
        <Glyph ref="ui.check" size={Math.round(size * 0.34)} tint />
      </span>
    {/if}
  {:else if state === "manualX" || state === "autoX"}
    <span class={`relative block ${state === "autoX" ? "opacity-40" : "opacity-90"}`} style={`width:${Math.round(size * 0.5)}px;height:${Math.round(size * 0.5)}px`} aria-hidden="true">
      <span class="absolute left-1/2 top-1/2 h-[2px] w-full -translate-x-1/2 -translate-y-1/2 rotate-45 rounded bg-ink"></span>
      <span class="absolute left-1/2 top-1/2 h-[2px] w-full -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded bg-ink"></span>
    </span>
  {/if}
</button>
