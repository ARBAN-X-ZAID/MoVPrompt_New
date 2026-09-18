// Shared tuned constants and helpers for touch drag interactions.

export const LONG_PRESS_MS = 180;
export const MOVE_CANCEL_PX = 10;
export const SNAP_DISTANCE_PX = 24;
export const HAPTIC_MS = 12;

export const triggerHaptic = (ms = HAPTIC_MS) => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      // ignore
    }
  }
};

/**
 * Find the nearest drop target at the given client point matching `selector`
 * (typically a data-attribute selector like `[data-element-tile-id]`).
 * Returns the element, the value of `idAttr` (defaults to the selector's attribute
 * name), and whether the touch point is within SNAP_DISTANCE_PX of the element's
 * center.
 */
export function findDropTargetFromPoint(
  x: number,
  y: number,
  selector: string,
  idAttr?: string,
): { element: HTMLElement; id: string | null; snapped: boolean } | null {
  if (typeof document === "undefined") return null;
  const attrName = idAttr ?? selector.replace(/^\[|\]$/g, "");
  const stack = document.elementsFromPoint(x, y);
  for (const node of stack) {
    const el = (node as HTMLElement).closest?.(selector) as HTMLElement | null;
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(x - cx, y - cy);
    return {
      element: el,
      id: el.getAttribute(attrName),
      snapped: dist <= SNAP_DISTANCE_PX,
    };
  }
  return null;
}
