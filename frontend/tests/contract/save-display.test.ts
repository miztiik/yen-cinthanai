// Contract: the additive settings.display (color/glyphs/labels). An older save without it
// still loads and is defaulted on read; schemaVersion stays 1; the glyphs/labels invariant
// is clamped on read. Real fixture + a fake localStorage (boundary carve-out, not a mock).

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSave, validateSave, freshSave, updateSettings } from "../../src/state/save.svelte";

const here = fileURLToPath(new URL(".", import.meta.url));
const read = (f: string) => readFileSync(resolve(here, `../fixtures/${f}`), "utf8");
const KEY = "yen-cinthanai/save";

class FakeStorage {
  store = new Map<string, string>();
  getItem(k: string) {
    return this.store.get(k) ?? null;
  }
  setItem(k: string, v: string) {
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

describe("settings.display (additive-optional)", () => {
  it("freshSave defaults display to all-on", () => {
    expect(freshSave().settings.display).toEqual({ color: true, glyphs: true, labels: true });
  });

  it("a save predating display loads with the default, schemaVersion stays 1", () => {
    fake.store.set(KEY, read("save-v1.json")); // settings has no display field
    const s = loadSave();
    expect(s.schemaVersion).toBe(1);
    expect(s.settings.display).toEqual({ color: true, glyphs: true, labels: true });
  });

  it("round-trips an explicit display through validateSave", () => {
    const raw = JSON.parse(read("save-v1.json"));
    raw.settings.display = { color: false, glyphs: true, labels: false };
    expect(validateSave(raw).settings.display).toEqual({ color: false, glyphs: true, labels: false });
  });

  it("clamps the invariant: both glyphs and labels off -> labels forced on", () => {
    const raw = JSON.parse(read("save-v1.json"));
    raw.settings.display = { color: true, glyphs: false, labels: false };
    expect(validateSave(raw).settings.display).toEqual({ color: true, glyphs: false, labels: true });
  });

  it("deep-merges a partial display over the defaults", () => {
    const raw = JSON.parse(read("save-v1.json"));
    raw.settings.display = { color: false }; // only one key present
    expect(validateSave(raw).settings.display).toEqual({ color: false, glyphs: true, labels: true });
  });

  it("updateSettings persists a display change", () => {
    updateSettings({ display: { color: false, glyphs: true, labels: true } }, "2026-07-05");
    expect(loadSave().settings.display).toEqual({ color: false, glyphs: true, labels: true });
  });
});
