import { describe, it, expect } from "vitest";
import { nearestCentre, magnetTranslate, type SlotCentre } from "../../src/lib/drag";

// Pure magnet math (no DOM): capture + ease. The DOM glue (querySelectorAll, rects) is
// exercised by the browser smoke; here we pin the geometry the snap feel depends on.
const c = (entity: string, cx: number, cy: number): SlotCentre =>
  ({ entity, cat: "drinks", cx, cy, el: {} as HTMLElement });

describe("nearestCentre (magnet capture)", () => {
  const centres = [c("e0", 0, 0), c("e1", 100, 0), c("e2", 200, 0)];

  it("captures the nearest centre within radius", () => {
    expect(nearestCentre(90, 0, centres, 30)?.entity).toBe("e1");
  });

  it("returns null when nothing is within radius", () => {
    expect(nearestCentre(50, 0, centres, 30)).toBeNull();
  });

  it("captures exactly at the radius boundary", () => {
    expect(nearestCentre(30, 0, centres, 30)?.entity).toBe("e0");
  });
});

describe("magnetTranslate (ease toward the captured slot)", () => {
  it("follows the finger when nothing is captured", () => {
    expect(magnetTranslate(10, 20, 0, 0, null, 0.5)).toEqual({ tx: 10, ty: 20 });
  });

  it("eases the node centre a fraction of the way to the target", () => {
    // start (0,0), dragged +40 in x, target at x=100, ease 0.5 -> halfway from 40 to 100
    expect(magnetTranslate(40, 0, 0, 0, { cx: 100, cy: 0 }, 0.5)).toEqual({ tx: 70, ty: 0 });
  });

  it("snaps onto the target centre at ease = 1", () => {
    expect(magnetTranslate(40, 0, 0, 0, { cx: 100, cy: 0 }, 1)).toEqual({ tx: 100, ty: 0 });
  });
});
