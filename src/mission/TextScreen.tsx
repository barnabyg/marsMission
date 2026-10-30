import { GameText } from "../ui/GameText";
import type { EntryPresentationProps } from "./presentation";

export function TextScreen({ entry, onDismiss }: EntryPresentationProps) {
  return (
    <section className="text-screen" data-testid="text-screen">
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
