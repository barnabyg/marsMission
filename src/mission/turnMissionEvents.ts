import {
  addDays,
  type Timeline,
  type TimelineEntry,
} from "../simulation/simulation";

/** One Mission Event of the Turn as the Turn summary lists it. */
export interface TurnMissionEvent {
  /** The ISO date it happened. */
  date: string;
  /** As the events column shows it, which says when it failed or a Contingency saved it. */
  title: string;
  description: string;
  failed: boolean;
}

type ListedEntry = Extract<
  TimelineEntry,
  { kind: "missionEvent" | "hazard" | "missionReturned" }
>;

function isListed(entry: TimelineEntry): entry is ListedEntry {
  return (
    entry.kind === "missionEvent" ||
    entry.kind === "hazard" ||
    entry.kind === "missionReturned"
  );
}

/**
 * Every Mission Event of the Turn, in the order it happened, with its outcome: the Mission's and any journey home's,
 * with the Hazards met on the way and a Free-return's coming back to Earth.
 * The Turn summary lists them, so that skipping the rest of the Turn in Mission Mode loses none of them.
 */
export function turnMissionEvents(timeline: Timeline): TurnMissionEvent[] {
  return timeline.entries.filter(isListed).map((entry) => ({
    date: addDays(timeline.startDate, entry.day),
    title: entry.title,
    description: entry.description,
    failed: entry.kind === "missionEvent" && entry.outcome === "failure",
  }));
}
