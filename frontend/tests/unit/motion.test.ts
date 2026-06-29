// Unit: reduced-motion class + mute-default audio. motionClass is pure; audio.play is
// a no-op when sound is off, volume 0, or Web Audio is absent (node) - so a default
// install is silent and tests never touch hardware. ui-shell.md, difficulty-and-scoring.md.

import { describe, it, expect } from "vitest";
import { motionClass, applyMotion } from "../../src/lib/motion";
import { configureAudio, play } from "../../src/lib/audio";

describe("motion", () => {
  it("maps reduced flag to data-motion value", () => {
    expect(motionClass(false)).toBe("full");
    expect(motionClass(true)).toBe("reduce");
  });
  it("applyMotion no-ops without a document", () => {
    expect(() => applyMotion(true)).not.toThrow();
  });
});

describe("audio mute-default", () => {
  it("plays nothing when sound is off", () => {
    configureAudio(false, 0);
    expect(() => play("place")).not.toThrow();
  });
  it("plays nothing at volume 0 even if sound on", () => {
    configureAudio(true, 0);
    expect(() => play("win")).not.toThrow();
  });
  it("no-ops in node when enabled (no AudioContext)", () => {
    configureAudio(true, 1);
    expect(() => play("satisfy")).not.toThrow();
  });
});
