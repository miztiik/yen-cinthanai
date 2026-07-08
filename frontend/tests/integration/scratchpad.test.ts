// @vitest-environment jsdom
// Integration (render): the free-text scratch pad. Proves it restores its seeded value, is a
// collapsed <details> (never autofocuses / raises the keyboard on load), DEBOUNCES input to
// avoid a synchronous whole-save write per keystroke, and flushes immediately on blur. Svelte
// 5 mount in jsdom; fake timers drive the debounce. No network, no mocks. See ScratchPad.svelte.

import { mount, unmount, type Component } from "svelte";
import { afterEach, describe, it, expect, vi } from "vitest";
import ScratchPad from "../../src/components/ScratchPad.svelte";

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

describe("ScratchPad", () => {
  it("restores its seeded value and stays a collapsed, non-autofocusing disclosure", () => {
    const el = render(ScratchPad, { value: "seed note", label: "Scratch pad", onchange: () => {} });
    expect((el.querySelector("textarea") as HTMLTextAreaElement).value).toBe("seed note");
    expect((el.querySelector("details") as HTMLDetailsElement).open).toBe(false); // collapsed by default
    expect(el.querySelector("summary")?.textContent).toBe("Scratch pad");
    expect(document.activeElement).not.toBe(el.querySelector("textarea")); // never autofocuses
  });

  it("debounces input and flushes immediately on blur", () => {
    vi.useFakeTimers();
    const changes: string[] = [];
    const el = render(ScratchPad, { value: "", label: "Scratch pad", onchange: (t: string) => changes.push(t) });
    const ta = el.querySelector("textarea") as HTMLTextAreaElement;

    ta.value = "note one";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    expect(changes).toHaveLength(0); // debounced - no per-keystroke whole-save write
    vi.advanceTimersByTime(400);
    expect(changes).toEqual(["note one"]); // persisted after the idle window

    ta.value = "note two";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.dispatchEvent(new Event("blur", { bubbles: true }));
    expect(changes).toEqual(["note one", "note two"]); // blur flushes without waiting
    vi.useRealTimers();
  });
});
