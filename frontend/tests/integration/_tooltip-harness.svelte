<script lang="ts">
  // Test harness for Tooltip: exercises the snippet-child API (the bubble id is handed to the
  // trigger so the caller wires aria-describedby). Used only by tooltip.test.ts. Not a route.
  import Tooltip from "../../src/components/Tooltip.svelte";

  let { text = "Hello", delayMs = 350 }: { text?: string; delayMs?: number } = $props();
</script>

<Tooltip {text} {delayMs}>
  {#snippet children(tip)}
    <button aria-describedby={tip} data-testid="trigger">trigger</button>
  {/snippet}
</Tooltip>
