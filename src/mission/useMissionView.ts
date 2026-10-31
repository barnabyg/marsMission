import { useState } from "react";
import type { TimelineEntry } from "../simulation/simulation";
import {
  currentView,
  startingChoice,
  type MissionViewId,
  type ViewChoice,
} from "./missionViews";

interface MissionView {
  view: MissionViewId;
  chooseView: (view: MissionViewId) => void;
}

/** Which view Mission Mode is showing. It stays out of playback and the Simulation, because it changes neither. */
export function useMissionView(
  entries: readonly TimelineEntry[],
  entriesHappened: number,
): MissionView {
  const [choice, setChoice] = useState<ViewChoice>(startingChoice);
  return {
    view: currentView(entries, entriesHappened, choice),
    chooseView: (view) => {
      setChoice({ view, entriesHappened });
    },
  };
}
