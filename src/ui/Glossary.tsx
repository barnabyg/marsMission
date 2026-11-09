import { useEffect, useState } from "react";
import { Dialog } from "./Dialog";
import { GameText } from "./GameText";
import { keyPlace } from "./shortcuts";
import { tooltips, type Term } from "./tooltips";

/** The key that opens the glossary, anywhere in the game. */
export const glossaryKey = "?";

const openEvent = "mars-mission:open-glossary";

/** Opens the glossary, as its key does, for a button that offers it. */
export function openGlossary() {
  window.dispatchEvent(new Event(openEvent));
}

/**
 * The game terms named by these `data-term` or `data-terms` values, each once, in alphabetical order. A heading's ⓘ
 * marker names several, split by "|".
 */
export function glossaryTerms(names: readonly (string | null)[]): Term[] {
  const terms = new Set<Term>();
  for (const name of names) {
    for (const term of (name ?? "").split("|")) {
      if (term in tooltips) terms.add(term as Term);
    }
  }
  return [...terms].sort((first, second) => first.localeCompare(second));
}

/** Every term with a tooltip on screen now, leaving out any hidden, such as a heading's marker its panel explains. */
function termsOnScreen(): Term[] {
  return glossaryTerms(
    [...document.querySelectorAll("[data-term], [data-terms]")]
      .filter((element) => element.getClientRects().length > 0)
      .map(
        (element) =>
          element.getAttribute("data-term") ??
          element.getAttribute("data-terms"),
      ),
  );
}

/**
 * The glossary: every game term on screen with what it means, as its tooltip says. It is how the keyboard reaches what
 * the terms' tooltips explain, since terms aren't tab stops. `?` opens it from any screen, unless the player is typing
 * or a dialog is already open.
 */
export function GlossaryLayer() {
  /** The terms it lists, taken as it opens, or null while it is closed. */
  const [terms, setTerms] = useState<Term[] | null>(null);

  useEffect(() => {
    const open = () => {
      setTerms((current) => current ?? termsOnScreen());
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== glossaryKey || keyPlace(event) === "blocked") return;
      event.preventDefault();
      open();
    };
    window.addEventListener(openEvent, open);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(openEvent, open);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!terms) return null;
  return (
    <Dialog
      title="Glossary"
      cancelLabel="Close"
      className="glossary"
      onClose={() => {
        setTerms(null);
      }}
    >
      {terms.length === 0 ? (
        <p>Nothing on screen names a game term.</p>
      ) : (
        <dl data-testid="glossary">
          {terms.map((term) => (
            <div key={term}>
              <dt>
                <GameText>{term}</GameText>
              </dt>
              <dd>
                <GameText>{tooltips[term]}</GameText>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Dialog>
  );
}
