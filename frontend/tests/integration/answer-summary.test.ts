// @vitest-environment jsdom
// Integration (render): the PRIVATE post-win answer reveal in a real DOM. Proves it draws a
// labelled a11y <table> (caption + scoped headers) of the solved grid, and - critically -
// carries NO share CTA (no button, no link, no "share" text). The shareable ShareCard stays
// stats-only (share-noleak.test.ts); this reveal is the solver's alone. Svelte 5 mount in
// jsdom (web transform for jsdom files); jsdom is the only test-only dep. No network, no mocks.

import { mount, unmount, type Component } from "svelte";
import { afterEach, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import AnswerSummary from "../../src/components/AnswerSummary.svelte";
import { buildBoard } from "../../src/lib/board";
import { answerGrid } from "../../src/lib/answer";
import type { PuzzleManifest } from "../../src/contracts/manifest";

// jsdom sets import.meta.url to a non-file URL, so resolve from the vitest cwd (frontend root).
const m = JSON.parse(
  readFileSync(resolve(process.cwd(), "tests/fixtures/story-clues.json"), "utf8"),
) as PuzzleManifest;
const grid = answerGrid(buildBoard(m), m.solution);

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

describe("AnswerSummary", () => {
  it("renders the solved grid as an a11y table labelled by the heading", () => {
    const el = render(AnswerSummary, { grid, heading: "Solution", caption: "The solved grid." });
    expect(el.querySelector("section")?.getAttribute("aria-label")).toBe("Solution");
    expect(el.querySelector("table")).not.toBeNull();
    expect(el.querySelector("caption")?.textContent).toContain("solved grid");

    const colHeads = Array.from(el.querySelectorAll("thead th")).map((t) => t.textContent?.trim());
    expect(colHeads).toContain("Craft");
    expect(colHeads).toContain("Price");

    const rowHeads = Array.from(el.querySelectorAll('th[scope="row"]')).map((t) => t.textContent?.trim());
    expect(rowHeads).toEqual(["N0", "N1", "N2", "N3"]);
    expect(el.textContent).toContain("Alpha");
    expect(el.textContent).toContain("20");
  });

  it("is a PRIVATE reveal - no share (or any) button or link CTA", () => {
    const el = render(AnswerSummary, { grid, heading: "Solution" });
    expect(el.querySelector("button")).toBeNull();
    expect(el.querySelector("a")).toBeNull();
    expect((el.textContent ?? "").toLowerCase()).not.toContain("share");
  });
});
