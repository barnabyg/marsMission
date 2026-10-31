import type { TimelineEntry } from "../simulation/simulation";

/**
 * The views Mission Mode can show, in the order the buttons list them. Adding a view here makes
 * MissionScene ask for its camera shot, and gives it a button. Views only display a Timeline, so
 * which one is showing can't change any results.
 */
export const missionViews = [
  { id: "solarSystem", name: "Solar system" },
  { id: "marsOrbit", name: "Mars orbit" },
  { id: "surface", name: "Surface" },
] as const;

export type MissionViewId = (typeof missionViews)[number]["id"];

export function viewName(view: MissionViewId): string {
  return missionViews.find(({ id }) => id === view)?.name ?? view;
}

/** The Mission Events with a view of their own, whether they succeed or fail. */
const viewsOfMissionEvents: Partial<Record<string, MissionViewId>> = {
  "mars-orbit-insertion": "marsOrbit",
  "entry-descent-landing": "marsOrbit",
};

/**
 * Matches a timeline entry to the view it moves Mission Mode to, or null to leave the view alone.
 * This is the only place that does, and it only reads the Timeline, so it can't change any rules.
 */
export function viewAskedForBy(entry: TimelineEntry): MissionViewId | null {
  return entry.kind === "missionEvent"
    ? (viewsOfMissionEvents[entry.eventId] ?? null)
    : null;
}

/** The view the player last chose, and how many entries had happened when they did. */
export interface ViewChoice {
  view: MissionViewId;
  entriesHappened: number;
}

export const startingChoice: ViewChoice = {
  view: "solarSystem",
  entriesHappened: 0,
};

/**
 * The view showing now: that of the latest entry to ask for one since the player's last choice,
 * or else that choice. It depends only on how many entries have happened, so it comes out the
 * same at every speed, however many of them happen in one frame.
 */
export function currentView(
  entries: readonly TimelineEntry[],
  entriesHappened: number,
  choice: ViewChoice,
): MissionViewId {
  const asked = entries
    .slice(choice.entriesHappened, entriesHappened)
    .map(viewAskedForBy)
    .findLast((view) => view !== null);
  return asked ?? choice.view;
}

/**
 * Hands over to Mars orbit when the surface view has no Landing Site left to show, such as when the
 * only landing on its way is lost. A landing is on its way from the start of a Turn and its Assets
 * operate from the day it's delivered, so once a Turn has lost its last site it never gets one back.
 */
export function viewWithSites(
  view: MissionViewId,
  sites: readonly string[],
): MissionViewId {
  return view === "surface" && sites.length === 0 ? "marsOrbit" : view;
}
