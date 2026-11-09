/**
 * What counts as one panel for underlining: each game term is underlined the first time it appears in one of these,
 * and later appearances keep their tooltip without the underline.
 */
const scopes =
  ".panel, dialog, .summary-screen, .status-bar, .mission-bar, .mission-side, .events-column, .decision-point";

/**
 * What counts as one place for a heading's ⓘ marker: a step of the New Mission panel is its own, as each step's body
 * explains its own heading, and otherwise the panel the heading is in.
 */
const markerScopes = `.mission-step, ${scopes}`;

const headings = "h1, h2, h3, h4";

/** Marks with data-repeat each game term that already appeared, outside a heading, earlier in the same panel. */
function markRepeatedTerms(root: ParentNode): void {
  const seen = new Map<Element | null, Set<string>>();
  for (const term of root.querySelectorAll(".term[data-term]")) {
    // Headings carry no underlines, so they don't use up a term's one underline either.
    if (term.closest(headings)) {
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

/**
 * Marks with data-repeat each heading's ⓘ marker whose every term is underlined in the body of the same panel or step,
 * where the player finds it explained already. A marker stays only where its heading is the one place a term appears,
 * such as a step that is closed with only its heading and why.
 */
function markExplainedHeadings(root: ParentNode): void {
  for (const marker of root.querySelectorAll(".term-marker[data-terms]")) {
    const scope = marker.closest(markerScopes);
    const inBody = [...(scope ?? root).querySelectorAll(".term[data-term]")]
      .filter(
        (term) =>
          !term.closest(headings) && term.closest(markerScopes) === scope,
      )
      .map((term) => term.getAttribute("data-term"));
    const explained = (marker.getAttribute("data-terms") ?? "")
      .split("|")
      .every((term) => inBody.includes(term));
    if (explained) marker.setAttribute("data-repeat", "");
    else marker.removeAttribute("data-repeat");
  }
}

/** Keeps the marks up to date as the screen changes, before each change is drawn. Returns a function that stops it. */
export function watchRepeatedTerms(): () => void {
  let frame = 0;
  const update = () => {
    frame = 0;
    markRepeatedTerms(document);
    markExplainedHeadings(document);
  };
  // Only terms coming, going or changing matter, so text changing inside them, such as Mission Mode's date each day,
  // doesn't set it off. Marking changes only data-repeat, which this doesn't watch, so it can't set itself off either.
  const observer = new MutationObserver(() => {
    frame ||= requestAnimationFrame(update);
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributeFilter: ["data-term", "data-terms"],
  });
  update();
  return () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}
