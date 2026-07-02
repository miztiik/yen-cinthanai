// @vitest-environment jsdom
// Integration (render): the cross-out grid UI in a real DOM. GridCell paints its four
// states, is a labelled drop-target button, splits Enter (tick) from Space (manual-X),
// and NotesGrid lays the block out as a real <table> whose cells drive the play store.
// Svelte 5 mount/flushSync in jsdom (same harness as story-clues.test.ts); no network, no
// mocks. The story fixture's values have empty glyphs, so NotesGrid renders no <img> and
// stays decoupled from the glyph registry.

import { mount, unmount, flushSync, type Component } from "svelte";
import { afterEach, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import GridCell from "../../src/components/GridCell.svelte";
import NotesGrid from "../../src/components/NotesGrid.svelte";
import { Game } from "../../src/state/play.svelte";
import { gridBlocks, gridCategories } from "../../src/lib/grid";
import { GRID_COPY_FALLBACK, type TierDial } from "../../src/lib/config";
import type { PuzzleManifest } from "../../src/contracts/manifest";

const m = JSON.parse(
  readFileSync(resolve(process.cwd(), "tests/fixtures/story-first-standard.json"), "utf8"),
) as PuzzleManifest;
const STD: TierDial = { par_s: 240, hints: 2, attempts: 3, feedback: "count-wrong" };

const instances: ReturnType<typeof mount>[] = [];
function render<P extends Record<string, unknown>>(comp: Component<P>, props: P): HTMLElement {
  const target = document.createElement("div");
  document.body.appendChild(target);
  instances.push(mount(comp, { target, props }));
  return target;
}
afterEach(() => {
  for (const i of instances.splice(0)) unmount(i);
  document.body.innerHTML = "";
});

const base = {
  cellKey: "craft:pottery|name:ana",
  block: "craft|name",
  ariaLabel: "Ana and Pottery: unmarked",
  ontap: () => {},
  ontick: () => {},
};

describe("GridCell states", () => {
  it("blank is an empty, labelled drop-target button", () => {
    const btn = render(GridCell, { ...base, state: "blank" }).querySelector("button")!;
    expect(btn.dataset.cellKey).toBe("craft:pottery|name:ana");
    expect(btn.dataset.cellBlock).toBe("craft|name");
    expect(btn.getAttribute("aria-label")).toBe("Ana and Pottery: unmarked");
    expect(btn.querySelector(".bg-accent")).toBeNull();
    expect(btn.querySelector('[class*="rotate-45"]')).toBeNull();
  });

  it("tick shows a positive glyph/disc, not a cross", () => {
    const btn = render(GridCell, { ...base, state: "tick", glyph: null }).querySelector("button")!;
    expect(btn.querySelector(".bg-accent")).not.toBeNull();
    expect(btn.querySelector('[class*="rotate-45"]')).toBeNull();
  });

  it("manual-X and auto-X render the neutral ink cross - never red", () => {
    const mx = render(GridCell, { ...base, state: "manualX" });
    expect(mx.querySelectorAll('[class*="rotate-45"]')).toHaveLength(2); // two ink bars
    expect(mx.querySelector(".bg-ink")).not.toBeNull();
    expect(mx.querySelector("[class*='violate']")).toBeNull(); // colour = state, not "wrong"
    const ax = render(GridCell, { ...base, state: "autoX" });
    expect(ax.querySelector(".opacity-40")).not.toBeNull(); // the derived auto-X reads dimmer
  });
});

describe("GridCell interaction + a11y", () => {
  it("a tap (click) toggles the manual-X via ontap, never ontick", () => {
    const ontap = vi.fn();
    const ontick = vi.fn();
    render(GridCell, { ...base, state: "blank", ontap, ontick }).querySelector("button")!.click();
    expect(ontap).toHaveBeenCalledTimes(1);
    expect(ontick).not.toHaveBeenCalled();
  });

  it("Enter ticks the positive, Space crosses out (keyboard split)", () => {
    const ontap = vi.fn();
    const ontick = vi.fn();
    const btn = render(GridCell, { ...base, state: "blank", ontap, ontick }).querySelector("button")!;
    btn.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    btn.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }));
    expect(ontick).toHaveBeenCalledTimes(1);
    expect(ontap).toHaveBeenCalledTimes(1);
  });

  it("carries its roving tabindex and disables when locked", () => {
    expect(render(GridCell, { ...base, state: "blank", tabindex: 0 }).querySelector("button")!.getAttribute("tabindex")).toBe("0");
    const locked = render(GridCell, { ...base, state: "tick", glyph: null, locked: true });
    expect((locked.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("NotesGrid (one-block editor)", () => {
  const blocks = gridBlocks(gridCategories(new Game(m, STD).board));
  const block = blocks[0];

  it("renders a real table with scoped headers and one button per pairing", () => {
    const g = new Game(m, STD);
    const el = render(NotesGrid, {
      game: g, block, blocks, index: 0, copy: GRID_COPY_FALLBACK,
      size: 40, snap: { radius_factor: 0.9, ease: 0.6 }, onnav: () => {},
    });
    expect(el.querySelector("table")).not.toBeNull();
    expect(el.querySelectorAll("th[scope='col']")).toHaveLength(block.colCat.values.length + 1); // + corner
    expect(el.querySelectorAll("th[scope='row']")).toHaveLength(block.rowCat.values.length);
    expect(el.querySelectorAll("[data-cell-key]")).toHaveLength(block.rowCat.values.length * block.colCat.values.length);
  });

  it("tapping a cell records a manual-X in the play store", () => {
    const g = new Game(m, STD);
    const el = render(NotesGrid, {
      game: g, block, blocks, index: 0, copy: GRID_COPY_FALLBACK,
      size: 40, snap: { radius_factor: 0.9, ease: 0.6 }, onnav: () => {},
    });
    const cell = el.querySelector("[data-cell-key]") as HTMLButtonElement;
    cell.click();
    flushSync();
    expect(Object.keys(g.gridManualX)).toEqual([cell.dataset.cellKey]);
  });
});
