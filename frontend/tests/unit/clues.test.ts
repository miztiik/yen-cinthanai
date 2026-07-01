// Unit: the story-first clue-list logic (lib/clues.ts). Pure functions, no DOM - proves
// the numbered full-sentence rows, the config-driven auto-dim gate (soft dials only), and
// the combined strike/dim rule. Reads the story-first fixture derived from the datasets
// golden. See docs/concepts/core-loop.md and difficulty-and-scoring.md.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PuzzleManifest } from "../../src/contracts/manifest";
import type { Feedback } from "../../src/lib/config";
import { clueRows, autoDimAllowed, isClueStruck } from "../../src/lib/clues";

const here = fileURLToPath(new URL(".", import.meta.url));
const m = JSON.parse(
  readFileSync(resolve(here, "../fixtures/story-first-standard.json"), "utf8"),
) as PuzzleManifest;

// The soft dials (easy + standard) come from config; the harder dials must never auto-dim.
const SOFT: Feedback[] = ["realtime-names", "count-wrong"];

describe("clueRows", () => {
  it("numbers every clue 1-based in manifest order with its full sentence", () => {
    const rows = clueRows(m.constraints);
    expect(rows).toHaveLength(m.constraints.length);
    rows.forEach((r, i) => {
      expect(r.n).toBe(i + 1);
      expect(r.id).toBe(m.constraints[i].id);
      expect(r.text).toBe(m.constraints[i].clueText);
    });
  });

  it("carries the full-sentence clue text, not a glyph token", () => {
    const rows = clueRows(m.constraints);
    // Every row reads as a sentence (ends with a period, has spaces) - text, never a chip.
    for (const r of rows) {
      expect(r.text.length).toBeGreaterThan(10);
      expect(r.text).toMatch(/\s/);
      expect(r.text.trim().endsWith(".")).toBe(true);
    }
  });
});

describe("autoDimAllowed (gated by the feedback dial)", () => {
  it("permits auto-dim for the soft dials (easy realtime-names, standard count-wrong)", () => {
    expect(autoDimAllowed("realtime-names", SOFT)).toBe(true);
    expect(autoDimAllowed("count-wrong", SOFT)).toBe(true);
  });

  it("forbids auto-dim for the harder dials (sharp binary-check, expert submit-binary)", () => {
    expect(autoDimAllowed("binary-check", SOFT)).toBe(false);
    expect(autoDimAllowed("submit-binary", SOFT)).toBe(false);
  });

  it("is driven by the passed list, not a hardcoded tier name", () => {
    expect(autoDimAllowed("binary-check", ["binary-check"])).toBe(true);
    expect(autoDimAllowed("realtime-names", [])).toBe(false);
  });
});

describe("isClueStruck (manual OR gated auto-dim)", () => {
  it("is struck whenever the player struck it, regardless of state or dial", () => {
    expect(isClueStruck(true, false, "unknown")).toBe(true);
    expect(isClueStruck(true, false, "violate")).toBe(true);
  });

  it("auto-dims a satisfied clue only when the dial permits", () => {
    expect(isClueStruck(false, true, "satisfy")).toBe(true); // soft dial + satisfied
    expect(isClueStruck(false, false, "satisfy")).toBe(false); // hard dial: no auto-dim (no leak)
  });

  it("never dims an unsatisfied clue on its own", () => {
    expect(isClueStruck(false, true, "violate")).toBe(false);
    expect(isClueStruck(false, true, "unknown")).toBe(false);
  });
});
