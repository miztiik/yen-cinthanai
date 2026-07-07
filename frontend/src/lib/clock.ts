// Active-time clock: accumulates ONLY the time the puzzle is actively on screen. The Board
// pauses it when the tab is hidden (Page Visibility API) and resumes on return, so time spent
// away - a switched tab, a minimised window, a sleeping phone - is never counted toward the
// solve. Pure: every method takes the current timestamp, so it is deterministic and unit-
// testable with no real clock and no DOM. The Game owns one and feeds it Date.now(); the
// header polls elapsed() each frame. See state/play.svelte.ts, components/Board.svelte,
// docs/concepts/ui-shell.md.

export class ActiveClock {
  private accumulatedMs = 0;
  private runningSince: number | null = null;

  /** Begin (or resume) counting from `now`; a no-op if already running (double-resume safe). */
  start(now: number): void {
    if (this.runningSince === null) this.runningSince = now;
  }

  /** Freeze the count at `now`, banking the running segment; a no-op if already paused. A
   *  backwards clock (system-time change) never subtracts (the segment clamps at 0). */
  pause(now: number): void {
    if (this.runningSince !== null) {
      this.accumulatedMs += Math.max(0, now - this.runningSince);
      this.runningSince = null;
    }
  }

  /** Active ms elapsed as of `now`: the banked total plus the live running segment (0 while
   *  paused). Never negative. */
  elapsed(now: number): number {
    const live = this.runningSince !== null ? Math.max(0, now - this.runningSince) : 0;
    return this.accumulatedMs + live;
  }

  /** Zero the count and start running from `now` (a fresh solve, e.g. RETRY). */
  reset(now: number): void {
    this.accumulatedMs = 0;
    this.runningSince = now;
  }

  /** Whether the clock is currently counting (the tab is active). */
  get running(): boolean {
    return this.runningSince !== null;
  }
}
