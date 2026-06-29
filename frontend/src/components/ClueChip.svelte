<script lang="ts">
  // ClueChip: a constraint shown as two glyphs joined by a relation token, with the
  // teaching text under it (core-loop.md, ui-shell.md). The relation lexicon is the
  // legible-glyph vocabulary the generator restricts itself to; distance shows its k.
  // State ring reflects satisfy/violate/unknown - never the solution.
  import Glyph from "../lib/Glyph.svelte";
  import type { Constraint, PuzzleManifest } from "../contracts/manifest";
  import type { ClueState } from "../lib/validate";

  let { c, m, state = "unknown", glow = false }: { c: Constraint; m: PuzzleManifest; state?: ClueState; glow?: boolean } = $props();

  const REL: Record<string, string> = {
    eq: "=",
    neq: "/",
    ends: "|",
    adjacent: "-",
    distance: ">k>",
    before: ">>",
    opposite: "<>",
    between: "-|-",
  };

  function symbol(): string {
    const base = REL[c.renderHint] ?? REL[c.type] ?? "?";
    return c.type === "distance" ? base.replace("k", String(c.params.k ?? "")) : base;
  }
  function glyphOf(cat: string, value: string): string {
    const v = m.categories.list.find((x) => x.id === cat)?.values.find((y) => y.id === value);
    return v?.glyph ?? "";
  }
</script>

<div
  class={`flex min-w-max flex-col items-center gap-1 rounded-2xl border-2 px-3 py-2 transition-transform duration-150 ${state === "satisfy" ? "border-satisfy" : state === "violate" ? "border-violate" : "border-ink/25"}`}
  class:animate-pulse={glow}
>
  <div class="flex items-center gap-1">
    {#each c.operands as o, i (o.cat + o.value)}
      {#if i > 0}<span class="text-sm tabular-nums opacity-80">{symbol()}</span>{/if}
      <Glyph ref={glyphOf(o.cat, o.value)} label={o.value} size={22} />
    {/each}
  </div>
  <span class="max-w-[10rem] text-center text-[10px] opacity-70">{c.clueText}</span>
</div>
