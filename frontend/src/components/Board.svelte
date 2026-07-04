<script lang="ts">
  // Board screen: load today's standard, build the game, wire HUD + clue strip + grid
  // + pools + actions, lock + celebrate on win. PLAY enters here; one-tap back to home.
  // Progress persists to save on every commit. Chrome is Tailwind; the canvas-equal is
  // the SlotBoard. transform/opacity feedback only. See ui-shell.md, core-loop.md.
  import { setContext } from "svelte";
  import SlotBoard from "./SlotBoard.svelte";
  import Pool from "./Pool.svelte";
  import ClueChip from "./ClueChip.svelte";
  import StoryPanel from "./StoryPanel.svelte";
  import ClueList from "./ClueList.svelte";
  import NotesGrid from "./NotesGrid.svelte";
  import GridMap from "./GridMap.svelte";
  import ResultCard from "./ResultCard.svelte";
  import Glyph from "../lib/Glyph.svelte";
  import { route, homeHref, navigate } from "../lib/router.svelte";
  import { loadBank, loadManifest, pickEntry } from "../lib/loader";
  import { loadTiers, loadCopy, loadPace, loadUi, puckPreset, pick, softFeedback, CLUES_COPY_FALLBACK, GRID_COPY_FALLBACK, type TierDial, type CopyBags, type Pace, type PuckPreset, type Feedback } from "../lib/config";
  import { loadShapes, shapeOf, type ShapeDef } from "../lib/shapes";
  import { gridBlocks, gridCategories } from "../lib/grid";
  import { isHero } from "../lib/scoring";
  import { buildShareCard, shareText, type ShareCopy } from "../contracts/share";
  import { configureAudio, play } from "../lib/audio";
  import { applyMotion } from "../lib/motion";
  import { Game, saveProgress, toDayState } from "../state/play.svelte";
  import { loadSave, dayKey } from "../state/save.svelte";
  import type { Tier } from "../contracts/save";

  const TODAY = new Date().toISOString().slice(0, 10);
  const ALLOWED: Tier[] = ["easy", "standard", "sharp", "expert"];
  const SHARE_FALLBACK: ShareCopy = { title: "yen-cinthanai {tier}", line: "{stars} {time}s w{wrong} h{hints}", streak: "flame {streak}" };

  let game = $state<Game | null>(null);
  let copy = $state<CopyBags>({ success: [], encourage: [], hero: [] });
  let pace = $state<Pace>({ idle_pulse_s: 12, idle_glow_s: 25, stats_window: 10 });
  let shape = $state<ShapeDef | null>(null);
  let soft = $state<Feedback[]>(["realtime-names", "count-wrong"]); // dials that may auto-dim a satisfied clue
  let error = $state("");
  let elapsed = $state(0);
  let idleMs = $state(0);
  let hero = $state(false);
  let heroBaseline = { bestMs: 0, date: "" };

  // Puck sizing + drag-magnet come from config (config/ui.toml), keyed by the player's
  // puckSize setting, and are provided to every Puck/Token via context so the circle +
  // glyph scale together with no hardcoded px. Resolved in start() once save + ui load.
  let puck = $state<PuckPreset>({ diameter: 52, glyph: 0.64 });
  let snap = $state({ radius_factor: 1.4, ease: 0.55 });
  setContext("puckSize", () => puck);
  setContext("snap", () => snap);

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
      shape = shapeOf(await loadShapes(), m.shapeId);
      const sv = loadSave();
      const prior = sv.days[dayKey(m.puzzleId, m.tier, m.shapeId)];
      heroBaseline = { ...sv.hero };
      configureAudio(sv.settings.sound, sv.settings.volume);
      applyMotion(sv.settings.reducedMotion);
      const ui = await loadUi();
      puck = puckPreset(ui, sv.settings.puckSize);
      snap = ui.snap;
      soft = softFeedback(ui);
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

  // Audio cues (synth, mute-default): tick on each new commit, fanfare on the win.
  let prevFilled = 0;
  let prevLocked = false;
  $effect(() => {
    if (!game) return;
    const filled = game.evalState.filled;
    if (filled > prevFilled) play("place");
    prevFilled = filled;
    if (game.locked && !prevLocked) play("win");
    prevLocked = game.locked;
  });

  const failed = $derived(!!game && !game.locked && game.attemptsLeft === 0);
  const wonText = $derived(game?.locked ? (hero ? pick(copy.hero) : pick(copy.success)) : pick(copy.encourage));
  const share = $derived(
    game?.locked
      ? shareText(buildShareCard(toDayState(game), loadSave().streak, shape?.glyph ?? "abstract.grid"), game.stars, copy.share ?? SHARE_FALLBACK)
      : "",
  );
  const hintsLeft = $derived(game?.hintsLeft ?? -1);
  const pulse = $derived(!!game && !game.locked && idleMs > pace.idle_pulse_s * 1000);
  const glow = $derived(!!game && !game.locked && idleMs > pace.idle_glow_s * 1000);
  const submitLabel = $derived(game?.dial.feedback === "submit-binary" ? "submit" : "check");
  const storyMode = $derived(!!game?.m.story); // story-first: text ClueList replaces the glyph ClueChip strip
  // Grid-primary surface (story puzzles): the cross-out grid - a GridMap navigator + a
  // NotesGrid block editor - is the B-prime deduction surface. SlotBoard + Pool stay only
  // when a shared-cardinality column exists (Decision 7). See core-loop.md, lib/grid.ts.
  let activeBlock = $state(0);
  let vw = $state(typeof window !== "undefined" ? window.innerWidth : 1024); // real width at init (no mount reflow)
  const cellSize = $derived(vw >= 1024 ? 68 : vw >= 640 ? 54 : 44);
  const blocks = $derived(game ? gridBlocks(gridCategories(game.board)) : []);
  const gridCopy = $derived(copy.grid ?? GRID_COPY_FALLBACK);
  const hasShared = $derived(!!game && game.board.columns.some((c) => c.cardinality === "shared"));
  function navBlock(dir: 1 | -1) {
    if (blocks.length) activeBlock = (activeBlock + dir + blocks.length) % blocks.length;
  }
  start();
