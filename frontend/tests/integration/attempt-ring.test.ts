// @vitest-environment jsdom
// Integration (render): the AttemptRing resource. `total` arc wedges render (one per life),
// the leading `left` lit and the trailing spent ones dimmed to ink (opacity only); the lit
// colour ramps green (full) -> amber (middle) -> red (last life), left===1 beating full so a
// single-arc Expert ring reads red; the config fade duration rides each arc; and it carries a
// role=img aria-label so a screen reader hears the count. Svelte 5 mount in jsdom, no network,
// no mocks (same harness as attempt-pips.test.ts / tier-meter.test.ts). See AttemptRing.svelte.

import { mount, unmount, flushSync, type Component } from "svelte";
import { afterEach, describe, it, expect } from "vitest";
import AttemptRing from "../../src/components/AttemptRing.svelte";

const instances: ReturnType<typeof mount>[] = [];
function render<P extends Record<string, unknown>>(comp: Component<P>, props: P): HTMLElement {
  const target = document.createElement("div");
  document.body.appendChild(target);
  instances.push(mount(comp, { target, props }));
  flushSync();
  return target;
}
afterEach(() => {
  for (const i of instances.splice(0)) unmount(i);
  document.body.innerHTML = "";
});

function arcs(el: HTMLElement): Element[] {
  return Array.from(el.querySelectorAll("svg path"));
}
const cls = (p: Element): string => p.getAttribute("class") ?? "";
// jsdom reserializes the inline style with spaces (`stroke: var(--x); ...`), so compare
// whitespace-free to stay robust to that formatting.
const style = (p: Element): string => (p.getAttribute("style") ?? "").replace(/\s+/g, "");

describe("AttemptRing", () => {
  it("draws one arc per attempt (total), all lit when none spent", () => {
    const a = arcs(render(AttemptRing, { left: 3, total: 3 }));
    expect(a).toHaveLength(3);
    expect(a.every((p) => !cls(p).includes("opacity-20"))).toBe(true);
  });

  it("dims the trailing spent arc once an attempt is burned (2 -> 1) to ink", () => {
    const a = arcs(render(AttemptRing, { left: 1, total: 2 }));
    expect(cls(a[0])).not.toContain("opacity-20"); // lit
    expect(cls(a[1])).toContain("opacity-20"); // spent
    expect(style(a[1])).toContain("stroke:var(--ink)"); // spent -> ink token
  });

  it("dims every arc when the budget is spent (1 -> 0)", () => {
    const a = arcs(render(AttemptRing, { left: 0, total: 2 }));
    expect(a.every((p) => cls(p).includes("opacity-20"))).toBe(true);
  });

  it("ramps the lit colour by urgency: green full, amber middle, red last life (default ramp)", () => {
    // jsdom reserialises the inline hex via CSSOM to rgb(); assert that normalized form.
    expect(style(arcs(render(AttemptRing, { left: 3, total: 3 }))[0])).toContain("stroke:rgb(34,197,94)");
    expect(style(arcs(render(AttemptRing, { left: 2, total: 3 }))[0])).toContain("stroke:rgb(245,158,11)");
    expect(style(arcs(render(AttemptRing, { left: 1, total: 2 }))[0])).toContain("stroke:rgb(239,68,68)");
  });

  it("reads a single-arc Expert ring as last-life red (left===1 beats full)", () => {
    expect(style(arcs(render(AttemptRing, { left: 1, total: 1 }))[0])).toContain("stroke:rgb(239,68,68)");
  });

  it("uses the config-provided urgency ramp (chrome.attemptColors) when given", () => {
    const colors = { full: "var(--full)", mid: "var(--mid)", low: "var(--low)" };
    expect(style(arcs(render(AttemptRing, { left: 3, total: 3, colors }))[0])).toContain("stroke:var(--full)");
    expect(style(arcs(render(AttemptRing, { left: 2, total: 3, colors }))[0])).toContain("stroke:var(--mid)");
    expect(style(arcs(render(AttemptRing, { left: 1, total: 2, colors }))[0])).toContain("stroke:var(--low)");
  });

  it("carries the config fade duration on each arc (transform/opacity only)", () => {
    expect(style(arcs(render(AttemptRing, { left: 2, total: 2, fadeMs: 150 }))[0])).toContain("transition-duration:150ms");
  });

  it("labels the resource for a screen reader (role=img, colour never alone)", () => {
    const el = render(AttemptRing, { left: 1, total: 2 });
    expect(el.querySelector('[role="img"]')!.getAttribute("aria-label")).toBe("1 of 2 attempts left");
  });
});
