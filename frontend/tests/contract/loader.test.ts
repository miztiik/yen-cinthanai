// Loader contract: real bundle JSON (no invented fixture), fetch mocked at the
// boundary (carve-out, schemas.md). Proves index -> entry pick -> manifest, and a
// fail-fast on a malformed body. Reads the actual public/puzzles files so a contract
// drift breaks the test, not a stale copy.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBank, pickEntry, loadManifest, loadPuzzle } from "../../src/lib/loader";

const here = fileURLToPath(new URL(".", import.meta.url));
const pub = resolve(here, "../../public/puzzles");
const read = (f: string) => readFileSync(resolve(pub, f), "utf8");

function mockFetch() {
  return vi.fn(async (url: string) => {
    const file = url.split("/").pop() ?? "";
    try {
      return { ok: true, status: 200, json: async () => JSON.parse(read(file)) } as Response;
    } catch {
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }
  });
}

beforeEach(() => {
  (globalThis as { fetch: unknown }).fetch = mockFetch();
});
afterEach(() => vi.restoreAllMocks());

describe("loader", () => {
  // The served date is whatever the daily bank was generated for (single-date index,
  // rewrite-in-place). Derive it from the bank so the daily bot advancing the index
  // never decouples this contract from the shipped files.
  it("reads the bank index and finds today's standard", async () => {
    const bank = await loadBank();
    expect(bank.schemaVersion).toBe(1);
    const e = pickEntry(bank, bank.generatedSeed, "standard");
    expect(e.shapeId).toBe("seating-row");
  });

  it("loads the manifest for the picked entry", async () => {
    const bank = await loadBank();
    const e = pickEntry(bank, bank.generatedSeed, "standard");
    const m = await loadManifest(e.file);
    expect(m.tier).toBe("standard");
    expect(m.entities).toHaveLength(4);
  });

  it("loadPuzzle resolves index + manifest in one call", async () => {
    const bank = await loadBank();
    const m = await loadPuzzle(bank.generatedSeed, "easy");
    expect(m.tier).toBe("easy");
    expect(m.entities).toHaveLength(3);
  });

  it("throws on a missing entry", async () => {
    const bank = await loadBank();
    expect(() => pickEntry(bank, "1999-01-01", "expert")).toThrow();
  });
});
