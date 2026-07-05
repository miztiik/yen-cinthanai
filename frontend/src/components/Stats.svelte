<script lang="ts">
  // Stats: flame, best, last-N solve sparkline, 7-day calendar, stars earned. Read-only,
  // reachable <=2 taps from home. No shame: a missed day is a quiet outline, never a
  // scold (ui-shell.md, difficulty-and-scoring.md). A bento grid bounded at max-w-3xl so it
  // never strands one thin column in a wide desktop field; hierarchy from tile size + one
  // gold accent, not decoration. Sparkline bars use height + opacity only. All numbers come
  // from the save; window from config pace.
  import { homeHref, navigate } from "../lib/router.svelte";
  import { loadSave } from "../state/save.svelte";
  import { loadPace } from "../lib/config";
  import { recentSolveMs, wonOnDate } from "../lib/scoring";
  import Glyph from "../lib/Glyph.svelte";
  import StatTile from "./StatTile.svelte";

  const save = loadSave();
  let window = $state(10);
  loadPace().then((p) => (window = p.stats_window));

  const times = $derived(recentSolveMs(save.days, window));
  const peak = $derived(Math.max(1, ...times));
  const stars = $derived(Object.values(save.days).reduce((n, d) => n + d.stars, 0));
  const solved = $derived(Object.values(save.days).filter((d) => d.status === "won").length);

  // last 7 UTC days: won (filled) | other-day (open) | none (gap). Quiet, never shaming.
  // A day counts as won if ANY tier/shape slot for that date won (days are composite-keyed).
  const WD = ["s", "m", "t", "w", "t", "f", "s"];
  function lastWeek(): { date: string; won: boolean; wd: string }[] {
    const out: { date: string; won: boolean; wd: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      out.push({ date: d, won: wonOnDate(save.days, d), wd: WD[new Date(d).getUTCDay()] });
    }
    return out;
  }
  const week = lastWeek();
</script>

<main class="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4 sm:max-w-3xl sm:gap-6 sm:p-6">
  <header class="flex items-center justify-between text-sm">
    <a class="grid h-11 w-11 place-items-center rounded-lg opacity-80 transition-transform active:scale-95" href={homeHref()} aria-label="back" onclick={(e) => { e.preventDefault(); navigate(""); }}>
      <Glyph ref="ui.back" size={18} tint />
    </a>
    <span class="uppercase tracking-wide opacity-70">stats</span>
    <span class="h-11 w-11"></span>
  </header>

  <section class="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
    <StatTile glyph="ui.flame" label="day streak" value={save.streak.count} tone="text-near" ring="near" emphasis class="col-span-2 sm:row-span-2" />
    <StatTile glyph="ui.timer" label="best" value={save.hero.bestMs ? `${Math.round(save.hero.bestMs / 1000)}s` : "-"} />
    <StatTile glyph="ui.crown" label="solved" value={solved} />

    <section class="col-span-2 flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-e1">
      <p class="flex items-center gap-1.5 text-xs uppercase tracking-wide opacity-60"><Glyph ref="ui.timer" size={14} tint />recent times</p>
      {#if times.length}
        <div class="flex h-20 items-end gap-1">
          {#each times as t (t)}
            <div class="flex-1 rounded-t bg-accent" style={`height:${Math.max(8, (t / peak) * 100)}%;opacity:${0.55 + 0.45 * (t / peak)}`} title={`${Math.round(t / 1000)}s`}></div>
          {/each}
        </div>
      {:else}
        <p class="grid h-20 place-items-center text-center text-sm opacity-50">play a few days to see your trend</p>
      {/if}
    </section>

    <section class="col-span-2 flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-e1 sm:col-span-4">
      <p class="text-xs uppercase tracking-wide opacity-60">last 7 days</p>
      <div class="flex justify-between">
        {#each week as d, i (d.date)}
          <div class="flex flex-col items-center gap-1.5">
            <div
              class={`grid h-8 w-8 place-items-center rounded-full ${d.won ? "bg-accent text-bg" : "ring-1 ring-ink/15"} ${i === week.length - 1 ? "ring-2 ring-ink/40" : ""}`}
              aria-label={d.won ? `${d.date} solved` : `${d.date} open`}
            >
              {#if d.won}<Glyph ref="ui.star" size={13} tint />{/if}
            </div>
            <span class="text-[10px] uppercase opacity-40">{d.wd}</span>
          </div>
        {/each}
      </div>
    </section>

    <StatTile glyph="ui.star" label="stars earned" value={stars} tone="text-gold" ring="gold" class="col-span-2 sm:col-span-4" />
  </section>
</main>

