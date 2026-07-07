// @vitest-environment jsdom
// Integration (render): the DayPicker calendar popover. It is a dialog; only the shipped
// `dates` cells are enabled, the current day is aria-current, month nav is bounded to the
// months holding shipped days, Escape closes, and focus returns to the trigger on close.
// Svelte 5 mount in jsdom, no network, no mocks (same harness as tier-meter.test.ts). All
// UTC. See components/DayPicker.svelte, lib/dates.ts, docs/concepts/ui-shell.md.

import { mount, unmount, flushSync, type Component } from "svelte";
import { afterEach, describe, it, expect, vi } from "vitest";
import DayPicker from "../../src/components/DayPicker.svelte";

const dates = ["2026-06-29", "2026-07-01", "2026-07-05", "2026-07-06"];
const today = "2026-07-07";

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

const dayButtons = (el: HTMLElement) =>
  Array.from(el.querySelectorAll<HTMLButtonElement>("button")).filter((b) => {
    const l = b.getAttribute("aria-label") ?? "";
    return l !== "previous month" && l !== "next month" && l !== "close";
  });
const noop = () => {};

describe("DayPicker", () => {
  it("renders a modal dialog", () => {
    const el = render(DayPicker, { current: "2026-07-05", dates, today, onpick: noop, onclose: noop });
    const dialog = el.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  it("enables only the shipped days of the viewed month; non-shipped days are disabled", () => {
    const el = render(DayPicker, { current: "2026-07-05", dates, today, onpick: noop, onclose: noop });
    const enabled = dayButtons(el).filter((b) => !b.disabled);
    expect(enabled).toHaveLength(3); // 2026-07-01, -05, -06 (June 29 is the previous month)
    // today (2026-07-07) has no puzzle, so it is marked but disabled
    const todayCell = dayButtons(el).find((b) => (b.getAttribute("aria-label") ?? "").includes("today"))!;
    expect(todayCell.disabled).toBe(true);
  });

  it("rings the current day (aria-current=date)", () => {
    const el = render(DayPicker, { current: "2026-07-05", dates, today, onpick: noop, onclose: noop });
    const current = el.querySelector('[aria-current="date"]')!;
    expect(current.textContent?.trim()).toContain("5");
  });

  it("hands the picked ISO date back to the caller", () => {
    const onpick = vi.fn();
    const el = render(DayPicker, { current: "2026-07-05", dates, today, onpick, onclose: noop });
    (el.querySelector('[aria-current="date"]') as HTMLButtonElement).click();
    expect(onpick).toHaveBeenCalledWith("2026-07-05");
  });

  it("closes on Escape", () => {
    const onclose = vi.fn();
    render(DayPicker, { current: "2026-07-05", dates, today, onpick: noop, onclose });
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onclose).toHaveBeenCalledOnce();
  });

  it("bounds month nav to the months holding shipped days", () => {
    const el = render(DayPicker, { current: "2026-06-29", dates, today, onpick: noop, onclose: noop });
    const prev = el.querySelector<HTMLButtonElement>('button[aria-label="previous month"]')!;
    const next = el.querySelector<HTMLButtonElement>('button[aria-label="next month"]')!;
    expect(prev.disabled).toBe(true); // June is the earliest shipped month
    expect(next.disabled).toBe(false);
    next.click();
    flushSync();
    expect(el.querySelector('[aria-live="polite"]')!.textContent).toContain("July");
  });

  it("returns focus to the trigger on close", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const target = document.createElement("div");
    document.body.appendChild(target);
    const inst = mount(DayPicker, { target, props: { current: "2026-07-05", dates, today, onpick: noop, onclose: noop } });
    flushSync();
    expect(document.activeElement).not.toBe(opener); // focus moved into the dialog

    unmount(inst);
    flushSync();
    expect(document.activeElement).toBe(opener); // focus returned to the trigger
  });
});
