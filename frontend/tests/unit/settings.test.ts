// Unit: settings persist across loads, and default to mute. Fake localStorage at the
// browser boundary (carve-out, not a logic mock). Covers freshSave default sound off,
// updateSettings round-trip, and merge keeping unrelated fields. schemas.md sec 5.3.

import { describe, it, expect, beforeEach } from "vitest";
import { loadSave, updateSettings, freshSave } from "../../src/state/save.svelte";

class FakeStorage {
  store = new Map<string, string>();
  getItem(k: string) { return this.store.get(k) ?? null; }
  setItem(k: string, v: string) { this.store.set(k, v); }
  removeItem(k: string) { this.store.delete(k); }
}
beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = new FakeStorage() as unknown as Storage;
});

describe("settings", () => {
  it("default to mute (sound off, volume 0)", () => {
    const s = freshSave().settings;
    expect(s.sound).toBe(false);
    expect(s.volume).toBe(0);
  });
  it("default theme follows system, palette is midnight", () => {
    const s = freshSave().settings;
    expect(s.theme).toBe("system");
    expect(s.palette).toBe("midnight");
  });
  it("persist and reload", () => {
    updateSettings({ sound: true, volume: 0.6, reducedMotion: true }, "2026-06-29");
    const s = loadSave().settings;
    expect(s.sound).toBe(true);
    expect(s.volume).toBe(0.6);
    expect(s.reducedMotion).toBe(true);
  });
  it("theme + palette persist and merge keeps unrelated fields", () => {
    updateSettings({ theme: "dark" }, "2026-06-29");
    updateSettings({ palette: "ember" }, "2026-06-29");
    const s = loadSave().settings;
    expect(s.theme).toBe("dark");
    expect(s.palette).toBe("ember");
  });
});
