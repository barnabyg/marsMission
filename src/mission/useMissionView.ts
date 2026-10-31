import { useState } from "react";
import type { TimelineEntry } from "../simulation/simulation";
import {
  currentView,
  startingChoice,
  viewWithSites,
  type MissionViewId,
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
  const [pickedSite, pickSite] = useState<string | null>(null);
  return {
    view: viewWithSites(currentView(entries, entriesHappened, choice), sites),
    chooseView: (view) => {
      setChoice({ view, entriesHappened });
    },
    site: siteShown(sites, pickedSite),
    pickSite,
  };
}
