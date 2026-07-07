// @vitest-environment jsdom
// Integration (render): the Tooltip bubble. It renders the text in a role=tooltip element and
// wires aria-describedby onto the trigger; it stays hidden until focus (instant) or a fine
// (mouse) hover after the delay; a touch pointer is a no-op. Svelte 5 mount in jsdom via a
// small snippet harness (_tooltip-harness.svelte), no network, no mocks. PointerEvent is not
// implemented in jsdom, so a plain Event carries a defined pointerType. See Tooltip.svelte.

import { mount, unmount, flushSync, type Component } from "svelte";
import { afterEach, describe, it, expect, vi } from "vitest";
import Harness from "./_tooltip-harness.svelte";

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

const bubble = (el: HTMLElement) => el.querySelector<HTMLElement>('[role="tooltip"]')!;
const trigger = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('[data-testid="trigger"]')!;
function pointerEnter(target: HTMLElement, pointerType: string): void {
  const ev = new Event("pointerenter", { bubbles: true });
  Object.defineProperty(ev, "pointerType", { value: pointerType });
  target.dispatchEvent(ev);
}

describe("Tooltip", () => {
  it("renders the text in a role=tooltip and wires aria-describedby to the trigger", () => {
    const el = render(Harness, {});
    const b = bubble(el);
    expect(b.textContent?.trim()).toBe("Hello");
    expect(trigger(el).getAttribute("aria-describedby")).toBe(b.id);
  });

  it("is hidden by default and appears instantly on focus", () => {
    const el = render(Harness, {});
    expect(bubble(el).getAttribute("data-open")).toBe("false");
    trigger(el).dispatchEvent(new Event("focusin", { bubbles: true }));
    flushSync();
    expect(bubble(el).getAttribute("data-open")).toBe("true");
  });

  it("hides again on blur", () => {
    const el = render(Harness, {});
    trigger(el).dispatchEvent(new Event("focusin", { bubbles: true }));
    flushSync();
    trigger(el).dispatchEvent(new Event("focusout", { bubbles: true }));
    flushSync();
    expect(bubble(el).getAttribute("data-open")).toBe("false");
  });

  it("appears on a fine (mouse) hover only after the configured delay", () => {
    vi.useFakeTimers();
    const el = render(Harness, { delayMs: 350 });
    const wrap = bubble(el).parentElement!;
    pointerEnter(wrap, "mouse");
    flushSync();
    expect(bubble(el).getAttribute("data-open")).toBe("false");
    vi.advanceTimersByTime(350);
    flushSync();
    expect(bubble(el).getAttribute("data-open")).toBe("true");
    vi.useRealTimers();
  });

  it("does not appear on touch (no-op; the aria-label carries the meaning)", () => {
    vi.useFakeTimers();
    const el = render(Harness, {});
    const wrap = bubble(el).parentElement!;
    pointerEnter(wrap, "touch");
    vi.advanceTimersByTime(1000);
    flushSync();
    expect(bubble(el).getAttribute("data-open")).toBe("false");
    vi.useRealTimers();
  });
});
