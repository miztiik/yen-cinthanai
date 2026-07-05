<script lang="ts">
  // DisplaySheet: the in-puzzle display-mode switcher - a bottom sheet (centered card on
  // desktop) with the three clarity toggles (color, glyphs, text labels), mirroring the
  // Settings > Display group and writing the same save.settings.display via the caller.
  // Invariant: at least one of glyphs/labels stays on. Scrim + Escape close. transform/opacity
  // only (reduced-motion zeroes it via app.css). Mirrors DifficultyPicker. See ui-shell.md.
  import type { DisplaySettings } from "../contracts/save";

  let {
    display,
    onchange,
    onclose,
  }: {
    display: DisplaySettings;
    onchange: (next: DisplaySettings) => void;
    onclose: () => void;
  } = $props();

  function onkey(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }
  // The invariant: turning one of glyphs/labels off forces the other on so a value always renders.
  function setColor(on: boolean) { onchange({ ...display, color: on }); }
  function setGlyphs(on: boolean) { onchange({ ...display, glyphs: on, labels: on ? display.labels : true }); }
  function setLabels(on: boolean) { onchange({ ...display, labels: on, glyphs: on ? display.glyphs : true }); }

  const rows = $derived([
    { key: "color", label: "Color", on: display.color, set: setColor },
    { key: "glyphs", label: "Glyphs", on: display.glyphs, set: setGlyphs },
    { key: "labels", label: "Text labels", on: display.labels, set: setLabels },
  ]);
</script>

<svelte:window onkeydown={onkey} />

<div class="fixed inset-0 z-30 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="display options">
  <button class="scrim absolute inset-0 bg-black/60" aria-label="close" onclick={onclose}></button>
  <div class="sheet relative w-full max-w-sm rounded-t-3xl border border-ink/10 bg-surface p-5 shadow-e4 sm:rounded-3xl">
    <p class="mb-3 text-center text-xs uppercase tracking-wide opacity-60">display</p>
    <div class="flex flex-col divide-y divide-ink/10">
      {#each rows as r (r.key)}
        <div class="flex min-h-12 items-center justify-between gap-4 py-2">
          <span class="text-base">{r.label}</span>
          <button
            role="switch"
            aria-checked={r.on}
            aria-label={r.label}
            class={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${r.on ? "bg-accent" : "bg-ink/15"}`}
            onclick={() => r.set(!r.on)}
          >
            <span class={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-bg shadow-e1 ring-1 ring-ink/10 transition-transform ${r.on ? "translate-x-5" : ""}`}></span>
          </button>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .scrim {
    animation: scrim-in 180ms ease-out;
  }
  .sheet {
    animation: sheet-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
</style>
