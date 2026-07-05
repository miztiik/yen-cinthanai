// @vitest-environment jsdom
// Integration (render): the difficulty TierMeter draws `rank` filled bars out of the total,
// ascending in height, filled with the tier's colour token - so the LEVEL is carried by the
// bar count + staircase (not colour alone) and the word can be dropped from the badge. Config-
// driven off order + colors (config/ui.json [difficulty]). Svelte 5 mount in jsdom, no network,
// no mocks (same harness as flag-chip.test.ts). See components/TierMeter.svelte, ui-shell.md.

import { mount, unmount, type Component } from "svelte";
import { afterEach, describe, it, expect } from "vitest";
import TierMeter from "../../src/components/TierMeter.svelte";
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
  return target;
}
afterEach(() => {
  for (const i of instances.splice(0)) unmount(i);
  document.body.innerHTML = "";
});

function bars(el: HTMLElement): HTMLElement[] {
  const meter = el.querySelector('[role="img"]')!;
  return Array.from(meter.querySelectorAll(":scope > span")) as HTMLElement[];
}

describe("TierMeter", () => {
  it("fills `rank` bars in the tier colour, leaves the rest dim", () => {
    const el = render(TierMeter, { tier: "standard", difficulty });
    const b = bars(el);
    expect(b).toHaveLength(4); // total = order.length
    // standard = rank 2: first two filled with the standardized amber (#eab308), last two dim ink
    expect(b[0].style.backgroundColor).toBe("rgb(234, 179, 8)");
    expect(b[1].style.backgroundColor).toBe("rgb(234, 179, 8)");
    expect(b[2].getAttribute("style")).toContain("var(--ink)");
    expect(b[2].className).toContain("opacity-20");
    expect(b[3].className).toContain("opacity-20");
  });

  it("draws an ascending staircase (each bar taller than the last)", () => {
    const el = render(TierMeter, { tier: "expert", difficulty });
    const heights = bars(el).map((s) => parseInt(s.style.height));
    expect(heights).toEqual([25, 50, 75, 100]);
    // expert = rank 4: every bar filled with the standardized red (#ef4444), none dim
    expect(bars(el).every((s) => s.style.backgroundColor === "rgb(239, 68, 68)")).toBe(true);
  });

  it("labels the level for a screen reader when label is on (colour never alone)", () => {
    const el = render(TierMeter, { tier: "sharp", difficulty });
    expect(el.querySelector('[role="img"]')!.getAttribute("aria-label")).toBe("difficulty sharp, 3 of 4");
  });

  it("omits the label when asked (badge word-less; name is taught in the picker)", () => {
    const el = render(TierMeter, { tier: "easy", difficulty, label: false });
    expect(el.querySelector('[role="img"]')!.getAttribute("aria-label")).toBeNull();
  });
});
