<script lang="ts">
  import { route, navigate } from "./lib/router.svelte";
  import { loadSave } from "./state/save.svelte";
  import { loadPalettes, loadUi, difficultyUi, type DifficultyUi } from "./lib/config";
  import Glyph from "./lib/Glyph.svelte";
  import Board from "./components/Board.svelte";
  import Stats from "./components/Stats.svelte";
  import Settings from "./components/Settings.svelte";
  import TierMeter from "./components/TierMeter.svelte";
  import DifficultyPicker from "./components/DifficultyPicker.svelte";
  import { applyMotion } from "./lib/motion";
  import { applyTheme } from "./lib/theme";
  import { applyAmbient } from "./lib/ambient";
  import { applyCrosshair } from "./lib/crosshair";
  import { nextPlayableTier } from "./lib/scoring";
  import type { Tier } from "./contracts/save";

  const TODAY = new Date().toISOString().slice(0, 10);
  const save = loadSave();
  const best = save.hero.bestMs;
  const streak = save.streak.count;
  applyMotion(save.settings.reducedMotion);
  // Write the exact palette tokens once config loads (boot already stamped the scheme).
  loadPalettes().then((p) => applyTheme(p, save.settings.palette, save.settings.theme));

  // Difficulty switcher: colour-coded bars (config/ui.json [difficulty]). One ui.json fetch
  // also seeds the ambient shell timing (drift + warm cross-fade).
  let difficulty = $state<DifficultyUi>(difficultyUi({} as never));
  let pickerOpen = $state(false);
  loadUi().then((ui) => {
    applyAmbient(ui);
    applyCrosshair(ui);
    difficulty = difficultyUi(ui);
  });

  // The tier PLAY will launch. First-ever = easy; a returning player resumes their last
  // tier UNLESS today's puzzle for it is already solved, in which case PLAY advances to the
  // next unsolved tier so it always lands on a playable puzzle (never a solved result card).
  // Re-read on navigation + once difficulty config loads (its order drives the advance).
  const currentTier = $derived.by((): Tier => {
    route();
    const sv = loadSave();
    return nextPlayableTier(sv.days, TODAY, difficulty.order, sv.settings.lastTier ?? "easy") as Tier;
  });
  // The standardized difficulty colour for the current tier (drives the pill name).
  const tierHue = $derived(difficulty.colors[currentTier] ?? "var(--accent)");

  function mmss(ms: number): string {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function play() {
    navigate(`play/${currentTier}`);
  }
</script>

{#if route().startsWith("/play")}
  {#key route()}
    <Board />
  {/key}
{:else if route() === "/stats"}
  <Stats />
{:else if route() === "/settings"}
  <Settings />
{:else}
  <main class="min-h-dvh flex flex-col items-center justify-center gap-8 p-6 text-center">
    <header class="flex w-full max-w-sm items-center justify-between">
      <div class="flex items-center gap-4">
        {#if streak >= 1}
          <a class="inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-medium tabular-nums text-near" href="stats" aria-label={`streak ${streak}`} onclick={(e) => { e.preventDefault(); navigate("stats"); }}>
            <Glyph ref="ui.flame" size={18} tint />{streak}
          </a>
        {/if}
        {#if best}
          <a class="inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-medium tabular-nums text-gold" href="stats" aria-label={`best ${mmss(best)}`} onclick={(e) => { e.preventDefault(); navigate("stats"); }}>
            <Glyph ref="ui.timer" size={18} tint />{mmss(best)}
          </a>
        {/if}
      </div>
      <a class="-mr-2 grid h-11 w-11 place-items-center rounded-full text-ink/70 transition-transform active:scale-95" href="settings" aria-label="settings" onclick={(e) => { e.preventDefault(); navigate("settings"); }}><Glyph ref="ui.sliders" label="settings" size={22} tint /></a>
    </header>

    <div class="flex w-full flex-col items-center gap-2 [container-type:inline-size]">
      <h1 class="wordmark whitespace-nowrap leading-[1.05] text-[min(5.5rem,10cqi)]">
        Yen Cinthanai
      </h1>
      <p class="text-balance text-sm opacity-70 sm:text-base">A quiet mystery for a curious mind.</p>
    </div>

    <div class="flex flex-col items-center gap-3">
      <button
        class="rounded-2xl px-12 py-5 text-xl font-bold uppercase tracking-wide bg-accent text-bg shadow-e2 active:scale-95 transition-transform"
        onclick={play}>play</button>
      <button
        class="inline-flex min-h-11 items-center gap-2.5 rounded-full border border-ink/10 bg-surface px-4 py-2 text-sm font-semibold shadow-e1 transition-transform active:scale-95"
        aria-label={`difficulty ${currentTier}, tap to change`}
        title={`difficulty: ${currentTier}`}
        onclick={() => (pickerOpen = true)}
      >
        <TierMeter tier={currentTier} {difficulty} height={16} label={false} />
        <span class="capitalize" style={`color:${tierHue}`}>{currentTier}</span>
      </button>
    </div>
  </main>

  {#if pickerOpen}
    <DifficultyPicker
      current={currentTier}
      {difficulty}
      onpick={(t) => { pickerOpen = false; navigate(`play/${t}`); }}
      onclose={() => (pickerOpen = false)}
    />
  {/if}
{/if}
