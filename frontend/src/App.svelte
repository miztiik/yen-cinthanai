<script lang="ts">
  import { route, navigate, homeHref } from "./lib/router.svelte";
  import { loadSave } from "./state/save.svelte";
  import { loadBank } from "./lib/loader";
  import { loadShapes, type ShapeDef } from "./lib/shapes";
  import { loadPalettes } from "./lib/config";
  import Glyph from "./lib/Glyph.svelte";
  import Board from "./components/Board.svelte";
  import Stats from "./components/Stats.svelte";
  import Settings from "./components/Settings.svelte";
  import { applyMotion } from "./lib/motion";
  import { applyTheme } from "./lib/theme";
  import type { Tier } from "./contracts/save";

  const save = loadSave();
  const best = save.hero.bestMs;
  const streak = save.streak.count;
  applyMotion(save.settings.reducedMotion);
  // Write the exact palette tokens once config loads (boot already stamped the scheme).
  loadPalettes().then((p) => applyTheme(p, save.settings.palette, save.settings.theme));
  const tiers: Tier[] = ["easy", "standard", "sharp", "expert"];
  const DEFERRED: { id: string; label: string }[] = []; // round-table is live (P8); next shapes wait

  let shapes = $state<Record<string, ShapeDef>>({});
  let entries = $state<{ tier: Tier; shapeId: string }[]>([]);

  async function loadDrawer() {
    try {
      shapes = await loadShapes();
      entries = (await loadBank()).puzzles.map((p) => ({ tier: p.tier, shapeId: p.shapeId }));
    } catch {
      shapes = {};
    }
  }
  loadDrawer();

  /** First tier offering this shape - the drawer chip changes the next puzzle. */
  function firstTier(shapeId: string): Tier | null {
    return entries.find((e) => e.shapeId === shapeId)?.tier ?? null;
  }

  function mmss(ms: number): string {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function play() {
    navigate("play");
  }
</script>

{#if route().startsWith("/play")}
  <Board />
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

    <div class="flex flex-col items-center gap-2">
      <h1 class="wordmark text-balance leading-[1.05] tracking-[0.01em] text-[clamp(3rem,16vw,6rem)]">
        Yen<br />Cinthanai
      </h1>
      <p class="text-balance text-sm opacity-70 sm:text-base">A quiet mystery for a curious mind.</p>
    </div>

    {#if route() === "/"}
      <button
        class="rounded-2xl px-12 py-5 text-xl font-bold uppercase tracking-wide bg-accent text-bg shadow-e2 active:scale-95 transition-transform"
        onclick={play}>play</button>
      <a class="text-sm underline opacity-70" href="puzzles" onclick={(e) => { e.preventDefault(); navigate("puzzles"); }}>more puzzles</a>
    {:else if route() === "/puzzles"}
      <section class="flex flex-col items-center gap-3">
        <p class="text-xs uppercase tracking-wide opacity-50">shape</p>
        <div class="flex flex-wrap justify-center gap-3">
          {#each Object.entries(shapes) as [id, s] (id)}
            <button
              class="flex flex-col items-center gap-1 rounded-2xl bg-surface px-5 py-3 active:scale-95 transition-transform disabled:opacity-30"
              disabled={!firstTier(id)}
              onclick={() => { const t = firstTier(id); if (t) navigate(`play/${t}`); }}>
              <Glyph ref={s.glyph} label={id} size={28} />
              <span class="text-xs">{id.replace("-", " ")}</span>
            </button>
          {/each}
          {#each DEFERRED as d (d.id)}
            <button class="flex flex-col items-center gap-1 rounded-2xl bg-surface px-5 py-3 opacity-30" disabled aria-label={`${d.label} (v2)`}>
              <Glyph ref="abstract.grid" label={d.label} size={28} />
              <span class="text-xs">{d.label}</span>
            </button>
          {/each}
        </div>
      </section>
      <section class="flex flex-col items-center gap-3">
        <p class="text-xs uppercase tracking-wide opacity-50">tier</p>
        <div class="flex flex-col gap-3">
          {#each tiers as t (t)}
            <button
              class="rounded-2xl bg-surface px-10 py-3 text-lg font-semibold uppercase tracking-wide active:scale-95 transition-transform"
              onclick={() => navigate(`play/${t}`)}>{t}</button>
          {/each}
        </div>
      </section>
      <a class="text-sm underline opacity-70" href={homeHref()} onclick={(e) => { e.preventDefault(); navigate(""); }}>back</a>
    {:else}
      <p class="opacity-80">route: {route()}</p>
      <a class="text-sm underline opacity-70" href={homeHref()} onclick={(e) => { e.preventDefault(); navigate(""); }}>back</a>
    {/if}
  </main>
{/if}
