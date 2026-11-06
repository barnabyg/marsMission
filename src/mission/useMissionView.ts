import { useState } from "react";
import type { TimelineEntry } from "../simulation/simulation";
import {
  currentView,
  landingSitePick,
  startingChoice,
  viewWithSites,
  viewWithSpacecraft,
  type MissionViewId,
  type SitePick,
  type ViewChoice,
} from "./missionViews";
import { siteShown } from "./surface/surface";

interface MissionView {
  view: MissionViewId;
  chooseView: (view: MissionViewId) => void;
  /** The Landing Site the surface view shows, or null if there's none to show. */
  site: string | null;
  pickSite: (siteName: string) => void;
}

/** Which view Mission Mode is showing, and which Landing Site. It stays out of playback and the Simulation, because it changes neither. */
export function useMissionView(
  entries: readonly TimelineEntry[],
  entriesHappened: number,
  sites: readonly string[],
  /** Where the spacecraft view hands over to, or null while it has something to show. */
  spacecraftFallback: MissionViewId | null,
  /** Whether the entry at this index isn't asking for its view now: it has finished playing, or waits for one that hasn't. */
  hasPlayed: (entryIndex: number) => boolean,
  /** Where the Turn's Mars ascent lifts off from, if it has one. */
  ascentSite: string | null,
): MissionView {
  const [choice, setChoice] = useState<ViewChoice>(startingChoice);
  const [pick, setPick] = useState<SitePick>({
    siteName: null,
    entriesHappened: 0,
  });
  return {
    view: viewWithSites(
      viewWithSpacecraft(
        currentView(entries, entriesHappened, choice, hasPlayed),
        spacecraftFallback,
      ),
      sites,
    ),
    chooseView: (view) => {
      setChoice({ view, entriesHappened });
    },
    site: siteShown(
      sites,
      landingSitePick(entries, entriesHappened, pick, ascentSite),
    ),
    pickSite: (siteName) => {
      setPick({ siteName, entriesHappened });
    },
  };
}
