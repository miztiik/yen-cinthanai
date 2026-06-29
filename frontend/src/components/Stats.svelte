<script lang="ts">
  // Stats: flame, best, last-N solve sparkline, 7-day dots, stars earned. Read-only,
  // reachable <=2 taps from home. No shame: a missed day is a quiet gap, never a
  // scold (ui-shell.md, difficulty-and-scoring.md). Sparkline bars use height +
  // opacity only. All numbers come from the save; window from config pace.
  import { homeHref, navigate } from "../lib/router.svelte";
  import { loadSave } from "../state/save.svelte";
  import { loadPace } from "../lib/config";
  import { recentSolveMs } from "../lib/scoring";

  const save = loadSave();
  let window = $state(10);
  loadPace().then((p) => (window = p.stats_window));

  const times = $derived(recentSolveMs(save.days, window));
  const peak = $derived(Math.max(1, ...times));
  const stars = $derived(Object.values(save.days).reduce((n, d) => n + d.stars, 0));
  const solved = $derived(Object.values(save.days).filter((d) => d.status === "won").length);

  // last 7 UTC days: won (filled) | other-day (open) | none (gap). Quiet, never shaming.
  function lastWeek(): { date: string; won: boolean }[] {
    const out: { date: string; won: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      out.push({ date: d, won: save.days[d]?.status === "won" });
    }
    return out;
  }
  const week = lastWeek();
</script>

<main class="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
  <header class="flex items-center justify-between text-sm">
    <a href={homeHref()} onclick={(e) => { e.preventDefault(); navigate(""); }}>back</a>
    <span class="uppercase tracking-wide opacity-70">stats</span>
    <span></span>
  </header>

  <section class="grid grid-cols-3 gap-3 text-center">
    <div class="rounded-2xl bg-surface p-4"><p class="text-3xl font-bold tabular-nums">{save.streak.count}</p><p class="text-xs opacity-60">flame</p></div>
    <div class="rounded-2xl bg-surface p-4"><p class="text-3xl font-bold tabular-nums">{save.hero.bestMs ? `${Math.round(save.hero.bestMs / 1000)}s` : "-"}</p><p class="text-xs opacity-60">best</p></div>
    <div class="rounded-2xl bg-surface p-4"><p class="text-3xl font-bold tabular-nums">{solved}</p><p class="text-xs opacity-60">solved</p></div>
  </section>

  <section>
    <p class="mb-2 text-xs uppercase tracking-wide opacity-60">recent times</p>
    {#if times.length}
      <div class="flex h-24 items-end gap-1">
        {#each times as t (t)}
          <div class="flex-1 rounded-t bg-accent" style={`height:${Math.max(8, (t / peak) * 100)}%`} title={`${Math.round(t / 1000)}s`}></div>
        {/each}
      </div>
    {:else}
      <p class="text-sm opacity-50">play a few days to see your trend</p>
    {/if}
  </section>

  <section>
    <p class="mb-2 text-xs uppercase tracking-wide opacity-60">last 7 days</p>
    <div class="flex gap-2">
      {#each week as d (d.date)}
        <div class="h-6 w-6 rounded-full" class:bg-accent={d.won} class:bg-surface={!d.won} aria-label={d.won ? "solved" : "open"}></div>
      {/each}
    </div>
  </section>

  <section class="rounded-2xl bg-surface p-4 text-center">
    <p class="text-3xl font-bold tabular-nums text-gold">{stars}</p>
    <p class="text-xs opacity-60">stars earned</p>
  </section>
</main>
