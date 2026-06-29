// Contract: app.css declares the eight colour tokens and maps each into Tailwind via
// @theme inline, so the chrome's token utilities (bg-surface, text-ink, border-accent,
// ...) compile to live CSS custom properties that lib/theme can swap at runtime. Guards
// the token <-> @theme seam and the token-driven base background/ink. See ui-shell.md.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const css = readFileSync(resolve(here, "../../src/app.css"), "utf8");

const TOKENS = ["bg", "surface", "ink", "accent", "satisfy", "violate", "near", "gold"];

describe("app.css tokens", () => {
  it("defines every token as a custom property", () => {
    for (const t of TOKENS) expect(css, t).toMatch(new RegExp(`--${t}:`));
  });

  it("maps every token into Tailwind via @theme inline", () => {
    expect(css).toMatch(/@theme inline/);
    for (const t of TOKENS) {
      expect(css, t).toMatch(new RegExp(`--color-${t}:\\s*var\\(--${t}\\)`));
    }
  });

  it("drives the base background and ink from tokens", () => {
    expect(css).toMatch(/background-color:\s*var\(--bg\)/);
    expect(css).toMatch(/color:\s*var\(--ink\)/);
  });

  it("ships a light-scheme bootstrap fallback", () => {
    expect(css).toMatch(/\[data-theme="light"\]/);
  });
});
