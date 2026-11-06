import type { TimelineEntry } from "../simulation/simulation";
import { homewardEventIds } from "./homeward";

/**
 * The views Mission Mode can show, in the order the buttons list them. Adding a view here makes
 * MissionScene ask for its camera shot, and gives it a button. Views only display a Timeline, so
 * which one is showing can't change any results.
 */
export const missionViews = [
  { id: "solarSystem", name: "Solar system" },
  { id: "marsOrbit", name: "Mars orbit" },
  { id: "surface", name: "Surface" },
  { id: "spacecraft", name: "Spacecraft" },
] as const;

export type MissionViewId = (typeof missionViews)[number]["id"];

export function viewName(view: MissionViewId): string {
  return missionViews.find(({ id }) => id === view)?.name ?? view;
}

/** The Mission Events with a view of their own, whether they succeed or fail. */
const viewsOfMissionEvents: Partial<Record<string, MissionViewId>> = {
  // Only while it plays: Mission Mode then moves back to where it was, as the Mission leaves Earth orbit.
  rendezvous: "spacecraft",
  "mars-orbit-insertion": "marsOrbit",
  "entry-descent-landing": "surface",
};

/**
 * The way home's Mission Events, each with a view of its own: Mars ascent at the Landing Site, the rendezvous and Earth
 * entry close up, only while each plays, and the way home in the solar system.
 */
const viewsOfHomewardEvents: Partial<Record<string, MissionViewId>> = {
  [homewardEventIds.ascent]: "surface",
  [homewardEventIds.rendezvous]: "spacecraft",
  [homewardEventIds.departure]: "solarSystem",
  [homewardEventIds.entry]: "spacecraft",
};

/** The burn that sends a Mission on its way to Mars, which the spacecraft view shows only when it goes wrong. */
const transferBurnId = "mars-transfer-burn";

/**
 * Matches a timeline entry to the view it moves Mission Mode to, or null to leave the view alone.
 * This is the only place that does, and it only reads the Timeline, so it can't change any rules.
 */
export function viewAskedForBy(entry: TimelineEntry): MissionViewId | null {
  if (entry.kind === "decisionPoint") {
    if (entry.hazard === "dustStorm") return "surface";
    // Trouble on the way to Mars, close up: a solar particle event, or the transfer burn failing.
    return entry.hazard === "solarParticleEvent" ||
      entry.eventId === transferBurnId
      ? "spacecraft"
      : null;
  }
  if (entry.kind !== "missionEvent") return null;
  if (entry.homeward) return viewsOfHomewardEvents[entry.eventId] ?? null;
  // A failure that swings the Mission back is one to watch on its way home.
  if (entry.returningToEarth) return "solarSystem";
  if (entry.eventId === transferBurnId) {
    return entry.outcome === "failure" ? "spacecraft" : null;
  }
  return viewsOfMissionEvents[entry.eventId] ?? null;
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
 * or else that choice. It depends only on how many entries have happened, and on which of them
 * have finished playing, which goes by real time played, so it comes out the same at every speed,
 * however many of them happen in one frame.
 */
export function currentView(
  entries: readonly TimelineEntry[],
  entriesHappened: number,
  choice: ViewChoice,
  /**
   * Whether the entry at this index isn't asking for its view now: it has finished playing, such as a rendezvous, or is
   * waiting for one before it to finish, such as the journey home leaving Mars orbit.
   */
  hasPlayed: (entryIndex: number) => boolean = () => false,
): MissionViewId {
  const asked = entries
    .slice(choice.entriesHappened, entriesHappened)
    .map((entry, index) =>
      hasPlayed(choice.entriesHappened + index) ? null : viewAskedForBy(entry),
    )
    .findLast((view) => view !== null);
  return asked ?? choice.view;
}

/** The Landing Site the player last picked, and how many entries had happened when they did. */
export interface SitePick {
  siteName: string | null;
  entriesHappened: number;
}

/**
 * The player's pick, unless a landing, Mars ascent or a Hazard at a site has happened since, which the camera goes to
 * instead. `ascentSite` is where the Turn's Mars ascent lifts off from, if it has one.
 */
export function landingSitePick(
  entries: readonly TimelineEntry[],
  entriesHappened: number,
  pick: SitePick,
  ascentSite: string | null = null,
): string | null {
  const latest = entries
    .slice(pick.entriesHappened, entriesHappened)
    .findLast((entry) => viewAskedForBy(entry) === "surface");
  if (!latest) return pick.siteName;
  if (latest.kind === "missionEvent" && latest.homeward) return ascentSite;
  return latest.kind === "decisionPoint" ? (latest.siteName ?? null) : null;
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

/**
 * Hands over from the spacecraft view when it has nothing left to show, such as once the Mission has arrived or a
 * moment after it's lost on the way. `fallback` is where to go then, or null while it still has something to show.
 */
export function viewWithSpacecraft(
  view: MissionViewId,
  fallback: MissionViewId | null,
): MissionViewId {
  return view === "spacecraft" && fallback !== null ? fallback : view;
}
