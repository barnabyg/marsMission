import type { EntryPresentationProps } from "./presentation";

export function TextScreen({ entry, onDismiss }: EntryPresentationProps) {
  return (
    <section className="text-screen" data-testid="text-screen">
      <h2>{entry.title}</h2>
      <p>{entry.description}</p>
      <button type="button" className="primary" onClick={onDismiss}>
        Continue
      </button>
    </section>
  );
}
