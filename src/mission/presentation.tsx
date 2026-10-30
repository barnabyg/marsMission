import { createElement, type ComponentType } from "react";
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

/** Shows one timeline entry in whichever way the lookup says. */
export function EntryPresentation(props: EntryPresentationProps) {
  const { entry } = props;
  const key = `${entry.kind}:${entry.eventId}:${entry.outcome}`;
  return createElement(presentations[key] ?? TextScreen, props);
}
