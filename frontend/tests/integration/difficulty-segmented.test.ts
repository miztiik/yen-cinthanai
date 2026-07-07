// @vitest-environment jsdom
// Integration (render): the desktop DifficultySegmented switch. A radiogroup with one radio
// per tier, only the current one aria-checked; picking a segment hands the tier back. Svelte 5
// mount in jsdom, no network, no mocks (same harness as tier-meter.test.ts). See
// components/DifficultySegmented.svelte, docs/concepts/ui-shell.md.

import { mount, unmount, flushSync, type Component } from "svelte";
import { afterEach, describe, it, expect, vi } from "vitest";
import DifficultySegmented from "../../src/components/DifficultySegmented.svelte";
import type { DifficultyUi } from "../../src/lib/config";

const difficulty: DifficultyUi = {
  order: ["easy", "standard", "sharp", "expert"],
  colors: { easy: "#22c55e", standard: "#eab308", sharp: "#f97316", expert: "#ef4444" },
};

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

const radios = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLButtonElement>('[role="radio"]'));

describe("DifficultySegmented", () => {
  it("is a radiogroup with one radio per tier", () => {
    const el = render(DifficultySegmented, { current: "sharp", difficulty, onpick: () => {} });
    expect(el.querySelector('[role="radiogroup"]')).toBeTruthy();
    expect(radios(el)).toHaveLength(4);
  });

  it("checks only the current tier (aria-checked + aria-current)", () => {
    const el = render(DifficultySegmented, { current: "sharp", difficulty, onpick: () => {} });
    const checked = radios(el).filter((b) => b.getAttribute("aria-checked") === "true");
    expect(checked).toHaveLength(1);
    expect(checked[0].getAttribute("aria-label")).toBe("difficulty sharp");
    expect(checked[0].getAttribute("aria-current")).toBe("true");
  });

  it("hands the picked tier back to the caller", () => {
    const onpick = vi.fn();
    const el = render(DifficultySegmented, { current: "sharp", difficulty, onpick });
    radios(el).find((b) => b.getAttribute("aria-label") === "difficulty expert")!.click();
    expect(onpick).toHaveBeenCalledWith("expert");
  });
});
