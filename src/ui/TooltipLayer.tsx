import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { placeTooltip, type Box } from "./tooltipPlacement";
import { tooltips, type Term } from "./tooltips";

interface ShownTooltip {
  term: Term;
  anchor: Element;
  /** What this particular one is, after what the term means, such as one Asset's Benefit. */
  detail: string | null;
}

function termElementFrom(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest("[data-term]") : null;
}

/** The controls on screen a tooltip shouldn't cover, leaving out any the term sits inside. */
function controlsAround(anchor: Element): Box[] {
  return [
    ...document.querySelectorAll("button, select, input, textarea, a[href]"),
  ]
    .filter((control) => !control.contains(anchor))
    .map((control) => control.getBoundingClientRect())
    .filter(({ width, height }) => width > 0 && height > 0);
}

/** Shows the tooltip for whichever game term is under the pointer or has keyboard focus. */
export function TooltipLayer() {
  const [shown, setShown] = useState<ShownTooltip | null>(null);

  useEffect(() => {
    const show = (event: Event) => {
      const anchor = termElementFrom(event.target);
      const term = anchor?.getAttribute("data-term") as Term | undefined;
      setShown(
        anchor && term
          ? { term, anchor, detail: anchor.getAttribute("data-detail") }
          : null,
      );
    };
    const hide = () => {
      setShown(null);
    };
    document.addEventListener("mouseover", show);
    document.addEventListener("focusin", show);
    document.addEventListener("focusout", hide);
    return () => {
      document.removeEventListener("mouseover", show);
      document.removeEventListener("focusin", show);
      document.removeEventListener("focusout", hide);
    };
  }, []);

  // Mission Mode can end its Turn under the pointer, taking the term with it.
  useEffect(() => {
    if (!shown) return;
    const check = setInterval(() => {
      if (!shown.anchor.isConnected) setShown(null);
    }, 250);
    return () => {
      clearInterval(check);
    };
  }, [shown]);

  const tooltip = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number }>();

  // Measured once it's drawn, then moved clear of the controls around its term before the player sees it.
  useLayoutEffect(() => {
    const element = tooltip.current;
    if (!shown || !element) return;
    // Raises the tooltip above an open dialog, which otherwise covers everything else on the page.
    if (!element.matches(":popover-open")) element.showPopover();
    const { width, height } = element.getBoundingClientRect();
    setPosition(
      placeTooltip({
        anchor: shown.anchor.getBoundingClientRect(),
        size: { width, height },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        controls: controlsAround(shown.anchor),
      }),
    );
  }, [shown]);

  if (!shown) return null;

  return (
    <div
      ref={tooltip}
      popover="manual"
      role="tooltip"
      className="tooltip"
      style={
        position
          ? { left: position.left, top: position.top }
          : { left: 0, top: 0, visibility: "hidden" }
      }
    >
      <strong>{shown.term}</strong>
      <p>{tooltips[shown.term]}</p>
      {shown.detail && <p data-testid="tooltip-detail">{shown.detail}</p>}
    </div>
  );
}
