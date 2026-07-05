// @vitest-environment jsdom
// Integration (render): the in-puzzle DisplaySheet. Three toggles reflect + write the display
// mode; the glyphs/labels invariant (at least one on) is enforced; scrim closes. Svelte 5 mount
// in jsdom, no network, no mocks (same harness as tier-meter.test.ts). See DisplaySheet.svelte.

import { mount, unmount, type Component } from "svelte";
import { afterEach, describe, it, expect, vi } from "vitest";
import DisplaySheet from "../../src/components/DisplaySheet.svelte";
import type { DisplaySettings } from "../../src/contracts/save";

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

const sw = (el: HTMLElement, label: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const base: DisplaySettings = { color: true, glyphs: true, labels: true };

describe("DisplaySheet", () => {
  it("renders the three toggles reflecting the current display", () => {
    const el = render(DisplaySheet, { display: base, onchange: () => {}, onclose: () => {} });
    expect(sw(el, "Color").getAttribute("aria-checked")).toBe("true");
    expect(sw(el, "Glyphs")).toBeTruthy();
    expect(sw(el, "Text labels")).toBeTruthy();
  });

  it("toggles color via onchange", () => {
    const onchange = vi.fn();
    const el = render(DisplaySheet, { display: base, onchange, onclose: () => {} });
    sw(el, "Color").click();
    expect(onchange).toHaveBeenCalledWith({ color: false, glyphs: true, labels: true });
  });

  it("forces labels on when glyphs is turned off (invariant)", () => {
    const onchange = vi.fn();
    const el = render(DisplaySheet, { display: { color: true, glyphs: true, labels: false }, onchange, onclose: () => {} });
    sw(el, "Glyphs").click(); // glyphs off while labels already off -> labels forced on
    expect(onchange).toHaveBeenCalledWith({ color: true, glyphs: false, labels: true });
  });

  it("forces glyphs on when labels is turned off while glyphs is off (invariant)", () => {
    const onchange = vi.fn();
    const el = render(DisplaySheet, { display: { color: true, glyphs: false, labels: true }, onchange, onclose: () => {} });
    sw(el, "Text labels").click(); // labels off while glyphs off -> glyphs forced on
    expect(onchange).toHaveBeenCalledWith({ color: true, glyphs: true, labels: false });
  });

  it("closes on scrim click", () => {
    const onclose = vi.fn();
    const el = render(DisplaySheet, { display: base, onchange: () => {}, onclose });
    el.querySelector<HTMLButtonElement>('button[aria-label="close"]')!.click();
    expect(onclose).toHaveBeenCalledOnce();
  });
});
