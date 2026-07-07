// @vitest-environment jsdom
// Integration (render): the AttemptPips resource. `total` dots render, the leading `left`
// filled and the trailing spent ones dimmed (opacity only), and it carries a role=img
// aria-label so a screen reader hears the count. Svelte 5 mount in jsdom, no network, no
// mocks (same harness as tier-meter.test.ts). See components/AttemptPips.svelte, ui-shell.md.

import { mount, unmount, flushSync, type Component } from "svelte";
import { afterEach, describe, it, expect } from "vitest";
import AttemptPips from "../../src/components/AttemptPips.svelte";

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

function pips(el: HTMLElement): HTMLElement[] {
  const img = el.querySelector('[role="img"]')!;
  return Array.from(img.querySelectorAll(":scope > span")) as HTMLElement[];
}

describe("AttemptPips", () => {
  it("renders one pip per attempt (total), all filled when none spent", () => {
    const el = render(AttemptPips, { left: 2, total: 2 });
    const p = pips(el);
    expect(p).toHaveLength(2);
    expect(p.every((s) => s.className.includes("opacity-70"))).toBe(true);
  });

  it("dims the trailing spent pip once an attempt is burned (2 -> 1)", () => {
    const el = render(AttemptPips, { left: 1, total: 2 });
    const p = pips(el);
    expect(p[0].className).toContain("opacity-70");
    expect(p[1].className).toContain("opacity-20");
  });

  it("dims every pip when the budget is spent (1 -> 0)", () => {
    const el = render(AttemptPips, { left: 0, total: 2 });
    expect(pips(el).every((s) => s.className.includes("opacity-20"))).toBe(true);
  });

  it("labels the resource for a screen reader (role=img, colour never alone)", () => {
    const el = render(AttemptPips, { left: 1, total: 2 });
    expect(el.querySelector('[role="img"]')!.getAttribute("aria-label")).toBe("1 of 2 attempts left");
  });
});
