// Native pointer drag - no library (stack-and-bundle.md). pointerdown ->
// setPointerCapture -> transform translate3d follow (compositor-only, never top/left) ->
// a MAGNET eases the puck toward the nearest valid target centre once it comes within
// capture range (config/ui.json [snap]) and highlights that target -> pointerup drops on
// the captured (or hit-tested) target; a pointercancel (OS reclaims the pointer) aborts
// the drag cleanly. A short press is a tap: tap-token-then-tap-slot is the mobile-equal
// fallback (core-loop.md). The glyph <img> is non-draggable (Glyph.svelte + app.css) so
// the browser's native image-drag never hijacks this pointer-drag. transform + opacity
// only. Two target kinds share the same magnet math: SLOT centres ([data-slot-*], the
// token board) and CELL centres ([data-cell-*], the cross-out grid); for the grid the
// candidate cell centres are SNAPSHOT at pointerdown, scoped to the active block, so the
// magnet never re-queries mid-drag (Row 7, Decision 6). Pointer Events only, no
// non-passive touchmove. The play store owns placement + selection; the magnet's
// radius/ease come from config, nothing hardcoded.

export interface DragHandlers {
  cat?: string; // token category; the slot magnet only attracts to slots of this category
  cellBlock?: string; // active grid block id; when set the magnet targets that block's cells
  onTap: () => void;
  onDrop?: (entity: string, cat: string) => void; // slot mode drop
  onDropCell?: (key: string) => void; // grid-cell mode drop (order-normalized cell key)
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

/** A grid-cell candidate centre (the cross-out grid's magnet target). */
export interface CellCentre {
  key: string;
  block: string;
  cx: number;
  cy: number;
  el: HTMLElement;
}

type Centre = SlotCentre | CellCentre;
function isCell(c: Centre): c is CellCentre {
  return "key" in c;
}

/** Nearest centre within `radius` of (x,y); null if none. Pure + generic - the magnet's
 *  core, shared by slot centres and cell centres. */
export function nearestCentre<T extends { cx: number; cy: number }>(
  x: number,
  y: number,
  centres: T[],
  radius: number,
): T | null {
  let best: T | null = null;
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

/** Resolve the grid cell under a point to its normalized key via data attributes. */
function cellAt(x: number, y: number): { key: string } | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cell-key]");
  const key = el?.dataset.cellKey;
  return key ? { key } : null;
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

/** Centres of every cell in one grid block (snapshot at pointerdown - Decision 6). */
function cellCentres(block: string): CellCentre[] {
  const out: CellCentre[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(`[data-cell-block="${block}"]`)) {
    const key = el.dataset.cellKey;
    if (!key) continue;
    const r = el.getBoundingClientRect();
    out.push({ key, block, cx: r.left + r.width / 2, cy: r.top + r.height / 2, el });
  }
  return out;
}

/** Svelte action: make a token draggable + tappable, with a config-driven magnet toward
 *  either slot centres (token board) or the active block's cell centres (cross-out grid). */
export function draggable(node: HTMLElement, h: DragHandlers) {
  let handlers = h;
  let sx = 0;
  let sy = 0; // pointer-down position
  let cx0 = 0;
  let cy0 = 0; // node centre at pointer-down
  let moved = false;
  let captured: Centre | null = null;
  let cellSnapshot: CellCentre[] = []; // scoped to the active block, taken at pointerdown

  function highlight(next: Centre | null) {
    if (captured?.el === next?.el) return;
    captured?.el.classList.remove(SNAP_CLASS);
    next?.el.classList.add(SNAP_CLASS);
    captured = next;
  }

  function move(e: PointerEvent) {
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > TAP_PX) moved = true;
    let target: Centre | null = null;
    if (handlers.snap) {
      if (handlers.cellBlock) target = nearestCentre(cx0 + dx, cy0 + dy, cellSnapshot, handlers.snap.radius);
      else if (handlers.cat)
        target = nearestCentre(cx0 + dx, cy0 + dy, slotCentres(handlers.cat), handlers.snap.radius);
    }
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
    const cap = captured; // read the captured target BEFORE end() clears the highlight
    const dragged = moved;
    end(e.pointerId); // clears the transform BEFORE the hit-test reads the element underneath
    if (!dragged) {
      handlers.onTap();
      return;
    }
    if (handlers.cellBlock) {
      const hit = cap && isCell(cap) ? { key: cap.key } : cellAt(e.clientX, e.clientY);
      if (hit) handlers.onDropCell?.(hit.key);
    } else {
      const hit = cap && !isCell(cap) ? { entity: cap.entity, cat: cap.cat } : slotAt(e.clientX, e.clientY);
      if (hit) handlers.onDrop?.(hit.entity, hit.cat);
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
    cellSnapshot = handlers.cellBlock ? cellCentres(handlers.cellBlock) : [];
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
