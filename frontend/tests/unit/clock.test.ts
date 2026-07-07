import { describe, it, expect } from "vitest";
import { ActiveClock } from "../../src/lib/clock";

// The active-time clock counts only running spans; paused gaps (tab hidden / away) never
// accrue. Pure timestamps in, so the tests are deterministic (no real clock). See clock.ts.
describe("ActiveClock (counts only active time)", () => {
  it("accumulates running spans and ignores the paused gap between them", () => {
    const c = new ActiveClock();
    c.reset(1000); // start at t=1000
    expect(c.elapsed(1500)).toBe(500); // 500ms active
    c.pause(1500); // leave the tab at t=1500 (bank 500)
    expect(c.elapsed(9000)).toBe(500); // 7.5s away -> still 500 (away time not counted)
    c.start(9000); // come back at t=9000
    expect(c.elapsed(9200)).toBe(700); // +200ms active -> 700
  });

  it("start is a no-op while already running (a double resume never rebases the segment)", () => {
    const c = new ActiveClock();
    c.reset(0);
    c.start(500); // already running - must be ignored
    expect(c.elapsed(1000)).toBe(1000);
  });

  it("pause is a no-op while already paused (a double hide never double-banks)", () => {
    const c = new ActiveClock();
    c.reset(0);
    c.pause(1000); // bank 1000
    c.pause(5000); // still paused - no change
    expect(c.elapsed(9000)).toBe(1000);
  });

  it("reset zeroes the total and starts running again (RETRY)", () => {
    const c = new ActiveClock();
    c.reset(0);
    c.pause(2000);
    c.reset(3000); // fresh solve at t=3000
    expect(c.running).toBe(true);
    expect(c.elapsed(3500)).toBe(500);
  });

  it("clamps a backwards clock jump so elapsed is never negative", () => {
    const c = new ActiveClock();
    c.reset(1000);
    expect(c.elapsed(500)).toBe(0); // now < start -> 0, not negative
  });

  it("reports running true only between start and pause", () => {
    const c = new ActiveClock();
    expect(c.running).toBe(false);
    c.start(0);
    expect(c.running).toBe(true);
    c.pause(100);
    expect(c.running).toBe(false);
  });
});
