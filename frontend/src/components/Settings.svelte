<script lang="ts">
  // Settings hub: Sound, Appearance, Data. Every change persists to save.settings and takes
  // effect at once (audio reconfigured, motion flag stamped, theme applied). Title Case,
  // sliding switches, segmented controls, palette swatch chips. Chrome only - Tailwind,
  // transform/opacity. See docs/concepts/ui-shell.md.
  import { homeHref, navigate } from "../lib/router.svelte";
  import { loadSave, updateSettings } from "../state/save.svelte";
  import type { PuckSize } from "../contracts/save";
  import { loadPalettes, type Palettes } from "../lib/config";
  import { configureAudio, play } from "../lib/audio";
  import { applyMotion } from "../lib/motion";
  import { applyTheme, resolveScheme } from "../lib/theme";
  import Glyph from "../lib/Glyph.svelte";

  const TODAY = new Date().toISOString().slice(0, 10);
  const THEMES: { id: string; label: string }[] = [
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
    { id: "system", label: "Auto" },
  ];
  const PUCKS: { id: PuckSize; label: string }[] = [
    { id: "small", label: "S" },
    { id: "medium", label: "M" },
    { id: "large", label: "L" },
  ];

  let s = $state(loadSave().settings);
  let palettes = $state<string[]>([]);
  let palConfig = $state<Palettes | null>(null);
  loadPalettes().then((p) => {
    palConfig = p;
    palettes = Object.keys(p.palette);
    applyTheme(p, s.palette, s.theme);
  });
  applyMotion(s.reducedMotion);
  configureAudio(s.sound, s.volume);

  function save() {
    updateSettings(s, TODAY);
    configureAudio(s.sound, s.volume);
    applyMotion(s.reducedMotion);
    applyTheme(palConfig, s.palette, s.theme);
  }
  function setSound(on: boolean) { s.sound = on; if (on && s.volume === 0) s.volume = 0.6; save(); if (on) play("satisfy"); }
  function setVol(v: number) { s.volume = v; save(); play("place"); }
  function setTheme(t: string) { s.theme = t; save(); }
  function setPalette(p: string) { s.palette = p; save(); play("place"); }
  function setPuck(z: PuckSize) { s.puckSize = z; save(); }
  function toggleMotion() { s.reducedMotion = !s.reducedMotion; save(); }
  /** A palette's bg + accent for the resolved scheme (the swatch preview colours). */
  function swatch(id: string): { bg: string; accent: string } {
    const set = palConfig?.palette[id]?.[resolveScheme(s.theme)];
    return { bg: set?.bg ?? "#000000", accent: set?.accent ?? "#888888" };
  }

  function exportSave() {
    const blob = new Blob([JSON.stringify(loadSave(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yen-cinthanai-save.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  function resetSave() {
    if (!confirm("Erase all progress, stats, and settings?")) return;
    localStorage.removeItem("yen-cinthanai/save");
    navigate("");
  }
</script>

<main class="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-5 sm:p-6">
  <header class="grid grid-cols-[2.75rem_1fr_2.75rem] items-center">
    <a href={homeHref()} aria-label="back" class="grid h-11 w-11 place-items-center rounded-full text-ink/70 transition-transform active:scale-95" onclick={(e) => { e.preventDefault(); navigate(""); }}><Glyph ref="ui.back" size={20} tint /></a>
    <h1 class="text-center text-base font-semibold">Settings</h1>
    <span></span>
  </header>

  <section class="overflow-hidden rounded-2xl bg-surface shadow-e1">
    <h2 class="px-4 pt-3 pb-1 text-xs font-semibold text-ink/50">Sound</h2>
    <div class="px-4 pb-2">
      <div class="flex min-h-11 items-center justify-between gap-4 py-1.5">
        <span>Sound</span>
        <button role="switch" aria-checked={s.sound} aria-label="sound" class={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${s.sound ? "bg-accent" : "bg-ink/15"}`} onclick={() => setSound(!s.sound)}>
          <span class={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-bg shadow-e1 ring-1 ring-ink/10 transition-transform ${s.sound ? "translate-x-5" : ""}`}></span>
        </button>
      </div>
      <div class={`grid transition-all duration-200 ${s.sound ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div class="min-h-0 overflow-hidden">
          <div class="flex min-h-11 items-center justify-between gap-4 border-t border-ink/10 py-1.5">
            <span>Volume</span>
            <input class="h-1.5 flex-1 accent-accent" type="range" min="0" max="1" step="0.1" value={s.volume} oninput={(e) => setVol(+e.currentTarget.value)} aria-label="volume" />
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="overflow-hidden rounded-2xl bg-surface shadow-e1">
    <h2 class="px-4 pt-3 pb-1 text-xs font-semibold text-ink/50">Appearance</h2>
    <div class="divide-y divide-ink/10 px-4">
      <div class="flex min-h-11 items-center justify-between gap-4 py-2">
        <span>Theme</span>
        <div role="radiogroup" aria-label="theme" class="flex w-44 rounded-xl bg-bg p-1">
          {#each THEMES as t (t.id)}
            <button role="radio" aria-checked={s.theme === t.id} class={`flex-1 rounded-lg px-2 py-1.5 text-sm transition-colors ${s.theme === t.id ? "bg-accent text-bg font-semibold shadow-e1" : "text-ink/60"}`} onclick={() => setTheme(t.id)}>{t.label}</button>
          {/each}
        </div>
      </div>
      <div class="py-2.5">
        <span class="mb-2 block">Palette</span>
        <div class="grid grid-cols-2 gap-2">
          {#each palettes as id (id)}
            {@const sw = swatch(id)}
            <button aria-pressed={s.palette === id} class={`relative flex items-center gap-2.5 rounded-xl border border-ink/10 p-2 transition-transform active:scale-[0.98] ${s.palette === id ? "ring-2 ring-accent" : ""}`} onclick={() => setPalette(id)}>
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ring-black/10" style={`background:${sw.bg}`}>
                <span class="h-4 w-4 rounded-full" style={`background:${sw.accent}`}></span>
              </span>
              <span class="text-sm">{palConfig?.palette[id]?.label ?? id}</span>
              {#if s.palette === id}<span class="absolute right-2 top-2 text-accent"><Glyph ref="ui.check" size={14} tint /></span>{/if}
            </button>
          {/each}
        </div>
      </div>
      <div class="flex min-h-11 items-center justify-between gap-4 py-2">
        <span>Reduced motion</span>
        <button role="switch" aria-checked={s.reducedMotion} aria-label="reduced motion" class={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${s.reducedMotion ? "bg-accent" : "bg-ink/15"}`} onclick={toggleMotion}>
          <span class={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-bg shadow-e1 ring-1 ring-ink/10 transition-transform ${s.reducedMotion ? "translate-x-5" : ""}`}></span>
        </button>
      </div>
      <div class="flex min-h-11 items-center justify-between gap-4 py-2">
        <span>Puck size</span>
        <div role="radiogroup" aria-label="puck size" class="flex w-28 rounded-xl bg-bg p-1">
          {#each PUCKS as z (z.id)}
            <button role="radio" aria-checked={s.puckSize === z.id} class={`flex-1 rounded-lg px-2 py-1.5 text-sm transition-colors ${s.puckSize === z.id ? "bg-accent text-bg font-semibold shadow-e1" : "text-ink/60"}`} onclick={() => setPuck(z.id)}>{z.label}</button>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <section class="overflow-hidden rounded-2xl bg-surface shadow-e1">
    <h2 class="px-4 pt-3 pb-1 text-xs font-semibold text-ink/50">Data</h2>
    <div class="flex gap-3 p-4 pt-2">
      <button class="flex-1 rounded-xl bg-bg py-2.5 font-medium transition-transform active:scale-95" onclick={exportSave}>Export</button>
      <button class="flex-1 rounded-xl border border-violate/40 py-2.5 font-medium text-violate transition-transform active:scale-95" onclick={resetSave}>Reset</button>
    </div>
  </section>
</main>
