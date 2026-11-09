import { useEffect, useState, type RefObject } from "react";
import { Icon } from "../ui/Icon";

/** Whether the element has more below what it shows, kept up to date as it scrolls, resizes or its contents change. */
function useMoreBelow(scroller: RefObject<HTMLElement | null>): boolean {
  const [more, setMore] = useState(false);
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const update = () => {
      setMore(
        element.scrollTop + element.clientHeight < element.scrollHeight - 1,
      );
    };
    // The element's own size, and its children's, which set how far it can scroll. Observing fires once at the start.
    const resized = new ResizeObserver(update);
    resized.observe(element);
    for (const child of element.children) resized.observe(child);
    const changed = new MutationObserver(() => {
      for (const child of element.children) resized.observe(child);
      update();
    });
    changed.observe(element, { childList: true, subtree: true });
    element.addEventListener("scroll", update);
    return () => {
      resized.disconnect();
      changed.disconnect();
      element.removeEventListener("scroll", update);
    };
  }, [scroller]);
  return more;
}

/**
 * A fade over the bottom edge of something that scrolls, saying that more is below, shown only while it is. It is
 * always in the layout, so that its coming and going never changes how far its element can scroll. Where it goes is
 * down to its style: over the foot of the element, beside it, or stuck to the foot of a panel that scrolls itself.
 */
export function ScrollCue({
  scroller,
  children,
}: {
  /** The element that scrolls. */
  scroller: RefObject<HTMLElement | null>;
  /** What is below, such as "More steps below". */
  children: string;
}) {
  const more = useMoreBelow(scroller);
  return (
    <div
      className="scroll-cue"
      data-more={more || undefined}
      data-testid="more-below"
      aria-hidden="true"
    >
      <span>
        <Icon name="chevron-down" />
        {children}
      </span>
    </div>
  );
}
