// Contract + unit: Save read path. Real fixtures; a fake localStorage stands in for
// the browser boundary (carve-out: untestable external surface, not a logic mock).
// Covers parse, fresh-on-throw, v0->v1 migrate, validate (drop bad day keep
// hero/streak), and QuotaExceededError prune (oldest first, today never).

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSave, persistSave, validateSave, freshSave } from "../../src/state/save.svelte";
import type { Save } from "../../src/contracts/save";

const here = fileURLToPath(new URL(".", import.meta.url));
const read = (f: string) => readFileSync(resolve(here, `../fixtures/${f}`), "utf8");
const KEY = "yen-cinthanai/save";

class FakeStorage {
  store = new Map<string, string>();
  quotaUnder = 0; // setItem throws quota while serialized length exceeds this
  getItem(k: string) {
    return this.store.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.quotaUnder && v.length > this.quotaUnder)
      throw new DOMException("full", "QuotaExceededError");
    this.store.set(k, v);
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
}

let fake: FakeStorage;
beforeEach(() => {
  fake = new FakeStorage();
  (globalThis as { localStorage?: Storage }).localStorage = fake as unknown as Storage;
});

describe("loadSave", () => {
  it("returns fresh when empty", () => {
    expect(loadSave()).toEqual(freshSave());
  });

  it("returns fresh on corrupt JSON", () => {
    fake.store.set(KEY, "{not json");
    expect(loadSave()).toEqual(freshSave());
  });

  it("loads a valid v1 save with both days and hero/streak", () => {
    fake.store.set(KEY, read("save-v1.json"));
    const s = loadSave();
    expect(Object.keys(s.days).sort()).toEqual(["2026-06-27", "2026-06-28"]);
    expect(s.hero.bestMs).toBe(41000);
    expect(s.streak.count).toBe(2);
  });

  it("migrates a v0 (unversioned) save to v1 keeping the day", () => {
    fake.store.set(KEY, read("save-v0.json"));
    const s = loadSave();
    expect(s.schemaVersion).toBe(1);
    expect(s.days["2026-06-26"].stars).toBe(3);
  });

  it("defaults puckSize to medium for a save that predates the setting", () => {
    fake.store.set(KEY, read("save-v1.json")); // settings has no puckSize field
    expect(loadSave().settings.puckSize).toBe("medium");
  });
});

describe("validateSave", () => {
  it("drops a malformed day but keeps hero/streak", () => {
    const raw = JSON.parse(read("save-v1.json"));
    raw.days["bad"] = { date: "bad", tier: "nope" };
    const s = validateSave(raw);
    expect(s.days["bad"]).toBeUndefined();
    expect(Object.keys(s.days)).toHaveLength(2);
    expect(s.hero.bestMs).toBe(41000);
    expect(s.streak.count).toBe(2);
  });
});

describe("persistSave prune", () => {
  function withDays(n: number, today: string): Save {
    const s = freshSave();
    for (let i = 0; i < n; i++) {
      const d = `2026-06-${String(10 + i).padStart(2, "0")}`;
      s.days[d] = {
        date: d, tier: "easy", shapeId: "grid", status: "won",
        placements: {}, attempts: 0, solveMs: 1, hintsUsed: 0, stars: 1,
      };
    }
    s.days[today] = {
      date: today, tier: "easy", shapeId: "grid", status: "playing",
      placements: {}, attempts: 0, solveMs: 0, hintsUsed: 0, stars: 0,
    };
    return s;
  }

  it("prunes oldest first under quota, never prunes today", () => {
    const today = "2026-06-29";
    const s = withDays(4, today);
    fake.quotaUnder = JSON.stringify(s).length - 1; // forces pruning
    persistSave(s, today);
    expect(s.days[today]).toBeDefined();
    expect(s.days["2026-06-10"]).toBeUndefined(); // oldest gone
    expect(JSON.parse(fake.getItem(KEY)!).days[today]).toBeDefined();
  });
});
