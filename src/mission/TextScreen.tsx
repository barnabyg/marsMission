import { GameText } from "../ui/GameText";
import type { EntryPresentationProps } from "./presentation";

export function TextScreen({ entry, onDismiss }: EntryPresentationProps) {
  const failed = entry.kind === "missionEvent" && entry.outcome === "failure";
  return (
    <section
      className={failed ? "text-screen failed" : "text-screen"}
      data-testid="text-screen"
    >
      <h2>
        <GameText>{entry.title}</GameText>
      </h2>
      <p>
        <GameText>{entry.description}</GameText>
      </p>
      <button type="button" className="primary" onClick={onDismiss}>
        Continue
      </button>
    </section>
  );
}
