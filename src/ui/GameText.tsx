import { termFor, termPattern, type Term } from "./tooltips";

interface GameTextProps {
  children: string;
  /**
   * Text in a panel or step heading, whose terms aren't underlined. A small ⓘ marker after it explains every term the
   * heading names on hover, shown only while the body under it doesn't underline them all (repeatedTerms.ts). It's
   * hidden from screen readers, leaving the heading's name as it reads: the glossary (Glossary.tsx) explains every term
   * on screen from the keyboard. An h1 names the mode the player is already in, so it takes no marker: leave this off for one.
   */
  heading?: boolean;
}

/**
 * Shows text with a tooltip on every game term in it. All text on screen should go through this, except button labels,
 * which are plain. Terms open their tooltip on hover but aren't tab stops, which would put dozens before each control:
 * the glossary lists them for the keyboard instead.
 */
export function GameText({ children, heading = false }: GameTextProps) {
  const parts: React.ReactNode[] = [];
  const terms: Term[] = [];
  let position = 0;
  for (const match of children.matchAll(termPattern)) {
    const term = termFor(match[0]);
    if (!term) continue;
    if (!terms.includes(term)) terms.push(term);
    parts.push(children.slice(position, match.index));
    parts.push(
      <span key={match.index} className="term" data-term={term}>
        {match[0]}
      </span>,
    );
    position = match.index + match[0].length;
  }
  parts.push(children.slice(position));
  if (heading && terms.length > 0) {
    parts.push(
      <span
        key="marker"
        className="term-marker"
        data-terms={terms.join("|")}
        aria-hidden="true"
      />,
    );
  }
  return <>{parts}</>;
}
