import type { ComponentType } from "react";
import type { TimelineEntry } from "../simulation/simulation";
import { TextScreen } from "./TextScreen";

export interface EntryPresentationProps {
  entry: TimelineEntry;
  onDismiss: () => void;
}

/**
 * Matches each kind of timeline entry to what Mission Mode shows. Anything without its own
 * animation falls back to a text screen, so adding an animation means adding an entry here.
 */
const presentations: Partial<
  Record<string, ComponentType<EntryPresentationProps>>
> = {};

export function presentationFor(
  entry: TimelineEntry,
): ComponentType<EntryPresentationProps> {
  const key = `${entry.kind}:${entry.eventId}:${entry.outcome}`;
  return presentations[key] ?? TextScreen;
}
