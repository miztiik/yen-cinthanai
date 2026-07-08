<script lang="ts">
  // Private post-win answer reveal: the solved grid as a small a11y table (ui-shell.md).
  // Shown ONLY on the win screen inside the ResultCard flow - never shared (the ShareCard
  // stays stats-only, share-noleak.test.ts). No share CTA lives here; this is the player's
  // private key to the puzzle they just solved. Glyphs render only when the axis carries one
  // (story-first text axes have none). Chrome only (Tailwind); no board/canvas internals.
  import Glyph from "../lib/Glyph.svelte";
  import type { AnswerGrid } from "../lib/answer";

  let { grid, heading, caption, partial = false }: { grid: AnswerGrid; heading: string; caption?: string; partial?: boolean } = $props();
  // Live (partial) progress count: how many entity-attribute cells the player has resolved. In
  // the post-win reveal (partial=false) the grid is complete, so the count is not shown.
  const total = $derived(grid.rows.reduce((n, r) => n + r.cells.length, 0));
  const filled = $derived(grid.rows.reduce((n, r) => n + r.cells.filter((c) => c.label !== "").length, 0));
</script>

<section class="w-full text-left" aria-label={heading}>
  <h3 class="mb-1 text-xs font-bold uppercase tracking-widest opacity-70">{heading}{#if partial} <span class="opacity-60 tabular-nums">({filled}/{total})</span>{/if}</h3>
  <div class="max-h-48 overflow-auto rounded-xl bg-bg p-1">
    <table class="w-full border-collapse text-sm tabular-nums">
      <caption class="sr-only">{caption ?? heading}</caption>
      <thead>
        <tr>
          <th scope="col" class="px-2 py-1"><span class="sr-only">row</span></th>
          {#each grid.columns as col (col)}
            <th scope="col" class="px-2 py-1 text-left font-semibold opacity-80">{col}</th>
          {/each}
        </tr>
      </thead>
      <tbody class="divide-y divide-ink/10">
        {#each grid.rows as row, i (i)}
          <tr>
            <th scope="row" class="px-2 py-1 text-left font-semibold whitespace-nowrap">
              <span class="inline-flex items-center gap-1">
                {#if row.head.glyph}<Glyph ref={row.head.glyph} label={row.head.label} size={18} />{/if}
                {row.head.label}
              </span>
            </th>
            {#each row.cells as cell, j (j)}
              <td class="px-2 py-1 whitespace-nowrap opacity-90">
                {#if cell.label}
                  <span class="inline-flex items-center gap-1">
                    {#if cell.glyph}<Glyph ref={cell.glyph} label={cell.label} size={18} />{/if}
                    {cell.label}
                  </span>
                {:else if partial}
                  <span class="opacity-30" aria-hidden="true">-</span><span class="sr-only">unknown</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
