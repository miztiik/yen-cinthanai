<script lang="ts">
  // Settings hub: Audio, Look, Data, Credits (4 groups, ui-shell.md). Sound is
  // mute-default; every change persists to save.settings and takes effect at once
  // (audio reconfigured, motion flag stamped). Data exports/clears the save. Credits
  // names asset licenses (config/copy.toml). Chrome only - Tailwind, transform/opacity.
  import { homeHref, navigate } from "../lib/router.svelte";
  import { loadSave, updateSettings } from "../state/save.svelte";
  import { loadCopy, type CopyBags } from "../lib/config";
  import { configureAudio, play } from "../lib/audio";
  import { applyMotion } from "../lib/motion";
  import { glyphs } from "../lib/glyphs";

  const TODAY = new Date().toISOString().slice(0, 10);
  const THEMES = Object.keys(glyphs.packs); // packs are config-baked, never hardcoded
  const PALETTES = ["default", "warm", "cool"];

  let s = $state(loadSave().settings);
  let copy = $state<CopyBags>({ success: [], encourage: [], hero: [] });
  loadCopy().then((c) => (copy = c));
  applyMotion(s.reducedMotion);
  configureAudio(s.sound, s.volume);

  function save() {
    updateSettings(s, TODAY);
    configureAudio(s.sound, s.volume);
    applyMotion(s.reducedMotion);
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

  <section class="rounded-2xl bg-slate-800 p-4">
    <h2 class="mb-3 text-xs uppercase tracking-widest opacity-60">audio</h2>
    <label class="flex items-center justify-between py-2"><span>sound</span>
      <button class="rounded-full px-4 py-1 text-sm font-bold active:scale-95 transition-transform" class:bg-emerald-500={s.sound} class:text-black={s.sound} class:bg-slate-600={!s.sound} onclick={() => setSound(!s.sound)}>{s.sound ? "on" : "off"}</button>
    </label>
    <label class="flex items-center justify-between gap-4 py-2"><span>volume</span>
      <input class="flex-1" type="range" min="0" max="1" step="0.1" value={s.volume} disabled={!s.sound} oninput={(e) => setVol(+e.currentTarget.value)} aria-label="volume" />
    </label>
  </section>

  <section class="rounded-2xl bg-slate-800 p-4">
    <h2 class="mb-3 text-xs uppercase tracking-widest opacity-60">look</h2>
    <label class="flex items-center justify-between py-2"><span>theme</span>
      <select class="rounded-lg bg-slate-700 px-3 py-1" value={s.theme} onchange={(e) => { s.theme = e.currentTarget.value; save(); }} aria-label="theme">
        {#each THEMES as t (t)}<option value={t}>{t}</option>{/each}
      </select>
    </label>
    <label class="flex items-center justify-between py-2"><span>palette</span>
      <select class="rounded-lg bg-slate-700 px-3 py-1" value={s.palette} onchange={(e) => { s.palette = e.currentTarget.value; save(); }} aria-label="palette">
        {#each PALETTES as p (p)}<option value={p}>{p}</option>{/each}
      </select>
    </label>
    <label class="flex items-center justify-between py-2"><span>reduced motion</span>
      <button class="rounded-full px-4 py-1 text-sm font-bold active:scale-95 transition-transform" class:bg-emerald-500={s.reducedMotion} class:text-black={s.reducedMotion} class:bg-slate-600={!s.reducedMotion} onclick={() => { s.reducedMotion = !s.reducedMotion; save(); }}>{s.reducedMotion ? "on" : "off"}</button>
    </label>
  </section>

  <section class="rounded-2xl bg-slate-800 p-4">
    <h2 class="mb-3 text-xs uppercase tracking-widest opacity-60">data</h2>
    <div class="flex gap-3">
      <button class="flex-1 rounded-xl bg-slate-600 px-4 py-2 active:scale-95 transition-transform" onclick={exportSave}>export</button>
      <button class="flex-1 rounded-xl bg-rose-700 px-4 py-2 font-semibold active:scale-95 transition-transform" onclick={resetSave}>reset</button>
    </div>
  </section>

  <section class="rounded-2xl bg-slate-800 p-4 text-sm opacity-80">
    <h2 class="mb-3 text-xs uppercase tracking-widest opacity-60">credits</h2>
    <p>{copy.credits?.intro ?? "All glyphs original art."}</p>
    <p class="opacity-60">{copy.credits?.license ?? "CC0 - no third-party assets."}</p>
  </section>
</main>
