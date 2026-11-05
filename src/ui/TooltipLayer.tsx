import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { watchRepeatedTerms } from "./repeatedTerms";
import { placeTooltip, type Box } from "./tooltipPlacement";
import { tooltips, type Term } from "./tooltips";

interface ShownTooltip {
  /** One term, or every term a heading's ⓘ marker explains. */
  terms: Term[];
  anchor: Element;
  /** What this particular one is, after what the term means, such as one Asset's Benefit. */
  detail: string | null;
}

function termElementFrom(target: EventTarget | null): Element | null {
  return target instanceof Element
    ? target.closest("[data-term], [data-terms]")
    : null;
}

/**
 * The controls on screen a tooltip shouldn't cover, leaving out any the term sits inside, and while a dialog is open,
 * any behind it, which the player can't see.
 */
function controlsAround(anchor: Element): Box[] {
  const within = document.querySelector("dialog[open]") ?? document;
  return [
    ...within.querySelectorAll("button, select, input, textarea, a[href]"),
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
      const terms = (
        anchor?.getAttribute("data-term") ??
        anchor?.getAttribute("data-terms") ??
        ""
      )
        .split("|")
        .filter(Boolean) as Term[];
      // The same term keeps its tooltip where it is, rather than being placed again.
      setShown((current) =>
        anchor && terms.length > 0
          ? current?.anchor === anchor
            ? current
            : { terms, anchor, detail: anchor.getAttribute("data-detail") }
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

  useEffect(watchRepeatedTerms, []);

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
  /** Where the tooltip goes, and which one it was worked out for, so that a new one is first measured unplaced. */
  const [position, setPosition] = useState<{
    of: ShownTooltip;
    left: number;
    top: number;
  }>();

  // Measured once it's drawn, then moved clear of the controls around its term before the player sees it.
  useLayoutEffect(() => {
    const element = tooltip.current;
    if (!shown || !element) return;
    // Raises the tooltip above an open dialog, which otherwise covers everything else on the page.
    if (!element.matches(":popover-open")) element.showPopover();
    const { width, height } = element.getBoundingClientRect();
    setPosition({
      of: shown,
      ...placeTooltip({
        anchor: shown.anchor.getBoundingClientRect(),
        size: { width, height },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        controls: controlsAround(shown.anchor),
      }),
    });
  }, [shown]);

  if (!shown) return null;

  return (
    <div
      ref={tooltip}
      popover="manual"
      role="tooltip"
      className="tooltip"
      style={
        position?.of === shown
          ? { left: position.left, top: position.top }
          : { left: 0, top: 0, visibility: "hidden" }
      }
    >
      {shown.terms.map((term) => (
        <div key={term}>
          <strong>{term}</strong>
          <p>{tooltips[term]}</p>
        </div>
      ))}
      {shown.detail && <p data-testid="tooltip-detail">{shown.detail}</p>}
    </div>
  );
}
