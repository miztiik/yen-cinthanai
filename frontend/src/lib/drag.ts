// Native pointer drag - no library (stack-and-bundle.md). pointerdown ->
// setPointerCapture -> transform translate3d follow (compositor-only, never top/left) ->
// a MAGNET eases the puck toward the nearest valid slot centre once it comes within
// capture range (config/ui.toml [snap]) and highlights that slot -> pointerup drops on
// the captured (or hit-tested) slot; a pointercancel (OS reclaims the pointer) aborts the
// drag cleanly. A short press is a tap: tap-token-then-tap-slot is the mobile-equal
// fallback (core-loop.md). The glyph <img> is non-draggable (Glyph.svelte + app.css) so
// the browser's native image-drag never hijacks this pointer-drag. transform + opacity
// only. The play store owns placement + selection; the magnet's radius/ease come from
// config, nothing hardcoded.

export interface DragHandlers {
  cat?: string; // the token's category; the magnet only attracts to slots of this category
  onTap: () => void;
  onDrop: (entity: string, cat: string) => void;
  snap?: { radius: number; ease: number }; // capture distance (px) + ease 0..1, config-driven
}

const TAP_PX = 8; // below this travel a pointerup counts as a tap, not a drag
const SNAP_CLASS = "snap-target"; // ring on the captured slot (app.css)

export interface SlotCentre {
  entity: string;
  cat: string;
  cx: number;
  cy: number;
  el: HTMLElement;
}

/** Nearest centre within `radius` of (x,y); null if none. Pure - the magnet's core. */
export function nearestCentre(x: number, y: number, centres: SlotCentre[], radius: number): SlotCentre | null {
  let best: SlotCentre | null = null;
  let bestD = radius;
  for (const c of centres) {
    const d = Math.hypot(c.cx - x, c.cy - y);
    if (d <= bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

/** Drag translate that eases the node centre `ease` (0..1) toward a captured target. Pure. */
export function magnetTranslate(
  dx: number,
  dy: number,
  startCx: number,
  startCy: number,
  target: { cx: number; cy: number } | null,
  ease: number,
): { tx: number; ty: number } {
  if (!target) return { tx: dx, ty: dy };
  const cx = startCx + dx;
  const cy = startCy + dy;
  return { tx: dx + ease * (target.cx - cx), ty: dy + ease * (target.cy - cy) };
}

/** Resolve the slot directly under a point to its (entity, cat) via data attributes. */
function slotAt(x: number, y: number): { entity: string; cat: string } | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-slot-entity]");
  const entity = el?.dataset.slotEntity;
  const cat = el?.dataset.slotCat;
  return entity && cat ? { entity, cat } : null;
}

/** Live centres of every slot for a category (the targets the magnet may capture). */
function slotCentres(cat: string): SlotCentre[] {
  const out: SlotCentre[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(`[data-slot-cat="${cat}"]`)) {
    const entity = el.dataset.slotEntity;
    const c = el.dataset.slotCat;
    if (!entity || !c) continue;
    const r = el.getBoundingClientRect();
    out.push({ entity, cat: c, cx: r.left + r.width / 2, cy: r.top + r.height / 2, el });
  }
  return out;
}

/** Svelte action: make a token draggable + tappable, with a config-driven slot magnet. */
export function draggable(node: HTMLElement, h: DragHandlers) {
  let handlers = h;
  let sx = 0;
  let sy = 0; // pointer-down position
  let cx0 = 0;
  let cy0 = 0; // node centre at pointer-down
  let moved = false;
  let captured: SlotCentre | null = null;

  function highlight(next: SlotCentre | null) {
    if (captured?.el === next?.el) return;
    captured?.el.classList.remove(SNAP_CLASS);
    next?.el.classList.add(SNAP_CLASS);
    captured = next;
  }

  function move(e: PointerEvent) {
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > TAP_PX) moved = true;
    const target =
      handlers.snap && handlers.cat
        ? nearestCentre(cx0 + dx, cy0 + dy, slotCentres(handlers.cat), handlers.snap.radius)
        : null;
    highlight(target);
    const { tx, ty } = magnetTranslate(dx, dy, cx0, cy0, target, handlers.snap?.ease ?? 0);
    node.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
  }

  // Tear down one drag: release capture, drop the per-drag listeners, clear the follow
  // transform + lifted chrome, and unhighlight. Shared by a normal release (up) and an
  // aborted gesture (cancel) so a pointer the OS reclaims never leaves the puck stuck
  // mid-drag with leaked listeners (the touch "stops responding" bug).
  function end(pointerId: number) {
    try {
      node.releasePointerCapture(pointerId);
    } catch {
      // The browser already released/cancelled this pointer - nothing to free.
    }
    node.removeEventListener("pointermove", move);
    node.removeEventListener("pointerup", up);
    node.removeEventListener("pointercancel", cancel);
    node.style.transform = "";
    node.style.willChange = "";
    node.classList.remove("z-50", "opacity-90");
    highlight(null);
  }

  function up(e: PointerEvent) {
    const snapped = captured ? { entity: captured.entity, cat: captured.cat } : null;
    const dragged = moved;
    end(e.pointerId); // clears the transform BEFORE slotAt hit-tests the slot underneath
    if (!dragged) handlers.onTap();
    else {
      const drop = snapped ?? slotAt(e.clientX, e.clientY);
      if (drop) handlers.onDrop(drop.entity, drop.cat);
    }
  }

  // The browser cancelled the pointer (scroll/zoom takeover, palm-reject, focus loss):
  // abandon the gesture - no tap, no drop - so the next press starts from a clean state.
  function cancel(e: PointerEvent) {
    end(e.pointerId);
  }

  function down(e: PointerEvent) {
    sx = e.clientX;
    sy = e.clientY;
    const r = node.getBoundingClientRect();
    cx0 = r.left + r.width / 2;
    cy0 = r.top + r.height / 2;
    moved = false;
    node.setPointerCapture(e.pointerId);
    node.style.willChange = "transform";
    node.classList.add("z-50", "opacity-90");
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", cancel);
  }

  node.addEventListener("pointerdown", down);
  return {
    update(next: DragHandlers) {
      handlers = next;
    },
    destroy() {
      node.removeEventListener("pointerdown", down);
    },
  };
}
