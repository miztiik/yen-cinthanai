// Native pointer drag - no library (stack-and-bundle.md). pointerdown ->
// setPointerCapture -> transform translate3d follow (compositor-only, never
// top/left) -> pointerup -> nearest-slot snap by hit-test. A short press is a tap:
// tap-token-then-tap-slot is the mobile-equal fallback (core-loop.md). transform +
// opacity only. Returns a Svelte action; the play store owns placement + selection.

export interface DragHandlers {
  onTap: () => void;
  onDrop: (entity: string, cat: string) => void;
}

const TAP_PX = 8; // below this travel a pointerup counts as a tap, not a drag

/** Resolve the slot under a point to its (entity, cat) via data attributes. */
function slotAt(x: number, y: number): { entity: string; cat: string } | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-slot-entity]");
  if (!el) return null;
  const entity = el.dataset.slotEntity;
  const cat = el.dataset.slotCat;
  return entity && cat ? { entity, cat } : null;
}

/** Svelte action: make a token draggable + tappable. */
export function draggable(node: HTMLElement, h: DragHandlers) {
  let handlers = h;
  let sx = 0;
  let sy = 0;
  let moved = false;

  function move(e: PointerEvent) {
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > TAP_PX) moved = true;
    node.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
  }

  function up(e: PointerEvent) {
    node.releasePointerCapture(e.pointerId);
    node.removeEventListener("pointermove", move);
    node.removeEventListener("pointerup", up);
    node.style.transform = "";
    node.style.willChange = "";
    node.classList.remove("z-50", "opacity-90");
    if (!moved) handlers.onTap();
    else {
      const hit = slotAt(e.clientX, e.clientY);
      if (hit) handlers.onDrop(hit.entity, hit.cat);
    }
  }

  function down(e: PointerEvent) {
    sx = e.clientX;
    sy = e.clientY;
    moved = false;
    node.setPointerCapture(e.pointerId);
    node.style.willChange = "transform";
    node.classList.add("z-50", "opacity-90");
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
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
