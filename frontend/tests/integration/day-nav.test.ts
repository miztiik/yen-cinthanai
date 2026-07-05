// @vitest-environment jsdom
// Integration (render): the Board day-nav carets. Next disables at today (hasNext=false), prev
// disables at the oldest shipped day (hasPrev=false); an enabled caret fires its handler and a
// disabled one does not. Svelte 5 mount in jsdom, no network, no mocks (same harness as
// tier-meter.test.ts). See components/DayNav.svelte, docs/concepts/ui-shell.md.

import { mount, unmount, type Component } from "svelte";
import { afterEach, describe, it, expect, vi } from "vitest";
import DayNav from "../../src/components/DayNav.svelte";

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

const btn = (el: HTMLElement, label: string) =>
  el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

describe("DayNav", () => {
  it("shows the day label", () => {
    const el = render(DayNav, { label: "Sun 29 Jun", hasPrev: true, hasNext: true, onprev: () => {}, onnext: () => {} });
    expect(el.textContent).toContain("Sun 29 Jun");
  });

  it("disables next at today (hasNext=false), keeps prev enabled", () => {
    const el = render(DayNav, { label: "Today", hasPrev: true, hasNext: false, onprev: () => {}, onnext: () => {} });
    expect(btn(el, "next day").disabled).toBe(true);
    expect(btn(el, "previous day").disabled).toBe(false);
  });

  it("disables prev at the oldest day (hasPrev=false)", () => {
    const el = render(DayNav, { label: "Mon 22 Jun", hasPrev: false, hasNext: true, onprev: () => {}, onnext: () => {} });
    expect(btn(el, "previous day").disabled).toBe(true);
    expect(btn(el, "next day").disabled).toBe(false);
  });

  it("fires the handler for an enabled caret", () => {
    const onprev = vi.fn();
    const onnext = vi.fn();
    const el = render(DayNav, { label: "Sun 29 Jun", hasPrev: true, hasNext: true, onprev, onnext });
    btn(el, "previous day").click();
    btn(el, "next day").click();
    expect(onprev).toHaveBeenCalledOnce();
    expect(onnext).toHaveBeenCalledOnce();
  });

  it("a disabled caret does not fire its handler", () => {
    const onnext = vi.fn();
    const el = render(DayNav, { label: "Today", hasPrev: true, hasNext: false, onprev: () => {}, onnext });
    btn(el, "next day").click();
    expect(onnext).not.toHaveBeenCalled();
  });
});
