<script lang="ts">
  // Tooltip: a desktop hover + keyboard-focus label bubble for an icon control. It appears on
  // a fine-pointer hover after `delayMs` (config chrome.tooltipDelayMs) and INSTANTLY on
  // focus-visible; it is transform/opacity only so it never costs a layout on the mid-tier
  // Android (Holy Law #2), and reduced-motion zeroes the transition globally (app.css). It is
  // NOT a focus trap and touch is a no-op - the trigger's own aria-label carries the meaning
  // on a phone, and the bubble only DESCRIBES (aria-describedby), so it is purely additive.
  // The trigger is a snippet child; the bubble's id is handed to it so the caller wires
  // aria-describedby onto the real interactive element. See BoardHeader.svelte, ui-shell.md.
  import { onDestroy, type Snippet } from "svelte";

  let {
    text,
    delayMs = 350,
    children,
  }: { text: string; delayMs?: number; children: Snippet<[string]> } = $props();

  let open = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Stable per-instance id so aria-describedby resolves and two tooltips never collide.
  const tipId = `tt-${Math.random().toString(36).slice(2, 9)}`;

  function clear() {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }
  function hoverIn(e: PointerEvent) {
    if (e.pointerType !== "mouse") return; // touch/pen: no-op (aria-label carries meaning)
    clear();
    timer = setTimeout(() => (open = true), delayMs);
  }
  function show() {
    clear();
    open = true;
  }
  function hide() {
    clear();
    open = false;
  }
  onDestroy(clear);
</script>

<!-- The wrapper only detects hover/focus over the trigger region; the interactive element is
     the snippet child (a button/link with its own aria-label). Focus handlers give keyboard
     parity, so the static-element pointer-handler a11y hint does not apply here. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<span
  class="relative inline-flex"
  onpointerenter={hoverIn}
  onpointerleave={hide}
  onfocusin={show}
  onfocusout={hide}
>
  {@render children(tipId)}
  <span
    id={tipId}
    role="tooltip"
    data-open={open}
    class="tooltip pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs font-medium text-bg shadow-e2"
    class:open
  >
    {text}
  </span>
</span>

<style>
  .tooltip {
    opacity: 0;
    transform: translate(-50%, 3px);
    transition:
      opacity 120ms ease-out,
      transform 120ms ease-out;
  }
  .tooltip.open {
    opacity: 1;
    transform: translate(-50%, 0);
  }
</style>
