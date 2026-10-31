import { useState } from "react";
import type { MissionViewId } from "./missionViews";

interface MissionView {
  view: MissionViewId;
  chooseView: (view: MissionViewId) => void;
}

/** Which view Mission Mode is showing. It stays out of playback and the Simulation, because it changes neither. */
export function useMissionView(): MissionView {
  const [view, chooseView] = useState<MissionViewId>("solarSystem");
  return { view, chooseView };
}
