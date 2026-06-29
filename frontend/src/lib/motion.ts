// Reduced-motion switch. The board's feedback is transform/opacity only; reduced
// motion flips a root data flag that app.css turns into "transition: none" so anims
// drop to opacity-only/instant. Pure class fn is unit-tested; applyMotion touches the
// DOM behind a guard (node tests have no document). See docs/concepts/ui-shell.md.

export type Motion = "full" | "reduce";

/** Map the reduced-motion setting to the root data-motion value. */
export function motionClass(reduced: boolean): Motion {
  return reduced ? "reduce" : "full";
}

/** Stamp data-motion on <html>; no-op without a document (tests). */
export function applyMotion(reduced: boolean): void {
  const el = globalThis.document?.documentElement;
  if (el) el.dataset.motion = motionClass(reduced);
}
