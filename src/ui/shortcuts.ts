/**
 * Where a key press happened, as the game's keyboard shortcuts see it:
 * - `blocked`: leave it alone, because it's held with Ctrl, Alt or the system key, held down to repeat, typed into a
 *   field or list, or made while a dialog is open
 * - `control`: on a button or link, which Space and Enter press, so a shortcut on either of those keys gives way
 * - `page`: anywhere else
 */
export type KeyPlace = "blocked" | "control" | "page";

export function keyPlace(event: KeyboardEvent): KeyPlace {
  if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) {
    return "blocked";
  }
  if (document.querySelector("dialog[open]")) return "blocked";
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest("input, select, textarea, [contenteditable='true']")) {
    return "blocked";
  }
  return target?.closest("button, a[href], summary") ? "control" : "page";
}
