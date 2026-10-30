import { useEffect, useState } from "react";
import { tooltips, type Term } from "./tooltips";

interface ShownTooltip {
  term: Term;
  anchor: Element;
}

function termElementFrom(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest("[data-term]") : null;
}

/** Raises the tooltip above an open dialog, which otherwise covers everything else on the page. */
function showInTopLayer(tooltip: HTMLDivElement | null) {
  tooltip?.showPopover();
}

/** Shows the tooltip for whichever game term is under the pointer or has keyboard focus. */
export function TooltipLayer() {
  const [shown, setShown] = useState<ShownTooltip | null>(null);

  useEffect(() => {
    const show = (event: Event) => {
      const anchor = termElementFrom(event.target);
      const term = anchor?.getAttribute("data-term") as Term | undefined;
      setShown(anchor && term ? { term, anchor } : null);
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

  // A text screen can close under the pointer, taking the term with it.
  useEffect(() => {
    if (!shown) return;
    const check = setInterval(() => {
      if (!shown.anchor.isConnected) setShown(null);
    }, 250);
    return () => {
      clearInterval(check);
    };
  }, [shown]);

  if (!shown) return null;

  const box = shown.anchor.getBoundingClientRect();
  const nearBottom = box.bottom > window.innerHeight * 0.7;
  return (
    <div
      ref={showInTopLayer}
      popover="manual"
      role="tooltip"
      className="tooltip"
      style={{
        left: Math.min(box.left, window.innerWidth * 0.72),
        ...(nearBottom
          ? { bottom: window.innerHeight - box.top + 12 }
          : { top: box.bottom + 12 }),
      }}
    >
      <strong>{shown.term}</strong>
      <p>{tooltips[shown.term]}</p>
    </div>
  );
}
