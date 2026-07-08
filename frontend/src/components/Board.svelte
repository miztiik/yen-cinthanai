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
  import GridMatrix from "./GridMatrix.svelte";
  import AnswerSummary from "./AnswerSummary.svelte";
  import ScratchPad from "./ScratchPad.svelte";
  import ResultCard from "./ResultCard.svelte";
  import DifficultyPicker from "./DifficultyPicker.svelte";
  import BoardHeader from "./BoardHeader.svelte";
  import DisplaySheet from "./DisplaySheet.svelte";
  import { route, homeHref, navigate, syncLocation } from "../lib/router.svelte";
  import { loadBank, loadManifest, pickEntry, hasEntry } from "../lib/loader";
  import { parsePlay, playPath, dayNeighbors } from "../lib/play-route";
  import { formatDay } from "../lib/dates";
  import { loadTiers, loadCopy, loadPace, loadUi, puckPreset, pick, softFeedback, difficultyUi, chromeUi, gridDesktop, gridLabel, gridGap, layoutUi, CLUES_COPY_FALLBACK, GRID_COPY_FALLBACK, ANSWER_COPY_FALLBACK, SCRATCH_COPY_FALLBACK, type TierDial, type CopyBags, type Pace, type PuckPreset, type Feedback, type DifficultyUi, type ChromeUi, type UiConfig } from "../lib/config";
  import { loadShapes, shapeOf, type ShapeDef } from "../lib/shapes";
  import { gridBlocks, gridCategories } from "../lib/grid";
  import { fitCellSize, scaleClamp } from "../lib/fit";
  import { playerGrid } from "../lib/answer";
  import { isHero, nextPlayableTier } from "../lib/scoring";
  import { buildShareCard, shareText, type ShareCopy } from "../contracts/share";
  import { configureAudio, play } from "../lib/audio";
  import { applyMotion } from "../lib/motion";
  import { Game, saveProgress, toDayState } from "../state/play.svelte";
  import { loadSave, dayKey, updateSettings } from "../state/save.svelte";
  import type { Tier, DisplaySettings } from "../contracts/save";

  const TODAY = new Date().toISOString().slice(0, 10);
  const ALLOWED: Tier[] = ["easy", "standard", "sharp", "expert"];
  const SHARE_FALLBACK: ShareCopy = { title: "yen-cinthanai {tier}", line: "{stars} {time}s w{wrong} h{hints}", streak: "flame {streak}" };

  let game = $state<Game | null>(null);
  let copy = $state<CopyBags>({ success: [], encourage: [], hero: [] });
  let pace = $state<Pace>({ idle_pulse_s: 12, idle_glow_s: 25, stats_window: 10 });
  let shape = $state<ShapeDef | null>(null);
  let soft = $state<Feedback[]>(["realtime-names", "count-wrong"]); // dials that may auto-dim a satisfied clue
  let error = $state("");
  let notice = $state(""); // non-blocking note when a requested day is not in the shipped bank
  let currentDate = $state(TODAY);      // the day currently loaded (drives the day nav + label)
  let tierDates = $state<string[]>([]); // ascending dates shipped for the loaded tier
  let elapsed = $state(0);
  let idleMs = $state(0);
  let hero = $state(false);
  let heroBaseline = { bestMs: 0, date: "" };

  // Puck sizing + drag-magnet come from config (config/ui.toml), keyed by the player's
  // puckSize setting, and are provided to every Puck/Token via context so the circle +
  // glyph scale together with no hardcoded px. Resolved in start() once save + ui load.
  let puck = $state<PuckPreset>({ diameter: 52, glyph: 0.64 });
  let snap = $state({ radius_factor: 1.4, ease: 0.55 });
  // Difficulty switcher (config-driven colour-coded bars). Populated in start() from ui.json.
  let difficulty = $state<DifficultyUi>(difficultyUi({} as never));
  let pickerOpen = $state(false);
  // Chrome micro-interaction tunables (tooltip dwell). Resolved in start() from ui.json.
  let chrome = $state<ChromeUi>(chromeUi({} as never));
  // Desktop fused-grid growth params + board width cap (config/ui.json). Resolved in start().
  let desktopCfg = $state(gridDesktop({} as UiConfig));
  // Axis-label font + inter-cell gap that TRACK the cell edge so a grown cell stays
  // proportional (config/ui.json [grid.label], [grid.gap]). Resolved in start().
  let labelCfg = $state(gridLabel({} as UiConfig));
  let gapCfg = $state(gridGap({} as UiConfig));
  let maxWidthPx = $state(0);
  // DayPicker calendar popover (jump between shipped days). Opened from the DayNav label.
  let dayPickerOpen = $state(false);
  // Display mode (color/glyphs/labels): provided to the grid via context, toggled in-puzzle by
  // the DisplaySheet, persisted to save.settings.display. Defaults reproduce today's behaviour.
  let display = $state<DisplaySettings>({ color: true, glyphs: true, labels: true });
  let displayOpen = $state(false);
  // End-card (win/fail) dismissed to review the board underneath (scrim tap or Escape, like
  // the other sheets). Reset on RETRY and on remount (Board is keyed on the route in App).
  let resultDismissed = $state(false);
  setContext("puckSize", () => puck);
  setContext("snap", () => snap);
  setContext("display", () => display);

  async function start() {
    try {
      const sv = loadSave();
      const bank = await loadBank();
      // Resolve {date, tier} from the URL (date-first canonical /play/<date>/<tier>). Tier:
      // explicit segment, else last tier, else easy. A bare /play (no tier) advances past any
      // tier already solved today so a direct entry lands on a playable puzzle (matches the
      // landing PLAY button). Date: explicit segment when the bank holds it, else today.
      const want = parsePlay(route());
      const tier: Tier = want.tier ?? (nextPlayableTier(sv.days, TODAY, ALLOWED, sv.settings.lastTier ?? "easy") as Tier);
      const wantDate = want.date && hasEntry(bank, want.date, tier) ? want.date : TODAY;
      // Prefer the exact day+tier; else the newest shipped day for this tier (a link to a day
      // aged out of the rolling window - or a future date - lands on the latest, never errors);
      // else the first bank entry.
      let entry = bank.puzzles.find((p) => p.date === wantDate && p.tier === tier);
      if (!entry) {
        const forTier = bank.puzzles.filter((p) => p.tier === tier);
        entry = forTier.length
          ? forTier.reduce((a, b) => (a.date >= b.date ? a : b))
          : pickEntry(bank, bank.puzzles[0].date, bank.puzzles[0].tier);
        if (want.date) notice = "That day isn't available - showing the latest puzzle.";
      }
      const m = await loadManifest(entry.file);
      currentDate = entry.date;
      tierDates = bank.puzzles.filter((p) => p.tier === m.tier).map((p) => p.date).sort();
      // Unfurl the address bar to the canonical dated URL without a remount, so a bare/alias
      // entry becomes linkable + bookmarkable to this exact day. See play-route.ts.
      if (route() !== "/" + playPath(entry.date, m.tier)) syncLocation(playPath(entry.date, m.tier));
      // Remember the level we actually loaded so bare PLAY resumes it next time.
      if (sv.settings.lastTier !== m.tier) updateSettings({ lastTier: m.tier }, TODAY);
      const tiers = await loadTiers();
      const dial: TierDial = tiers[m.tier] ?? { par_s: 240, hints: -1, attempts: -1, feedback: "realtime-names" };
      copy = await loadCopy();
      pace = await loadPace();
      shape = shapeOf(await loadShapes(), m.shapeId);
      const prior = sv.days[dayKey(m.puzzleId, m.tier, m.shapeId)];
      heroBaseline = { ...sv.hero };
      configureAudio(sv.settings.sound, sv.settings.volume);
      applyMotion(sv.settings.reducedMotion);
      display = sv.settings.display;
      const ui = await loadUi();
      puck = puckPreset(ui, sv.settings.puckSize);
      snap = ui.snap;
      soft = softFeedback(ui);
      difficulty = difficultyUi(ui);
      chrome = chromeUi(ui);
      desktopCfg = gridDesktop(ui);
      labelCfg = gridLabel(ui);
      gapCfg = gridGap(ui);
      maxWidthPx = layoutUi(ui).maxWidthPx;
      game = new Game(m, dial, prior);
      if (document.hidden || !document.hasFocus()) game.pause(); // loaded into a hidden/unfocused tab
      tick();
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  function tick() {
    if (!game) return;
    // Stop the clock once play is over: a win (locked) OR a spent attempt cap (the fail card).
    // attemptsLeft is -1 when unlimited, so realtime/easy keeps ticking; only an exhausted
    // cap (=== 0) freezes the time the fail card reports.
    if (!game.locked && game.attemptsLeft !== 0) {
      elapsed = game.elapsedMs;
      idleMs = Date.now() - game.lastMoveMs;
    }
    requestAnimationFrame(tick);
  }

  // Active-time timer: only time the puzzle is on screen AND the window has focus counts. The
  // solve clock pauses when the tab is hidden (switched away / minimised / phone asleep) OR the
  // window loses focus (clicked into another app), and resumes on return. Wired to
  // visibilitychange + window blur/focus; ActiveClock's guards make overlapping events safe.
  function syncActive() {
    if (!game) return;
    if (document.hidden || !document.hasFocus()) game.pause();
    else game.resume();
  }

  $effect(() => {
    if (game) {
      void game.placements; // track commits
      void game.locked;
      const won = game.locked;
      hero = won && !game.replaying && isHero(heroBaseline, game.solveMs, game.hintsUsed);
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
  const pulse = $derived(!!game && !game.locked && idleMs > pace.idle_pulse_s * 1000);
  const glow = $derived(!!game && !game.locked && idleMs > pace.idle_glow_s * 1000);
  const submitLabel = $derived(game?.dial.feedback === "submit-binary" ? "submit" : "check");
  const storyMode = $derived(!!game?.m.story); // story-first: text ClueList replaces the glyph ClueChip strip
  // Grid-primary surface (story puzzles): the cross-out grid - a GridMap navigator + a
  // NotesGrid block editor - is the B-prime deduction surface. SlotBoard + Pool stay only
  // when a shared-cardinality column exists (Decision 7). See core-loop.md, lib/grid.ts.
  let activeBlock = $state(0);
  let vw = $state(typeof window !== "undefined" ? window.innerWidth : 1024); // real width at init (no mount reflow)
  const cellSize = $derived(vw >= 640 ? 54 : 44); // mobile/tablet NotesGrid; desktop GridMatrix uses gridSize
  const desktop = $derived(vw >= 1024);
  const blocks = $derived(game ? gridBlocks(gridCategories(game.board)) : []);
  const gridCopy = $derived(copy.grid ?? GRID_COPY_FALLBACK);
  const hasShared = $derived(!!game && game.board.columns.some((c) => c.cardinality === "shared"));
  // Live results roster (Row #3): the player's CURRENT deductions, fed by their own placements +
  // grid ticks (playerGrid -> NEVER the solution, so it cannot spoil). Recomputes once per commit;
  // the rAF timer never re-derives it (it does not read `elapsed`). Standard+ only (not the Easy
  // cold-open); desktop always-open, mobile a collapsed disclosure.
  const results = $derived(game ? playerGrid(game.board, game.placements, new Set(Object.keys(game.gridTicks))) : null);
  const showResults = $derived(!!game && game.m.tier !== "easy");
  const answerCopy = $derived(copy.answer ?? ANSWER_COPY_FALLBACK);
  const scratchCopy = $derived(copy.scratch ?? SCRATCH_COPY_FALLBACK);
  // Desktop grid GROWTH: measure the grid column (ResizeObserver on the layout-sized wrapper -
  // read contentRect ONLY, never getBoundingClientRect, so no forced reflow) and size each fused
  // cell to fill it via lib/fit.ts. leafCount = the staircase value columns (every non-anchor
  // category's values). Cell size is UNCAPPED by config default. See config/ui.json [grid.desktop].
  let gridWrap = $state<HTMLElement | null>(null);
  let gridSize = $state(64);
  const leafCount = $derived(game ? gridCategories(game.board).slice(1).reduce((n, c) => n + c.values.length, 0) : 0);
  $effect(() => {
    const el = gridWrap;
    if (!el || !desktop || leafCount <= 0) return;
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const fit = { minCell: desktopCfg.minCell, maxCell: desktopCfg.maxCell, leadPx: desktopCfg.leadRem * rootPx, slackPx: desktopCfg.slackPx };
    const ro = new ResizeObserver((entries) => {
      gridSize = fitCellSize(entries[0]?.contentRect.width ?? el.clientWidth, leafCount, fit);
    });
    ro.observe(el);
    return () => ro.disconnect();
  });
  function navBlock(dir: 1 | -1) {
    if (blocks.length) activeBlock = (activeBlock + dir + blocks.length) % blocks.length;
  }

  // Day navigation: carets move within the loaded tier's shipped days; next is absent at today
  // (the newest shipped day), prev at the oldest. See docs/concepts/ui-shell.md.
  const neighbors = $derived(dayNeighbors(tierDates, currentDate));
  const dayLabel = $derived(currentDate === TODAY ? "Today" : formatDay(currentDate));
  function goToDay(to: string | undefined) {
    if (game && to) navigate(playPath(to, game.m.tier));
  }
  function setDisplay(next: DisplaySettings) {
    display = next;
    updateSettings({ display: next }, TODAY);
  }

  start();
</script>

<svelte:window bind:innerWidth={vw} onblur={syncActive} onfocus={syncActive} />
<svelte:document onvisibilitychange={syncActive} />

<main
  class={`mx-auto flex min-h-dvh flex-col gap-4 p-4 ${storyMode ? "max-w-md lg:max-w-none" : "max-w-md"} ${display.color ? "" : "display-mono"}`}
  style={storyMode && maxWidthPx > 0 ? `max-width:${maxWidthPx}px` : undefined}
>
  <!-- The board Command Bar (v2): one slim line that wraps the live-solve cluster to a slim
       second zone when the header is narrow. Extracted into BoardHeader, which wires the DayNav
       (its label opens the DayPicker calendar), the attempts as an urgency AttemptRing, desktop
       Tooltips, a single current-tier chip -> DifficultyPicker, and the timer/hint. See
       components/BoardHeader.svelte, ui-shell.md. -->
  <BoardHeader
    {game}
    {difficulty}
    {chrome}
    elapsedS={Math.floor(elapsed / 1000)}
    homeHref={homeHref()}
    {dayLabel}
    {currentDate}
    {tierDates}
    today={TODAY}
    hasPrev={!!neighbors.prev}
    hasNext={!!neighbors.next}
    {dayPickerOpen}
    onhome={() => navigate("")}
    onhint={() => game?.hint()}
    ondisplay={() => (displayOpen = true)}
    ondifficulty={() => (pickerOpen = true)}
    onprev={() => goToDay(neighbors.prev)}
    onnext={() => goToDay(neighbors.next)}
    onopenDay={() => (dayPickerOpen = true)}
    oncloseDay={() => (dayPickerOpen = false)}
    onpickDay={(d) => {
      dayPickerOpen = false;
      goToDay(d);
    }}
  />

  {#if notice}
    <p class="mx-auto w-fit rounded-full bg-surface px-3 py-1 text-xs opacity-70 shadow-e1" role="status">{notice}</p>
  {/if}

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

    <div class="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div bind:this={gridWrap} class="flex min-w-0 flex-col gap-4 lg:flex-1">
        {#if storyMode && blocks.length > 0}
          {#if desktop}
            <GridMatrix {game} cats={gridCategories(game.board)} copy={gridCopy} size={gridSize} labelPx={scaleClamp(gridSize, labelCfg)} gapPx={scaleClamp(gridSize, gapCfg)} />
          {:else}
            <section class="flex justify-center">
              <NotesGrid {game} block={blocks[activeBlock]} {blocks} index={activeBlock} copy={gridCopy} size={cellSize} labelPx={scaleClamp(cellSize, labelCfg)} gapPx={scaleClamp(cellSize, gapCfg)} onnav={navBlock} />
            </section>
            {#if blocks.length > 1}
              <GridMap {game} {blocks} active={activeBlock} copy={gridCopy} onselect={(i) => (activeBlock = i)} />
            {/if}
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
        <aside class="flex flex-col gap-4 lg:w-80 lg:shrink-0">
          <ClueList {game} copy={copy.clues ?? CLUES_COPY_FALLBACK} {soft} />
          {#if showResults && results}
            <!-- Live results roster. Desktop: always-open rail panel. Mobile (Standard+): a
                 collapsed <details> disclosure - never on the Easy cold-open (showResults gates it). -->
            <div class="hidden lg:block">
              <AnswerSummary grid={results} heading={answerCopy.resultsHeading} caption={answerCopy.resultsCaption} partial />
            </div>
            <details class="rounded-xl bg-surface p-2 shadow-e1 lg:hidden">
              <summary class="cursor-pointer select-none text-xs font-bold uppercase tracking-widest opacity-70">{answerCopy.resultsHeading}</summary>
              <div class="pt-2">
                <AnswerSummary grid={results} heading={answerCopy.resultsHeading} caption={answerCopy.resultsCaption} partial />
              </div>
            </details>
          {/if}
          {#if showResults}
            <ScratchPad value={game.scratch} label={scratchCopy.label} placeholder={scratchCopy.placeholder} onchange={(t) => { game?.setScratch(t); if (game) saveProgress(game); }} />
          {/if}
        </aside>
      {/if}
    </div>

    <!-- Thumb-zone action cluster (mt-auto pins it to the fold). The CHECK feedback sits
         DIRECTLY ABOVE the buttons so it lands in view - never below the fold, where a first
         CHECK's "not yet" was missed and a blind second tap burned the last attempt. A spent
         cap swaps CHECK for RETRY here too, so dismissing the fail card (scrim/Escape) still
         leaves a fresh run one tap away. See ui-shell.md. -->
    <div class="mt-auto flex flex-col items-center gap-2 pt-2">
      {#if game.checked && !game.locked && !failed}
        <p class="flex w-fit items-center gap-2 rounded-full border border-violate/30 bg-violate/10 px-4 py-1.5 text-center text-sm font-medium text-violate" role="status">
          {game.dial.feedback === "count-wrong"
            ? `${game.m.constraints.filter((c) => game?.evalState.clues[c.id] === "violate").length} clues off`
            : "not yet - keep deducing"}
        </p>
      {/if}
      <div class="flex items-center justify-center gap-3">
        <button class="rounded-xl bg-surface px-4 py-2 disabled:opacity-30" disabled={game.locked} onclick={() => game?.reset()}>reset</button>
        {#if !game.live}
          {#if failed}
            <button class="rounded-xl bg-accent px-5 py-2 font-semibold" onclick={() => { game?.retry(); resultDismissed = false; }}>retry</button>
          {:else}
            <button
              class="rounded-xl bg-accent px-5 py-2 font-semibold disabled:opacity-30"
              disabled={game.locked}
              onclick={() => { game?.check(); if (game && !game.locked) play("violate"); else play("satisfy"); }}>{submitLabel}</button>
          {/if}
        {/if}
        <span class="tabular-nums text-sm opacity-60">{game.evalState.filled}/{game.evalState.total}</span>
      </div>
    </div>

    {#if game.locked && !resultDismissed}
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
        onagain={() => game?.playAgain()}
        ondismiss={() => (resultDismissed = true)}
      />
    {:else if failed && !resultDismissed}
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
        onretry={() => { game?.retry(); resultDismissed = false; }}
        ondismiss={() => (resultDismissed = true)}
      />
    {/if}
  {:else}
    <p class="opacity-60">loading...</p>
  {/if}

  {#if pickerOpen && game}
    <DifficultyPicker
      current={game.m.tier}
      {difficulty}
      onpick={(t) => { pickerOpen = false; if (game && t !== game.m.tier) navigate(playPath(currentDate, t as Tier)); }}
      onclose={() => (pickerOpen = false)}
    />
  {/if}

  {#if displayOpen}
    <DisplaySheet {display} onchange={setDisplay} onclose={() => (displayOpen = false)} />
  {/if}
</main>
