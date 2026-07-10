<script lang="ts">
  // ClueList: the story-first replacement for the glyph ClueChip strip (ui-shell.md). An
  // ordered, numbered list of full-sentence clues - TEXT is primary; glyphs/flags decorate
  // the board axis headers, never the clue language. Each row carries a check-dot the
  // player taps to strike it (manual, reversible). A satisfied clue may also AUTO-DIM, but
  // only on the soft feedback dials (clues.ts / config) so a withheld-feedback tier never
  // leaks. Responsive chrome: a pull-down disclosure on phone, an always-open side panel on
  // desktop. A polite live region announces each strike. No board/canvas internals here.
  import ClueRow from "./ClueRow.svelte";
  import { clueRows, autoDimAllowed, isClueStruck } from "../lib/clues";
  import type { CluesCopy, Feedback } from "../lib/config";
  import type { Game } from "../state/play.svelte";

  let { game, copy, soft, onPick }: { game: Game; copy: CluesCopy; soft: Feedback[]; onPick?: (id: string) => void } = $props();

  let open = $state(true); // phone disclosure; desktop shows the list regardless (lg:block)
  let announce = $state("");
  let listEl = $state<HTMLElement | null>(null);
  // On CHECK, bring the first currently-violated clue into view so "what's wrong" is not just a
  // count - the player lands on the broken clue and can re-read it (PR-6; no spoiler: the clue was
  // always visible, the reveal only FLAGS which one their board breaks). Runs when checked flips.
  $effect(() => {
    if (!game.checked || !game.revealed) return;
    queueMicrotask(() => listEl?.querySelector<HTMLElement>("[data-violated]")?.scrollIntoView({ block: "nearest" }));
  });

  const autoDim = $derived(autoDimAllowed(game.dial.feedback, soft));
  const view = $derived.by(() => {
    const clues = game.revealed ? game.evalState.clues : null;
    return clueRows(game.m.constraints).map((r) => {
      const state = clues ? clues[r.id] : "unknown";
      const struck = !!game.struck[r.id];
      const violated = state === "violate";
      return {
        ...r,
        struck,
        violated,
        dimmed: !violated && isClueStruck(struck, autoDim, state), // a violated clue reads red, never dimmed
        strikeLabel: (struck ? copy.unstrike : copy.strike).replace("{n}", String(r.n)),
      };
    });
  });

  function toggle(id: string, n: number): void {
    game.toggleStruck(id);
    announce = (game.struck[id] ? copy.struck : copy.restored).replace("{n}", String(n));
    onPick?.(id); // jump the mobile pager to the pairing this clue constrains (no-op on desktop)
  }
</script>

<section class="w-full lg:w-72 lg:shrink-0" aria-label={copy.heading}>
  <button
    type="button"
    class="flex w-full items-center justify-between rounded-xl bg-surface px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:cursor-default"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <span>{copy.heading} <span class="opacity-50 tabular-nums">({view.length})</span></span>
    <span class="text-xs font-normal opacity-60 lg:hidden">{open ? copy.hide : copy.show}</span>
  </button>

  <ol class="mt-1 divide-y divide-ink/10 {open ? 'block' : 'hidden'} lg:block" bind:this={listEl}>
    {#each view as row (row.id)}
      <ClueRow
        n={row.n}
        text={row.text}
        struck={row.struck}
        dimmed={row.dimmed}
        violated={row.violated}
        strikeLabel={row.strikeLabel}
        onToggle={() => toggle(row.id, row.n)}
      />
    {/each}
  </ol>

  <p class="sr-only" aria-live="polite">{announce}</p>
</section>
