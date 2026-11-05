/**
 * What counts as one panel for underlining: each game term is underlined the first time it appears in one of these,
 * and later appearances keep their tooltip without the underline.
 */
const scopes =
  ".panel, dialog, .summary-screen, .status-bar, .mission-bar, .mission-side, .events-column, .decision-point";

/** Marks with data-repeat each game term that already appeared, outside a heading, earlier in the same panel. */
export function markRepeatedTerms(root: ParentNode): void {
  const seen = new Map<Element | null, Set<string>>();
  for (const term of root.querySelectorAll(".term[data-term]")) {
    // Headings carry no underlines, so they don't use up a term's one underline either.
    if (term.closest("h1, h2, h3, h4")) {
      term.removeAttribute("data-repeat");
      continue;
    }
    const scope = term.closest(scopes);
    const name = term.getAttribute("data-term") ?? "";
    const inScope = seen.get(scope) ?? new Set<string>();
    seen.set(scope, inScope);
    if (inScope.has(name)) term.setAttribute("data-repeat", "");
    else {
      term.removeAttribute("data-repeat");
      inScope.add(name);
    }
  }
}

/** Keeps the marks up to date as the screen changes, before each change is drawn. Returns a function that stops it. */
export function watchRepeatedTerms(): () => void {
  let frame = 0;
  const update = () => {
    frame = 0;
    markRepeatedTerms(document);
  };
  // Marking only changes attributes, which this doesn't watch, so it can't set itself off.
  const observer = new MutationObserver(() => {
    frame ||= requestAnimationFrame(update);
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  update();
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}
