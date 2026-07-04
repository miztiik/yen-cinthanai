<script lang="ts">
  // Settings hub: Audio, Look, Data (3 groups, ui-shell.md). Sound is mute-default; every
  // change persists to save.settings and takes effect at once (audio reconfigured, motion
  // flag stamped). Data exports/clears the save. Credits removed - assets are original/CC0.
  // Chrome only - Tailwind, transform/opacity.
  import { homeHref, navigate } from "../lib/router.svelte";
  import { loadSave, updateSettings } from "../state/save.svelte";
  import type { PuckSize } from "../contracts/save";
  import { loadPalettes, type Palettes } from "../lib/config";
  import { configureAudio, play } from "../lib/audio";
  import { applyMotion } from "../lib/motion";
  import { applyTheme } from "../lib/theme";

  const TODAY = new Date().toISOString().slice(0, 10);

  let s = $state(loadSave().settings);
  // Theme modes + palettes are config-driven (config/palettes.json), never hardcoded.
  let themes = $state<string[]>(["light", "dark", "system"]);
  let palettes = $state<string[]>([]);
  let palConfig = $state<Palettes | null>(null);
  loadPalettes().then((p) => {
    palConfig = p;
    themes = p.themes;
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

<main class="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
  <header class="flex items-center justify-between text-sm">
    <a href={homeHref()} onclick={(e) => { e.preventDefault(); navigate(""); }}>back</a>
    <span class="uppercase tracking-wide opacity-70">settings</span>
    <span></span>
  </header>

  <section class="rounded-2xl bg-surface p-4">
    <h2 class="mb-3 text-xs uppercase tracking-widest opacity-60">audio</h2>
    <label class="flex items-center justify-between py-2"><span>sound</span>
      <button class="rounded-full px-4 py-1 text-sm font-bold active:scale-95 transition-transform" class:bg-accent={s.sound} class:text-bg={s.sound} class:bg-bg={!s.sound} onclick={() => setSound(!s.sound)}>{s.sound ? "on" : "off"}</button>
    </label>
    <label class="flex items-center justify-between gap-4 py-2"><span>volume</span>
      <input class="flex-1" type="range" min="0" max="1" step="0.1" value={s.volume} disabled={!s.sound} oninput={(e) => setVol(+e.currentTarget.value)} aria-label="volume" />
    </label>
  </section>

  <section class="rounded-2xl bg-surface p-4">
    <h2 class="mb-3 text-xs uppercase tracking-widest opacity-60">look</h2>
    <label class="flex items-center justify-between py-2"><span>theme</span>
      <select class="rounded-lg bg-bg px-3 py-1" value={s.theme} onchange={(e) => { s.theme = e.currentTarget.value; save(); }} aria-label="theme">
        {#each themes as t (t)}<option value={t}>{t}</option>{/each}
      </select>
    </label>
    <label class="flex items-center justify-between py-2"><span>palette</span>
      <select class="rounded-lg bg-bg px-3 py-1" value={s.palette} onchange={(e) => { s.palette = e.currentTarget.value; save(); }} aria-label="palette">
        {#each palettes as p (p)}<option value={p}>{palConfig?.palette[p]?.label ?? p}</option>{/each}
      </select>
    </label>
    <label class="flex items-center justify-between py-2"><span>reduced motion</span>
      <button class="rounded-full px-4 py-1 text-sm font-bold active:scale-95 transition-transform" class:bg-accent={s.reducedMotion} class:text-bg={s.reducedMotion} class:bg-bg={!s.reducedMotion} onclick={() => { s.reducedMotion = !s.reducedMotion; save(); }}>{s.reducedMotion ? "on" : "off"}</button>
    </label>
    <label class="flex items-center justify-between py-2"><span>puck size</span>
      <select class="rounded-lg bg-bg px-3 py-1" value={s.puckSize} onchange={(e) => { s.puckSize = e.currentTarget.value as PuckSize; save(); }} aria-label="puck size">
        {#each ["small", "medium", "large"] as z (z)}<option value={z}>{z}</option>{/each}
      </select>
    </label>
  </section>

  <section class="rounded-2xl bg-surface p-4">
    <h2 class="mb-3 text-xs uppercase tracking-widest opacity-60">data</h2>
    <div class="flex gap-3">
      <button class="flex-1 rounded-xl bg-bg px-4 py-2 active:scale-95 transition-transform" onclick={exportSave}>export</button>
      <button class="flex-1 rounded-xl bg-violate px-4 py-2 font-semibold active:scale-95 transition-transform" onclick={resetSave}>reset</button>
    </div>
  </section>
</main>
