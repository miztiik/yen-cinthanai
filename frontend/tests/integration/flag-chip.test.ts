// @vitest-environment jsdom
// Integration (render): the Puck frame in a real DOM. A flags-pack glyph renders as a
// rounded-rect CHIP (landscape, hugging the flag edge-to-edge); every other pack keeps the
// circular crop. Pack-driven off the ref - no per-country branching. Svelte 5 mount in jsdom
// (same harness as grid-render.test.ts); no network, no mocks. flags.france + shapes.circle
// are real registry refs, so Glyph resolves without touching the network.

import { mount, unmount, type Component } from "svelte";
import { afterEach, describe, it, expect } from "vitest";
import Puck from "../../src/components/Puck.svelte";

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

describe("Puck frame shape", () => {
  it("renders a flags glyph as a rounded-rect chip (landscape, full-bleed)", () => {
    const el = render(Puck, { ref: "flags.france", label: "France" });
    const span = el.querySelector("span")!;
    expect(span.className).toContain("rounded-md");
    expect(span.className).not.toContain("rounded-full");
    // a chip is a landscape rectangle: wider than tall
    expect(parseInt(span.style.width)).toBeGreaterThan(parseInt(span.style.height));
    const img = el.querySelector("img")!;
    expect(img.className).toContain("object-cover"); // fills the chip edge-to-edge
    expect(img.getAttribute("src")).toContain("flags/france.svg");
  });

  it("renders a non-flags glyph as the circular puck (square, letterboxed)", () => {
    const el = render(Puck, { ref: "shapes.circle", label: "Circle" });
    const span = el.querySelector("span")!;
    expect(span.className).toContain("rounded-full");
    expect(span.className).not.toContain("rounded-md");
    expect(parseInt(span.style.width)).toBe(parseInt(span.style.height)); // square
    expect(el.querySelector("img")!.className).toContain("object-contain");
  });

  it("keeps an empty slot (no ref) a circular drop-target", () => {
    const el = render(Puck, { ref: null });
    expect(el.querySelector("span")!.className).toContain("rounded-full");
    expect(el.querySelector("img")).toBeNull();
  });
});
