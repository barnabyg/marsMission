import { termFor, termPattern } from "./tooltips";

interface GameTextProps {
  children: string;
  /** Set this inside a button, which can't contain another keyboard stop. */
  insideControl?: boolean;
}

/** Shows text with a tooltip on every game term in it. All text on screen should go through this. */
export function GameText({ children, insideControl = false }: GameTextProps) {
  const parts: React.ReactNode[] = [];
  let position = 0;
  for (const match of children.matchAll(termPattern)) {
    const term = termFor(match[0]);
    if (!term) continue;
    parts.push(children.slice(position, match.index));
    parts.push(
      <span
        key={match.index}
        className="term"
        data-term={term}
        {...(insideControl ? {} : { tabIndex: 0 })}
      >
        {match[0]}
      </span>,
    );
    position = match.index + match[0].length;
  }
  parts.push(children.slice(position));
  return <>{parts}</>;
}
