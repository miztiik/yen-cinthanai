// Tiny Web Audio SFX. Synth-only - zero asset bytes (CLAUDE.md bundle rule); four
// cues: place, satisfy, violate, win. Mute by default; plays only when settings.sound
// is on and volume > 0 (config defaults sound=false). Lazy AudioContext (autoplay
// policy: first sound rides a tap/toggle gesture). No-op when Web Audio is absent
// (node tests, old browsers). See docs/concepts/ui-shell.md, difficulty-and-scoring.md.

export type Sfx = "place" | "satisfy" | "violate" | "win";

// Each cue: ordered [freqHz, durSec] beeps; the win arpeggio is celebratory.
const VOICES: Record<Sfx, [number, number][]> = {
  place: [[520, 0.05]],
  satisfy: [[660, 0.07], [990, 0.09]],
  violate: [[160, 0.16]],
  win: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.18]],
};

let ctx: AudioContext | null = null;
let enabled = false;
let level = 0; // 0..1 master gain

/** Apply settings (sound on/off + volume) every load/toggle. */
export function configureAudio(sound: boolean, volume: number): void {
  enabled = sound;
  level = Math.max(0, Math.min(1, volume));
}

function context(): AudioContext | null {
  const AC = globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/** Play one cue. Silent unless enabled with volume > 0; tones synth on the fly. */
export function play(name: Sfx): void {
  if (!enabled || level <= 0) return;
  const ac = context();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
  let t = ac.currentTime;
  for (const [freq, dur] of VOICES[name]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = name === "violate" ? "sawtooth" : "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25 * level, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur);
    t += dur;
  }
}