</script>

<svelte:window bind:innerWidth={vw} />

<main class={`mx-auto flex min-h-dvh flex-col gap-4 p-4 ${storyMode ? "max-w-md lg:max-w-5xl" : "max-w-md"}`}>
  <header class="flex items-center justify-between gap-2 text-sm">
    <a class="flex items-center rounded-lg p-1.5 opacity-80 transition-transform active:scale-95" href={homeHref()} aria-label="back" onclick={(e) => { e.preventDefault(); navigate(""); }}>
      <Glyph ref="ui.back" size={18} tint />
    </a>
    <div class="flex items-center gap-2 rounded-full border border-ink/10 bg-surface px-3 py-1.5 shadow-sm">
      <span class="uppercase tracking-wide opacity-70">{game?.m.tier ?? ""}</span>
      <span class="opacity-25">/</span>
      <span class="tabular-nums opacity-80">{Math.floor(elapsed / 1000)}s</span>
      {#if game && game.attemptsLeft >= 0}<span class="opacity-25">/</span><span class="tabular-nums opacity-80" aria-label="attempts left">try {game.attemptsLeft}</span>{/if}
    </div>
    <button
      class="rounded-lg border border-ink/10 bg-surface px-3 py-1.5 font-medium shadow-sm transition-transform active:scale-95 disabled:opacity-30"
      disabled={!game || game.locked || hintsLeft === 0}
      onclick={() => game?.hint()}>hint{hintsLeft >= 0 ? ` ${hintsLeft}` : ""}</button>
  </header>

  {#if error}
    <p class="text-violate">could not load: {error}</p>
  {:else if game}
    {#if storyMode}
      <StoryPanel story={game.m.story ?? ""} />
    {:else}
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
    {/if}

    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-center">
      <div class="flex min-w-0 flex-col gap-4">
        {#if storyMode && blocks.length > 0}
          <section class="flex justify-center">
            <NotesGrid {game} block={blocks[activeBlock]} {blocks} index={activeBlock} copy={gridCopy} size={cellSize} {snap} onnav={navBlock} />
          </section>
          {#if blocks.length > 1}
            <GridMap {game} {blocks} active={activeBlock} copy={gridCopy} onselect={(i) => (activeBlock = i)} />
          {/if}
          {#if hasShared}
            <section class="flex justify-center"><SlotBoard {game} topology={shape?.topology ?? "matrix"} revealed={game.revealed} {pulse} /></section>
            <section class="flex justify-center"><Pool {game} /></section>
          {/if}
        {:else}
          <section class="flex justify-center"><SlotBoard {game} topology={shape?.topology ?? "matrix"} revealed={game.revealed} {pulse} /></section>
          <section class="flex justify-center"><Pool {game} /></section>
        {/if}
      </div>
      {#if storyMode}
        <ClueList {game} copy={copy.clues ?? CLUES_COPY_FALLBACK} {soft} />
      {/if}
    </div>

    <div class="mt-auto flex items-center justify-center gap-3 pt-2">
      <button class="rounded-xl bg-surface px-4 py-2 disabled:opacity-30" disabled={game.locked} onclick={() => game?.reset()}>reset</button>
      {#if !game.live}
        <button
          class="rounded-xl bg-accent px-5 py-2 font-semibold disabled:opacity-30"
          disabled={game.locked || game.attemptsLeft === 0}
          onclick={() => { game?.check(); if (game && !game.locked) play("violate"); else play("satisfy"); }}>{submitLabel}</button>
      {/if}
      <span class="tabular-nums text-sm opacity-60">{game.evalState.filled}/{game.evalState.total}</span>
    </div>

    {#if game.checked && !game.locked}
      <p class="text-center text-sm text-violate">
        {game.dial.feedback === "count-wrong"
          ? `${game.m.constraints.filter((c) => game?.evalState.clues[c.id] === "violate").length} clues off`
          : "not yet - keep deducing"}
      </p>
    {/if}

    {#if game.locked}
      <ResultCard
        variant="win"
        {hero}
        phrase={wonText}
        stars={game.stars}
        solveMs={game.solveMs || elapsed}
        hintsUsed={game.hintsUsed}
        wrong={game.attempts}
        streak={loadSave().streak.count}
        shapeGlyph={shape?.glyph ?? "abstract.grid"}
        {share}
        onhome={() => navigate("")}
        onstats={() => navigate("stats")}
      />
    {:else if failed}
      <ResultCard
        variant="fail"
        phrase={wonText}
        stars={0}
        solveMs={elapsed}
        hintsUsed={game.hintsUsed}
        wrong={game.attempts}
        streak={loadSave().streak.count}
        shapeGlyph={shape?.glyph ?? "abstract.grid"}
        share=""
        onhome={() => navigate("")}
        onstats={() => navigate("stats")}
        onretry={() => start()}
      />
    {/if}
  {:else}
    <p class="opacity-60">loading...</p>
  {/if}
</main>
