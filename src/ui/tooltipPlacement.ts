/** A rectangle on screen, in pixels from the window's top left, as getBoundingClientRect gives it. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface Placement {
  /** The game term the tooltip explains. */
  anchor: Box;
  size: { width: number; height: number };
  viewport: { width: number; height: number };
  /** The buttons, selects and other controls on screen, which the tooltip shouldn't cover. */
  controls: Box[];
}

/** The space between a tooltip and its term. */
const gap = 12;
/** The least space between a tooltip and the window's edge. */
const margin = 8;

function overlaps(a: Box, b: Box): boolean {
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  );
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(value, high));
}

/**
 * Where a tooltip goes: below its term if it can, otherwise beside it or above it, sliding along that side to clear
 * any control it would cover, and always inside the window. Where nothing clears every control, it opens below or
 * above the term, whichever has room, inside the window.
 */
export function placeTooltip({ anchor, size, viewport, controls }: Placement): {
  left: number;
  top: number;
} {
  const maxLeft = viewport.width - margin - size.width;
  const maxTop = viewport.height - margin - size.height;
  const boxAt = (left: number, top: number): Box => ({
    left,
    top,
    right: left + size.width,
    bottom: top + size.height,
  });
  const onScreen = (each: Box) =>
    each.left >= margin &&
    each.top >= margin &&
    each.right <= viewport.width - margin &&
    each.bottom <= viewport.height - margin;
  const clear = (each: Box) =>
    onScreen(each) &&
    !overlaps(each, anchor) &&
    !controls.some((control) => overlaps(each, control));

  /** Slides a tooltip on a row along to the right, past each control in its way, until it is clear or runs out of room. */
  const slideAlong = (top: number, startLeft: number): Box | null => {
    let left = clamp(startLeft, margin, maxLeft);
    for (let tries = 0; tries <= controls.length; tries++) {
      const candidate = boxAt(left, top);
      if (clear(candidate)) return candidate;
      const blocking = controls.filter((control) =>
        overlaps(candidate, control),
      );
      if (blocking.length === 0 || !onScreen(candidate)) return null;
      left = Math.max(...blocking.map(({ right }) => right)) + gap;
      if (left > maxLeft) return null;
    }
    return null;
  };

  const below = anchor.bottom + gap;
  const above = anchor.top - gap - size.height;
  const besideTop = clamp(anchor.top, margin, maxTop);
  const candidates = [
    () => slideAlong(below, anchor.left),
    () => slideAlong(besideTop, anchor.right + gap),
    () => slideAlong(above, anchor.left),
    () => {
      const left = anchor.left - gap - size.width;
      const candidate = boxAt(left, besideTop);
      return clear(candidate) ? candidate : null;
    },
  ];
  for (const candidate of candidates) {
    const found = candidate();
    if (found) return { left: found.left, top: found.top };
  }
  const roomBelow = below + size.height <= viewport.height - margin;
  return {
    left: clamp(anchor.left, margin, maxLeft),
    top: clamp(roomBelow ? below : above, margin, maxTop),
  };
}
