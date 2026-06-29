<script lang="ts">
  // Board screen: load today's standard, build the game, wire HUD + clue strip + grid
  // + pools + actions, lock + celebrate on win. PLAY enters here; one-tap back to home.
  // Progress persists to save on every commit. Chrome is Tailwind; the canvas-equal is
  // the SlotBoard. transform/opacity feedback only. See ui-shell.md, core-loop.md.
  import SlotBoard from "./SlotBoard.svelte";
  import Pool from "./Pool.svelte";
  import ClueChip from "./ClueChip.svelte";
  import Glyph from "../lib/Glyph.svelte";
  import { route, homeHref, navigate } from "../lib/router.svelte";
  import { loadBank, loadManifest, pickEntry } from "../lib/loader";
  import { loadTiers, loadCopy, loadPace, pick, type TierDial, type CopyBags, type Pace } from "../lib/config";
  import { isHero } from "../lib/scoring";
  import { Game, saveProgress } from "../state/play.svelte";
  import { loadSave } from "../state/save.svelte";
  import type { Tier } from "../contracts/save";

  const TODAY = new Date().toISOString().slice(0, 10);
  const ALLOWED: Tier[] = ["easy", "standard", "sharp", "expert"];

  let game = $state<Game | null>(null);
  let copy = $state<CopyBags>({ success: [], encourage: [], hero: [] });
  let pace = $state<Pace>({ idle_pulse_s: 12, idle_glow_s: 25, stats_window: 10 });
  let error = $state("");
  let elapsed = $state(0);
  let idleMs = $state(0);
  let hero = $state(false);
  let heroBaseline = { bestMs: 0, date: "" };

  /** Tier from /play/<tier>, default standard; resumes last if just /play. */
  function wantedTier(): Tier {
    const seg = route().split("/")[2] as Tier;
    return ALLOWED.includes(seg) ? seg : "standard";
  }

  async function start() {
    try {
      const tier = wantedTier();
      const bank = await loadBank();
      const entry =
        bank.puzzles.find((p) => p.date === TODAY && p.tier === tier) ??
        bank.puzzles.find((p) => p.tier === tier) ??
        pickEntry(bank, bank.puzzles[0].date, bank.puzzles[0].tier);
      const m = await loadManifest(entry.file);
      const tiers = await loadTiers();
      const dial: TierDial = tiers[m.tier] ?? { par_s: 240, hints: -1, attempts: -1, feedback: "realtime-names" };
      copy = await loadCopy();
      pace = await loadPace();
      const prior = loadSave().days[m.puzzleId];
      heroBaseline = { ...loadSave().hero };
      game = new Game(m, dial, prior);
      tick();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  function tick() {
    if (!game) return;
    if (!game.locked) {
      elapsed = Date.now() - game.startedMs;
      idleMs = Date.now() - game.lastMoveMs;
    }
    requestAnimationFrame(tick);
  }

  $effect(() => {
    if (game) {
      void game.placements; // track commits
      void game.locked;
      const won = game.locked;
      hero = won && isHero(heroBaseline, game.solveMs, game.hintsUsed);
      saveProgress(game);
    }
  });

  const wonText = $derived(game?.locked ? (hero ? pick(copy.hero) : pick(copy.success)) : pick(copy.encourage));
  const hintsLeft = $derived(game?.hintsLeft ?? -1);
  const pulse = $derived(!!game && !game.locked && idleMs > pace.idle_pulse_s * 1000);
  const glow = $derived(!!game && !game.locked && idleMs > pace.idle_glow_s * 1000);
  const submitLabel = $derived(game?.dial.feedback === "submit-binary" ? "submit" : "check");
  start();
</script>

<main class="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
  <header class="flex items-center justify-between text-sm">
    <a href={homeHref()} aria-label="back" onclick={(e) => { e.preventDefault(); navigate(""); }}>back</a>
    <span class="uppercase tracking-wide opacity-70">{game?.m.tier ?? ""}</span>
    <span class="tabular-nums opacity-70">{Math.floor(elapsed / 1000)}s</span>
    {#if game && game.attemptsLeft >= 0}<span class="tabular-nums opacity-70" aria-label="attempts left">try {game.attemptsLeft}</span>{/if}
    <button
      class="rounded-lg px-2 disabled:opacity-30"
      disabled={!game || game.locked || hintsLeft === 0}
      onclick={() => game?.hint()}>hint{hintsLeft >= 0 ? ` ${hintsLeft}` : ""}</button>
  </header>

  {#if error}
    <p class="text-rose-400">could not load: {error}</p>
  {:else if game}
    <div class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {#each game.m.constraints as c (c.id)}
        <ClueChip
          {c}
          m={game.m}
          state={game.revealed ? game.evalState.clues[c.id] : "unknown"}
          glow={glow && game.evalState.clues[c.id] !== "satisfy"}
        />
      {/each}
    </div>

    <section class="flex justify-center"><SlotBoard {game} revealed={game.revealed} {pulse} /></section>
    <section class="flex justify-center"><Pool {game} /></section>

    <div class="mt-auto flex items-center justify-center gap-3 pt-2">
      <button class="rounded-xl bg-slate-700 px-4 py-2 disabled:opacity-30" disabled={game.locked} onclick={() => game?.reset()}>reset</button>
      {#if !game.live}
        <button
          class="rounded-xl bg-sky-600 px-5 py-2 font-semibold disabled:opacity-30"
          disabled={game.locked || game.attemptsLeft === 0}
          onclick={() => game?.check()}>{submitLabel}</button>
      {/if}
      <span class="tabular-nums text-sm opacity-60">{game.evalState.filled}/{game.evalState.total}</span>
    </div>

    {#if game.checked && !game.locked}
      <p class="text-center text-sm text-rose-300">
        {game.dial.feedback === "count-wrong"
          ? `${game.m.constraints.filter((c) => game?.evalState.clues[c.id] === "violate").length} clues off`
          : "not yet - keep deducing"}
      </p>
    {/if}

    {#if game.locked}
      <div class="fixed inset-0 flex items-center justify-center bg-black/70 p-6">
        <div class="flex flex-col items-center gap-4 rounded-2xl bg-slate-800 p-8 text-center" class:ring-4={hero} class:ring-amber-400={hero}>
          <Glyph ref="abstract.grid" label="solved" size={48} />
          <p class="flex gap-1 text-2xl text-amber-400" aria-label={`${game.stars} stars`}>
            {#each [1, 2, 3] as s (s)}<span class:opacity-25={game.stars < s}>{game.stars >= s ? "*" : "."}</span>{/each}
          </p>
          <p class="text-2xl font-bold">{wonText}</p>
          <p class="tabular-nums opacity-70">{Math.round((game.solveMs || elapsed) / 1000)}s{game.bragged ? " - hints" : ""}</p>
          <div class="flex gap-3">
            <button class="rounded-2xl bg-emerald-500 px-6 py-3 font-bold text-black active:scale-95 transition-transform" onclick={() => navigate("")}>home</button>
            <button class="rounded-2xl bg-slate-600 px-6 py-3 font-bold active:scale-95 transition-transform" onclick={() => navigate("stats")}>stats</button>
          </div>
        </div>
      </div>
    {/if}
  {:else}
    <p class="opacity-60">loading...</p>
  {/if}
</main>
