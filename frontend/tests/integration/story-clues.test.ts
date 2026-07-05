// @vitest-environment jsdom
// Integration (render): the story-first clue UI in a real DOM. Proves StoryPanel shows /
// hides the cold-open, ClueList renders a numbered <ol> of full-sentence clues, the
// check-dot strike toggles + reverses with aria-pressed, and auto-dim on a satisfied clue
// fires only for a soft feedback dial (easy/standard), never for sharp/expert (no leak).
// Svelte 5 mount/flushSync in jsdom (vitest uses the web transform for jsdom files, so the
// components compile client-side); jsdom is the only test-only dep. No network, no mocks.

import { mount, unmount, flushSync, type Component } from "svelte";
import { afterEach, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import StoryPanel from "../../src/components/StoryPanel.svelte";
import ClueList from "../../src/components/ClueList.svelte";
import ClueRow from "../../src/components/ClueRow.svelte";
import { Game } from "../../src/state/play.svelte";
import { CLUES_COPY_FALLBACK, type Feedback, type TierDial } from "../../src/lib/config";
import type { PuzzleManifest } from "../../src/contracts/manifest";

// jsdom sets import.meta.url to a non-file URL, so resolve the fixture from the vitest
// cwd (the frontend package root) instead of fileURLToPath.
const m = JSON.parse(
  readFileSync(resolve(process.cwd(), "tests/fixtures/story-first-standard.json"), "utf8"),
) as PuzzleManifest;

const SOFT: Feedback[] = ["realtime-names", "count-wrong"];
const STD: TierDial = { par_s: 240, hints: 2, attempts: 3, feedback: "count-wrong" }; // soft
const EXPERT: TierDial = { par_s: 900, hints: 0, attempts: 1, feedback: "submit-binary" }; // hard

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

describe("StoryPanel", () => {
  it("renders the cold-open narrative when a story is present", () => {
    const el = render(StoryPanel, { story: m.story ?? "" });
    expect(el.querySelector("section")).not.toBeNull();
    expect(el.textContent).toContain("riverside craft market");
  });

  it("renders nothing for a legacy manifest (no story)", () => {
    const el = render(StoryPanel, { story: "" });
    expect(el.querySelector("section")).toBeNull();
    expect((el.textContent ?? "").trim()).toBe("");
  });
});

describe("ClueList", () => {
  it("renders a numbered <ol> of full-sentence clues", () => {
    const g = new Game(m, STD);
    const el = render(ClueList, { game: g, copy: CLUES_COPY_FALLBACK, soft: SOFT });
    expect(el.querySelector("ol")).not.toBeNull();
    const items = el.querySelectorAll("ol > li");
    expect(items).toHaveLength(m.constraints.length);
    items.forEach((li, i) => {
      expect(li.textContent).toContain(`${i + 1}`);
      expect(li.textContent).toContain(m.constraints[i].clueText);
    });
  });

  it("the check-dot strikes a clue and reverses, tracking aria-pressed", () => {
    const g = new Game(m, STD);
    const el = render(ClueList, { game: g, copy: CLUES_COPY_FALLBACK, soft: SOFT });
    const id = m.constraints[0].id;
    const dot = () => el.querySelector("ol button") as HTMLButtonElement;

    expect(dot().getAttribute("aria-pressed")).toBe("false");
    expect(el.querySelector("ol > li .line-through")).toBeNull();

    dot().click();
    flushSync();
    expect(g.struck[id]).toBe(true);
    expect(dot().getAttribute("aria-pressed")).toBe("true");
    expect(el.querySelector("ol > li .line-through")).not.toBeNull(); // sentence struck through

    dot().click(); // reversible
    flushSync();
    expect(g.struck[id]).toBe(false);
    expect(dot().getAttribute("aria-pressed")).toBe("false");
    expect(el.querySelector("ol > li .line-through")).toBeNull();
  });

  it("auto-dims a satisfied clue on a soft dial (standard) once revealed", () => {
    const g = new Game(m, STD); // count-wrong = soft
    g.place("e0", "name", "dev");
    g.place("e1", "craft", "jam"); // c3: neq(dev, jam) on different entities -> satisfy
    g.check(); // reveal (checked), board not complete so no win
    expect(g.evalState.clues["c3"]).toBe("satisfy");

    const el = render(ClueList, { game: g, copy: CLUES_COPY_FALLBACK, soft: SOFT });
    expect(el.querySelectorAll("ol .line-through")).toHaveLength(1); // only the satisfied clue
    const li3 = el.querySelectorAll("ol > li")[2]; // c3 is the 3rd row
    expect(li3.querySelector(".line-through")).not.toBeNull();
  });

  it("does NOT auto-dim a satisfied clue on a hard dial (expert) - no feedback leak", () => {
    const g = new Game(m, EXPERT); // submit-binary = hard
    g.place("e0", "name", "dev");
    g.place("e1", "craft", "jam");
    g.check();
    expect(g.evalState.clues["c3"]).toBe("satisfy");

    const el = render(ClueList, { game: g, copy: CLUES_COPY_FALLBACK, soft: SOFT });
    expect(el.querySelectorAll("ol .line-through")).toHaveLength(0);
  });
});

describe("ClueRow", () => {
  it("exposes a labelled check-dot button with aria-pressed reflecting the strike", () => {
    let toggled = 0;
    const el = render(ClueRow, {
      n: 1,
      text: "Ana threw the pottery.",
      struck: false,
      dimmed: false,
      strikeLabel: "Cross out clue 1",
      onToggle: () => {
        toggled += 1;
      },
    });
    const btn = el.querySelector("button") as HTMLButtonElement;
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.getAttribute("aria-label")).toBe("Cross out clue 1");
    btn.click();
    expect(toggled).toBe(1);
  });

  it("strikes the sentence through when struck/dimmed", () => {
    const el = render(ClueRow, {
      n: 2,
      text: "Jam was not Dev's work.",
      struck: true,
      dimmed: true,
      strikeLabel: "Restore clue 2",
      onToggle: () => {},
    });
    expect((el.querySelector("button") as HTMLButtonElement).getAttribute("aria-pressed")).toBe("true");
    expect(el.querySelector(".line-through")).not.toBeNull();
  });
});
