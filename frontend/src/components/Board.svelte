<script lang="ts">
  // Board screen: load today's standard, build the game, wire HUD + clue strip + grid
  // + pools + actions, lock + celebrate on win. PLAY enters here; one-tap back to home.
  // Progress persists to save on every commit. Chrome is Tailwind; the canvas-equal is
  // the SlotBoard. transform/opacity feedback only. See ui-shell.md, core-loop.md.
  import SlotBoard from "./SlotBoard.svelte";
  import Pool from "./Pool.svelte";
  import ClueChip from "./ClueChip.svelte";
  import Glyph from "../lib/Glyph.svelte";
  import { homeHref, navigate } from "../lib/router.svelte";
  import { loadBank, loadManifest, pickEntry } from "../lib/loader";
  import { loadTiers, loadCopy, pick, type TierDial, type CopyBags } from "../lib/config";
  import { Game, saveProgress } from "../state/play.svelte";
  import { loadSave } from "../state/save.svelte";

  const TODAY = new Date().toISOString().slice(0, 10);

  let game = $state<Game | null>(null);
  let dial = $state<TierDial | null>(null);
  let copy = $state<CopyBags>({ success: [], encourage: [], hero: [] });
  let error = $state("");
  let elapsed = $state(0);

  async function start() {
    try {
      const bank = await loadBank();
      const entry =
        bank.puzzles.find((p) => p.date === TODAY && p.tier === "standard") ??
        bank.puzzles.find((p) => p.tier === "standard") ??
        pickEntry(bank, bank.puzzles[0].date, bank.puzzles[0].tier);
      const m = await loadManifest(entry.file);
      const tiers = await loadTiers();
      dial = tiers[m.tier] ?? null;
      copy = await loadCopy();
      const prior = loadSave().days[m.puzzleId];
      game = new Game(m, prior);
      tick();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  function tick() {
    if (!game) return;
    if (!game.locked) elapsed = Date.now() - game.startedMs;
    requestAnimationFrame(tick);
  }

  $effect(() => {
    if (game) {
      void game.placements; // track commits
      void game.locked;
      saveProgress(game);
    }
  });

  const wonText = $derived(game?.locked ? pick(copy.success) : pick(copy.encourage));
  const hintsLeft = $derived(dial && dial.hints >= 0 ? Math.max(0, dial.hints - (game?.hintsUsed ?? 0)) : -1);
  start();
</script>

<main class="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
  <header class="flex items-center justify-between text-sm">
    <a href={homeHref()} aria-label="back" onclick={(e) => { e.preventDefault(); navigate(""); }}>back</a>
    <span class="uppercase tracking-wide opacity-70">{game?.m.tier ?? ""}</span>
    <span class="tabular-nums opacity-70">{Math.floor(elapsed / 1000)}s</span>
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
        <ClueChip {c} m={game.m} state={game.evalState.clues[c.id]} />
      {/each}
    </div>

    <section class="flex justify-center"><SlotBoard {game} /></section>
    <section class="flex justify-center"><Pool {game} /></section>

    <div class="mt-auto flex items-center justify-center gap-3 pt-2">
      <button class="rounded-xl bg-slate-700 px-4 py-2 disabled:opacity-30" disabled={game.locked} onclick={() => game?.reset()}>reset</button>
      <span class="tabular-nums text-sm opacity-60">{game.evalState.filled}/{game.evalState.total}</span>
    </div>

    {#if game.locked}
      <div class="fixed inset-0 flex items-center justify-center bg-black/70 p-6">
        <div class="flex flex-col items-center gap-4 rounded-2xl bg-slate-800 p-8 text-center">
          <Glyph ref="abstract.grid" label="solved" size={48} />
          <p class="text-2xl font-bold">{wonText}</p>
          <p class="tabular-nums opacity-70">{Math.round((game.solveMs || elapsed) / 1000)}s</p>
          <button class="rounded-2xl bg-emerald-500 px-8 py-3 font-bold text-black active:scale-95 transition-transform" onclick={() => navigate("")}>home</button>
        </div>
      </div>
    {/if}
  {:else}
    <p class="opacity-60">loading...</p>
  {/if}
</main>
