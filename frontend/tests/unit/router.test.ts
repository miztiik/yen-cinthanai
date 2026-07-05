import { describe, it, expect } from "vitest";
import { toRoute, hrefFor, route, navigate, syncLocation } from "../../src/lib/router.svelte";

describe("router base-path helpers", () => {
  it("strips the base to an app-relative route", () => {
    expect(toRoute("/")).toBe("/");
    expect(toRoute("/play")).toBe("/play");
  });

  it("round-trips a route through hrefFor + toRoute", () => {
    expect(toRoute(hrefFor("play"))).toBe("/play");
    expect(toRoute(hrefFor("settings"))).toBe("/settings");
  });
});

describe("shape drawer navigation", () => {
  it("drawer tier chip opens that tier; back returns home in one step", () => {
    navigate("play/standard");
    expect(route()).toBe("/play/standard");
    navigate("");
    expect(route()).toBe("/");
  });

  it("opens any tier's shape from the drawer", () => {
    for (const t of ["easy", "standard", "sharp", "expert"]) {
      navigate(`play/${t}`);
      expect(route()).toBe(`/play/${t}`);
    }
  });
});

describe("syncLocation (address-bar canonicalize)", () => {
  it("does not change the reactive route - only the address bar unfurls", () => {
    navigate("play/standard");
    syncLocation("play/2026-07-05/standard");
    expect(route()).toBe("/play/standard"); // route unchanged; no remount, no BACK trap
  });
});
