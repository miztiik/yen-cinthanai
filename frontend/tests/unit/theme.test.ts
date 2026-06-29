// Unit: theme resolution + live apply. resolveScheme maps modes ("system" reads the
// media query); themeTokens picks the palette+scheme set and falls back to the default
// palette; applyTheme stamps data-theme/data-palette and writes the token custom
// properties; bootTheme is config-free. DOM writes run against a tiny fake document
// (node has none), mirroring lib/motion's guard. See ui-shell.md, config/palettes.toml.

import { describe, it, expect, afterEach } from "vitest";
import { resolveScheme, themeTokens, applyTheme, bootTheme } from "../../src/lib/theme";
import type { Palettes } from "../../src/lib/config";

const P: Palettes = {
  default: "midnight",
  themes: ["light", "dark", "system"],
  tokens: ["bg", "surface", "ink", "accent", "satisfy", "violate", "near", "gold"],
  palette: {
    midnight: {
      label: "Midnight",
      dark: { bg: "#000", surface: "#111", ink: "#fff", accent: "#0f0", satisfy: "#0f0", violate: "#f00", near: "#ff0", gold: "#fc0" },
      light: { bg: "#fff", surface: "#eee", ink: "#000", accent: "#080", satisfy: "#080", violate: "#900", near: "#960", gold: "#a60" },
    },
  },
};

class FakeStyle {
  props = new Map<string, string>();
  setProperty(k: string, v: string) {
    this.props.set(k, v);
  }
}
class FakeEl {
  dataset: Record<string, string> = {};
  style = new FakeStyle();
}
function withFakeDoc(el: FakeEl, fn: () => void) {
  const g = globalThis as { document?: unknown };
  g.document = { documentElement: el };
  fn();
}

afterEach(() => {
  delete (globalThis as { document?: unknown }).document;
});

describe("resolveScheme", () => {
  it("returns explicit modes unchanged", () => {
    expect(resolveScheme("light")).toBe("light");
    expect(resolveScheme("dark")).toBe("dark");
  });
  it("resolves system via prefers-color-scheme", () => {
    expect(resolveScheme("system", true)).toBe("dark");
    expect(resolveScheme("system", false)).toBe("light");
  });
});

describe("themeTokens", () => {
  it("returns the palette+scheme token set", () => {
    expect(themeTokens(P, "midnight", "dark")?.bg).toBe("#000");
    expect(themeTokens(P, "midnight", "light")?.ink).toBe("#000");
  });
  it("falls back to the default palette for an unknown id", () => {
    expect(themeTokens(P, "nope", "dark")?.bg).toBe("#000");
  });
  it("returns null without config", () => {
    expect(themeTokens(null, "midnight", "dark")).toBeNull();
  });
});

describe("applyTheme", () => {
  it("no-ops without a document", () => {
    expect(() => applyTheme(P, "midnight", "dark")).not.toThrow();
  });
  it("stamps data attrs and writes token custom properties", () => {
    const el = new FakeEl();
    withFakeDoc(el, () => applyTheme(P, "midnight", "light"));
    expect(el.dataset.theme).toBe("light");
    expect(el.dataset.palette).toBe("midnight");
    expect(el.style.props.get("--bg")).toBe("#fff");
    expect(el.style.props.get("--accent")).toBe("#080");
  });
});

describe("bootTheme", () => {
  it("stamps the resolved scheme + palette without config", () => {
    const el = new FakeEl();
    withFakeDoc(el, () => bootTheme("dark", "ember"));
    expect(el.dataset.theme).toBe("dark");
    expect(el.dataset.palette).toBe("ember");
  });
});
