import { describe, expect, it } from "vitest";
import { placeTooltip, type Box } from "./tooltipPlacement";

const viewport = { width: 2000, height: 1000 };
const size = { width: 500, height: 150 };

function box(left: number, top: number, width: number, height: number): Box {
  return { left, top, right: left + width, bottom: top + height };
}

function overlaps(a: Box, b: Box): boolean {
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  );
}

function placed(anchor: Box, controls: Box[] = []): Box {
  const { left, top } = placeTooltip({ anchor, size, viewport, controls });
  return box(left, top, size.width, size.height);
}

describe("placeTooltip", () => {
  it("opens below the term when nothing is in the way", () => {
    const anchor = box(100, 100, 80, 20);
    expect(placed(anchor)).toEqual(box(100, 132, 500, 150));
  });

  it("slides along below the term to clear controls beneath it", () => {
    const anchor = box(40, 40, 160, 30);
    const buttons = [
      box(40, 90, 60, 30),
      box(110, 90, 60, 30),
      box(180, 90, 160, 30),
    ];
    const tooltip = placed(anchor, buttons);
    for (const button of buttons) expect(overlaps(tooltip, button)).toBe(false);
    expect(tooltip.top).toBe(82);
  });

  it("opens beside a term near the bottom of the window, inside it", () => {
    const anchor = box(100, 950, 80, 20);
    expect(placed(anchor)).toEqual(box(192, 842, 500, 150));
  });

  it("opens above a term near the bottom when there's no room beside it", () => {
    const anchor = box(100, 950, 80, 20);
    const beside = [box(180, 700, 1820, 300)];
    expect(placed(anchor, beside)).toEqual(box(100, 788, 500, 150));
  });

  it("stays inside the window near its right-hand edge", () => {
    const tooltip = placed(box(1950, 100, 40, 20));
    expect(tooltip.right).toBeLessThanOrEqual(viewport.width - 8);
    expect(tooltip.left).toBeGreaterThanOrEqual(8);
  });

  it("stays inside the window when nowhere avoids every control", () => {
    const anchor = box(900, 450, 80, 20);
    const everywhere = [box(0, 0, 2000, 440), box(0, 480, 2000, 520)];
    const tooltip = placed(anchor, everywhere);
    expect(tooltip.left).toBeGreaterThanOrEqual(8);
    expect(tooltip.top).toBeGreaterThanOrEqual(8);
    expect(tooltip.right).toBeLessThanOrEqual(viewport.width - 8);
    expect(tooltip.bottom).toBeLessThanOrEqual(viewport.height - 8);
  });

  it("never covers the term itself", () => {
    const anchor = box(900, 450, 80, 20);
    expect(overlaps(placed(anchor), anchor)).toBe(false);
  });
});
