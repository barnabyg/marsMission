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

/**
 * Every Mission Event of the Turn, in the order it happened, with its outcome: the Mission's and any journey home's.
 * The Turn summary lists them, so that skipping the rest of the Turn in Mission Mode loses none of them.
 */
export function turnMissionEvents(timeline: Timeline): TurnMissionEvent[] {
  return timeline.entries
    .filter(
      (entry): entry is Extract<TimelineEntry, { kind: "missionEvent" }> =>
        entry.kind === "missionEvent",
    )
    .map(({ day, title, description, outcome }) => ({
      date: addDays(timeline.startDate, day),
      title,
      description,
      failed: outcome === "failure",
    }));
}
