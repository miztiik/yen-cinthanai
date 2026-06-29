<script lang="ts">
  import { route, navigate, homeHref } from "./lib/router.svelte";
  import { loadSave } from "./state/save.svelte";
  import Board from "./components/Board.svelte";

  const save = loadSave();
  const best = save.hero.bestMs;
  const streak = save.streak.count;

  function play() {
    navigate("play");
  }
</script>

{#if route() === "/play"}
  <Board />
{:else}
  <main class="min-h-dvh flex flex-col items-center justify-center gap-8 p-6 text-center">
    <header class="flex w-full max-w-sm items-center justify-between text-sm opacity-70">
      <span class="tabular-nums">flame {streak}</span>
      <span class="tabular-nums">best {best ? `${Math.round(best / 1000)}s` : "-"}</span>
      <a href="settings" aria-label="settings" onclick={(e) => { e.preventDefault(); navigate("settings"); }}>gear</a>
    </header>

    <h1 class="text-3xl font-semibold tracking-tight">yen-cinthanai</h1>

    {#if route() === "/"}
      <button
        class="rounded-2xl px-12 py-5 text-xl font-bold uppercase tracking-wide bg-emerald-500 text-black active:scale-95 transition-transform"
        onclick={play}>play</button>
      <a class="text-sm underline opacity-70" href="puzzles" onclick={(e) => { e.preventDefault(); navigate("puzzles"); }}>more puzzles</a>
    {:else}
      <p class="opacity-80">route: {route()}</p>
      <a class="text-sm underline opacity-70" href={homeHref()} onclick={(e) => { e.preventDefault(); navigate(""); }}>back</a>
    {/if}
  </main>
{/if}
