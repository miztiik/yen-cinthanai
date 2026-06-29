<script lang="ts">
  import { route, navigate, homeHref } from "./lib/router.svelte";
  import { loadSave } from "./state/save.svelte";
  import Board from "./components/Board.svelte";
  import Stats from "./components/Stats.svelte";
  import type { Tier } from "./contracts/save";

  const save = loadSave();
  const best = save.hero.bestMs;
  const streak = save.streak.count;
  const tiers: Tier[] = ["easy", "standard", "sharp", "expert"];

  function play() {
    navigate("play");
  }
</script>

{#if route().startsWith("/play")}
  <Board />
{:else if route() === "/stats"}
  <Stats />
{:else}
  <main class="min-h-dvh flex flex-col items-center justify-center gap-8 p-6 text-center">
    <header class="flex w-full max-w-sm items-center justify-between text-sm opacity-70">
      <a class="tabular-nums" href="stats" onclick={(e) => { e.preventDefault(); navigate("stats"); }}>flame {streak}</a>
      <a class="tabular-nums" href="stats" onclick={(e) => { e.preventDefault(); navigate("stats"); }}>best {best ? `${Math.round(best / 1000)}s` : "-"}</a>
      <a href="settings" aria-label="settings" onclick={(e) => { e.preventDefault(); navigate("settings"); }}>gear</a>
    </header>

    <h1 class="text-3xl font-semibold tracking-tight">yen-cinthanai</h1>

    {#if route() === "/"}
      <button
        class="rounded-2xl px-12 py-5 text-xl font-bold uppercase tracking-wide bg-emerald-500 text-black active:scale-95 transition-transform"
        onclick={play}>play</button>
      <a class="text-sm underline opacity-70" href="puzzles" onclick={(e) => { e.preventDefault(); navigate("puzzles"); }}>more puzzles</a>
    {:else if route() === "/puzzles"}
      <div class="flex flex-col gap-3">
        {#each tiers as t (t)}
          <button
            class="rounded-2xl bg-slate-700 px-10 py-3 text-lg font-semibold uppercase tracking-wide active:scale-95 transition-transform"
            onclick={() => navigate(`play/${t}`)}>{t}</button>
        {/each}
      </div>
      <a class="text-sm underline opacity-70" href={homeHref()} onclick={(e) => { e.preventDefault(); navigate(""); }}>back</a>
    {:else}
      <p class="opacity-80">route: {route()}</p>
      <a class="text-sm underline opacity-70" href={homeHref()} onclick={(e) => { e.preventDefault(); navigate(""); }}>back</a>
    {/if}
  </main>
{/if}
