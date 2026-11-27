/**
 * Runs in the page: finds the controls and game terms a player could use on the screen as it stands, tags each with an
 * id the browser adapter can find it by, and names it as a screen reader would. While a dialog is open, only what is in
 * it counts, as the rest of the page is behind it.
 *
 * It must stay self-contained, because Playwright sends its source to the page.
 */

export interface PageControl {
  id: string;
  type: "button" | "checkbox" | "radio" | "select" | "link" | "term";
  label: string;
  checked: boolean;
  options: { value: string; text: string }[];
}

export interface PageControls {
  heading: string;
  dialog: string | null;
  controls: PageControl[];
}

export function findPageControls(): PageControls {
  const dialog = document.querySelector("dialog[open]");
  const scope: ParentNode = dialog ?? document;
  const clean = (text: string | null | undefined) =>
    (text ?? "").replace(/\s+/g, " ").trim();
  const visible = (element: Element) => {
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return false;
    const style = getComputedStyle(element);
    return style.visibility !== "hidden" && style.display !== "none";
  };
  const labelOf = (element: Element): string => {
    const aria = element.getAttribute("aria-label");
    if (aria) return clean(aria);
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      return clean(
        labelledBy
          .split(" ")
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" "),
      );
    }
    if (
      (element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement) &&
      element.labels &&
      element.labels.length > 0
    ) {
      // A label wrapped round its control would otherwise read out every option of a select too.
      const label = element.labels[0]?.cloneNode(true);
      if (label instanceof Element) {
        label.querySelectorAll("select, input").forEach((inner) => {
          inner.remove();
        });
        return clean(label.textContent);
      }
    }
    return clean(element.textContent);
  };
  const unavailable = (element: Element) =>
    element.hasAttribute("disabled") ||
    element.getAttribute("aria-disabled") === "true";

  const controls: PageControl[] = [];
  let next = 0;
  const tag = (element: Element) => {
    const id = String(next++);
    // A list, as one element can be both a control and a game term, such as an Activity's select.
    const ids = element.getAttribute("data-blind-id");
    element.setAttribute("data-blind-id", ids ? `${ids} ${id}` : id);
    return id;
  };
  for (const element of document.querySelectorAll("[data-blind-id]")) {
    element.removeAttribute("data-blind-id");
  }

  const selector =
    "button, a[href], select, input[type=checkbox], input[type=radio]";
  for (const element of scope.querySelectorAll(selector)) {
    if (!visible(element) || unavailable(element)) continue;
    const label = labelOf(element);
    if (!label) continue;
    if (element instanceof HTMLSelectElement) {
      controls.push({
        id: tag(element),
        type: "select",
        label,
        checked: false,
        options: [...element.options]
          .filter((option) => !option.disabled && !option.selected)
          .map((option) => ({
            value: option.value,
            text: clean(option.textContent),
          })),
      });
    } else if (element instanceof HTMLInputElement) {
      controls.push({
        id: tag(element),
        type: element.type === "radio" ? "radio" : "checkbox",
        label,
        checked: element.checked,
        options: [],
      });
    } else {
      controls.push({
        id: tag(element),
        type: element.tagName === "A" ? "link" : "button",
        label,
        checked: false,
        options: [],
      });
    }
  }

  const seenTerms = new Set<string>();
  for (const element of scope.querySelectorAll("[data-term], [data-terms]")) {
    if (!visible(element)) continue;
    const terms =
      element.getAttribute("data-term") ?? element.getAttribute("data-terms");
    const key = `${terms ?? ""}|${element.getAttribute("data-detail") ?? ""}`;
    if (seenTerms.has(key)) continue;
    seenTerms.add(key);
    const text = clean(element.textContent);
    controls.push({
      id: tag(element),
      type: "term",
      label: text && text !== "ⓘ" ? text : (terms ?? "").replace(/\|/g, ", "),
      checked: false,
      options: [],
    });
  }

  const heading = clean(document.querySelector("h1")?.textContent);
  const dialogName = dialog
    ? clean(
        dialog.getAttribute("aria-label") ??
          dialog.querySelector("h1, h2, h3")?.textContent,
      )
    : null;
  return { heading, dialog: dialogName, controls };
}
