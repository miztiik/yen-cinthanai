<script lang="ts">
  // StatTile: one metric in the Stats bento - a glyph + big number (in a tone colour) over a
  // muted label, on a surface tile. The generic the ui-shell doc promised, so flame / best /
  // solved / stars share one component (no per-stat bespoke card). `emphasis` makes it the
  // hero (bigger number); `ring` adds a warm/gold hairline so hierarchy comes from size + one
  // accent, not decoration. Colour is never the only signal - every tile carries a glyph + a
  // word label. Read-only chrome; Tailwind tokens. See docs/concepts/ui-shell.md, Stats.svelte.
  import Glyph from "../lib/Glyph.svelte";

  let {
    glyph,
    label,
    value,
    tone = "text-ink",
    ring = "none",
    emphasis = false,
    class: cls = "",
  }: {
    glyph: string;
    label: string;
    value: string | number;
    tone?: string;
    ring?: "none" | "gold" | "near";
    emphasis?: boolean;
    class?: string;
  } = $props();

  const ringCls = $derived(ring === "gold" ? "ring-1 ring-gold/25" : ring === "near" ? "ring-1 ring-near/25" : "");
</script>

<div class={`flex flex-col justify-center gap-1.5 rounded-2xl bg-surface p-4 shadow-e1 ${ringCls} ${cls}`}>
  <span class={`flex items-center gap-2 ${tone}`}>
    <Glyph ref={glyph} size={emphasis ? 22 : 16} tint />
    <span class={`font-bold tabular-nums ${emphasis ? "text-5xl sm:text-6xl" : "text-3xl"}`}>{value}</span>
  </span>
  <span class="text-xs uppercase tracking-wide opacity-60">{label}</span>
</div>
