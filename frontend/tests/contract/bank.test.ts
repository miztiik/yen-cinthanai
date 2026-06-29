// Contract: BankIndex reader vs fixture. sha is canonical-JSON sha256 (64 hex).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { BankIndex } from "../../src/contracts/bank";

const here = fileURLToPath(new URL(".", import.meta.url));
const bank = JSON.parse(
  readFileSync(resolve(here, "../fixtures/bank-index.json"), "utf8"),
) as BankIndex;

describe("BankIndex v1", () => {
  it("is version 1 with a seed and entries", () => {
    expect(bank.schemaVersion).toBe(1);
    expect(bank.generatedSeed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(bank.puzzles.length).toBeGreaterThan(0);
  });

  it("each entry names a date, tier, shape, file and sha", () => {
    for (const p of bank.puzzles) {
      expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(["easy", "standard", "sharp", "expert"]).toContain(p.tier);
      expect(["grid", "seating-row"]).toContain(p.shapeId);
      expect(p.file.endsWith(".json")).toBe(true);
      expect(p.sha).toMatch(/^[0-9a-f]{6,64}$/);
    }
  });
});
