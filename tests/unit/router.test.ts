import { describe, it, expect } from "vitest";
import { toRoute, hrefFor } from "../../src/lib/router.svelte";

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
