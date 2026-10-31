import { useState } from "react";
import type { TimelineEntry } from "../simulation/simulation";
import {
  currentView,
  landingSitePick,
  startingChoice,
  viewWithSites,
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
): MissionView {
  const [choice, setChoice] = useState<ViewChoice>(startingChoice);
  const [pick, setPick] = useState<SitePick>({
    siteName: null,
    entriesHappened: 0,
  });
  return {
    view: viewWithSites(currentView(entries, entriesHappened, choice), sites),
    chooseView: (view) => {
      setChoice({ view, entriesHappened });
    },
    site: siteShown(sites, landingSitePick(entries, entriesHappened, pick)),
    pickSite: (siteName) => {
      setPick({ siteName, entriesHappened });
    },
  };
}
