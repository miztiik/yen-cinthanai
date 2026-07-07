<script lang="ts">
  // DayPicker: a calendar month-grid popover for jumping between the shipped days of the
  // loaded tier. Only the `dates` cells are tappable (a day the bank actually holds); the
  // current day is ringed, today is dot-marked, every non-shipped cell is disabled. Month
  // nav is bounded to the months that hold shipped days, so a player never pages into an
  // empty year. Picking a day hands the date back to the caller (-> navigate to that day).
  // A dialog (role=dialog aria-modal) mirroring the DifficultyPicker overlay: scrim tap or
  // Escape closes, focus moves into the panel on open and RETURNS to the trigger on close.
  // All UTC (the bank + save key are UTC), transform/opacity only (Holy Law #2). See
  // components/DayNav.svelte, lib/dates.ts, docs/concepts/ui-shell.md (Route grammar).
  import { onMount, untrack } from "svelte";
  import Glyph from "../lib/Glyph.svelte";
  import { formatDay } from "../lib/dates";

  let {
    current,
    dates,
    today,
    onpick,
    onclose,
  }: {
    current: string;
    dates: string[];
    today: string;
    onpick: (date: string) => void;
    onclose: () => void;
  } = $props();

  const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Month arithmetic, all UTC (matches the bank/save "today"). A month is a "YYYY-MM" key so
  // lexicographic string compare == chronological compare (the nav bound test).
  function monthOf(date: string): string {
    return date.slice(0, 7);
  }
  function monthLabel(month: string): string {
    const d = new Date(`${month}-01T00:00:00Z`);
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
  }
  function daysInMonth(month: string): number {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate(); // day 0 of the next month = this month's last day
  }
  function firstWeekday(month: string): number {
    return new Date(`${month}-01T00:00:00Z`).getUTCDay(); // 0 = Sunday
  }
  function stepMonth(month: string, delta: number): string {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  // The grid: leading blanks (null) to align day 1 under its weekday, then each ISO day.
  function cells(month: string): (string | null)[] {
    const out: (string | null)[] = Array.from({ length: firstWeekday(month) }, () => null);
    for (let d = 1; d <= daysInMonth(month); d++) out.push(`${month}-${String(d).padStart(2, "0")}`);
    return out;
  }

  const shipped = $derived(new Set(dates));
  const months = $derived([...new Set(dates.map(monthOf))].sort());
  const minMonth = $derived(months[0] ?? monthOf(current));
  const maxMonth = $derived(months[months.length - 1] ?? monthOf(current));

  // Seed the viewed month from the loaded day. Initial value only, by design: the popover
  // remounts each time it opens (Board gates it), so `current` never changes under it.
  let view = $state(untrack(() => monthOf(current)));
  const grid = $derived(cells(view));
  const canPrev = $derived(view > minMonth);
  const canNext = $derived(view < maxMonth);

  let dialogEl: HTMLDivElement | undefined;
  onMount(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogEl?.focus();
    return () => opener?.focus(); // return focus to the trigger on close
  });

  function onkey(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="fixed inset-0 z-30 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="choose a day">
  <button class="scrim absolute inset-0 bg-black/60" aria-label="close" onclick={onclose}></button>
  <div bind:this={dialogEl} tabindex="-1" class="sheet relative w-full max-w-xs rounded-t-3xl border border-ink/10 bg-surface p-5 shadow-e4 outline-none sm:rounded-3xl">
    <div class="mb-3 flex items-center justify-between">
      <button
        class="grid h-9 w-9 place-items-center rounded-full text-ink/60 transition-transform active:scale-95 disabled:pointer-events-none disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="previous month"
        disabled={!canPrev}
        onclick={() => (view = stepMonth(view, -1))}
      >
        <span class="inline-flex rotate-180"><Glyph ref="ui.chevron" size={12} tint /></span>
      </button>
      <span class="text-sm font-semibold" aria-live="polite">{monthLabel(view)}</span>
      <button
        class="grid h-9 w-9 place-items-center rounded-full text-ink/60 transition-transform active:scale-95 disabled:pointer-events-none disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="next month"
        disabled={!canNext}
        onclick={() => (view = stepMonth(view, 1))}
      >
        <Glyph ref="ui.chevron" size={12} tint />
      </button>
    </div>
    <div class="grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wide opacity-50">
      {#each WEEKDAYS as w (w)}<span>{w}</span>{/each}
    </div>
    <div class="mt-1 grid grid-cols-7 gap-1">
      {#each grid as cell, i (i)}
        {#if cell === null}
          <span aria-hidden="true"></span>
        {:else}
          {@const enabled = shipped.has(cell)}
          {@const isCurrent = cell === current}
          {@const isToday = cell === today}
          <button
            class={`relative grid h-9 w-9 place-items-center rounded-full text-sm tabular-nums transition-transform active:scale-95 disabled:pointer-events-none disabled:opacity-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${isCurrent ? "font-semibold ring-2 ring-accent" : enabled ? "hover:bg-ink/10" : ""}`}
            disabled={!enabled}
            aria-current={isCurrent ? "date" : undefined}
            aria-label={`${formatDay(cell)}${isToday ? ", today" : ""}${enabled ? "" : ", no puzzle"}`}
            onclick={() => onpick(cell)}
          >
            {Number(cell.slice(8))}
            {#if isToday}<span class="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" aria-hidden="true"></span>{/if}
          </button>
        {/if}
      {/each}
    </div>
  </div>
</div>

<style>
  .scrim {
    animation: scrim-in 180ms ease-out;
  }
  .sheet {
    animation: sheet-in 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  @keyframes scrim-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes sheet-in {
    from {
      transform: translateY(8%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>
