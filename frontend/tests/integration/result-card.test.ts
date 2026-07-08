// @vitest-environment jsdom
// Integration (render): the end-card (win/fail) is a HELD card but never a trap - a scrim tap
// or Escape dismisses it (ondismiss) to review the board underneath, mirroring the other
// overlays (display-sheet.test.ts). The fail variant still surfaces RETRY. Svelte 5 mount in
// jsdom, no network, no mocks. See ResultCard.svelte, Board.svelte.

import { mount, unmount, type Component } from "svelte";
import { afterEach, describe, it, expect, vi } from "vitest";
import ResultCard from "../../src/components/ResultCard.svelte";

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

const base = {
  phrase: "Sharpen up.",
  stars: 0,
  solveMs: 3000,
  hintsUsed: 0,
  wrong: 2,
  streak: 0,
  shapeGlyph: "abstract.grid",
  share: "",
  onhome: () => {},
  onstats: () => {},
};

describe("ResultCard", () => {
  it("dismisses on a scrim tap (ondismiss)", () => {
    const ondismiss = vi.fn();
    const el = render(ResultCard, { ...base, variant: "fail" as const, onretry: () => {}, ondismiss });
    el.querySelector<HTMLButtonElement>('button[aria-label="close"]')!.click();
    expect(ondismiss).toHaveBeenCalledOnce();
  });

  it("dismisses on Escape (ondismiss)", () => {
    const ondismiss = vi.fn();
    render(ResultCard, { ...base, variant: "fail" as const, onretry: () => {}, ondismiss });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(ondismiss).toHaveBeenCalledOnce();
  });

  it("ignores non-Escape keys", () => {
    const ondismiss = vi.fn();
    render(ResultCard, { ...base, variant: "win" as const, ondismiss });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(ondismiss).not.toHaveBeenCalled();
  });

  it("still offers RETRY on the fail card", () => {
    const onretry = vi.fn();
    const el = render(ResultCard, { ...base, variant: "fail" as const, onretry, ondismiss: () => {} });
    const retry = [...el.querySelectorAll("button")].find((b) => b.textContent?.trim() === "retry");
    expect(retry).toBeTruthy();
    retry!.click();
    expect(onretry).toHaveBeenCalledOnce();
  });

  it("offers PLAY AGAIN on the win card when onagain is given", () => {
    const onagain = vi.fn();
    const el = render(ResultCard, { ...base, variant: "win" as const, onagain, ondismiss: () => {} });
    const again = [...el.querySelectorAll("button")].find((b) => b.textContent?.trim() === "play again");
    expect(again).toBeTruthy();
    again!.click();
    expect(onagain).toHaveBeenCalledOnce();
  });

  it("shows no PLAY AGAIN on the fail card", () => {
    const el = render(ResultCard, { ...base, variant: "fail" as const, onretry: () => {}, ondismiss: () => {} });
    const again = [...el.querySelectorAll("button")].find((b) => b.textContent?.trim() === "play again");
    expect(again).toBeFalsy();
  });
});
