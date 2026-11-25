import type { Timeline, TimelineEntry } from "../simulation/simulation";
import { homewardPlayMs, homewardPartOf } from "./homeward";
import { captureMs } from "./marsOrbit/capture";
import { launchDurationMs } from "./launch/launch";
import { viewAskedForBy } from "./missionViews";
import type { PlaybackTimeline } from "./playback";
import { rendezvousMs, tankerSceneMs } from "./spacecraft/refuelling";
import { transferBurnMs } from "./spacecraft/transferBurn";
import { particlesShownMs } from "./spacecraft/spacecraft";
import { sequenceMs } from "./surface/sequence";

/** The screen time each existing animation needs before another event can take its camera. */
function durationOf(entry: TimelineEntry): number {
  if (entry.kind === "hazard" && entry.hazard === "solarParticleEvent")
    return particlesShownMs;
  if (entry.kind !== "missionEvent") return 0;
  const homeward = homewardPartOf(entry);
  if (homeward !== null) return homewardPlayMs[homeward];
  switch (entry.eventId) {
    case "launch":
      return launchDurationMs;
    case "tanker-launch":
      return tankerSceneMs;
    case "rendezvous":
      return rendezvousMs;
    case "mars-orbit-insertion":
      return captureMs;
    case "entry-descent-landing":
      return sequenceMs;
    case "mars-transfer-burn":
      return transferBurnMs;
    default:
      return 0;
  }
}

export function cutsceneTimeline(timeline: Timeline): PlaybackTimeline {
  return {
    durationDays: timeline.durationDays,
    decisionDay: timeline.decisionDay,
    entries: timeline.entries.map((entry) => ({
      day: entry.day,
      title: entry.title,
      sceneMs: durationOf(entry),
      waitsForScene:
        entry.kind === "missionEvent" || viewAskedForBy(entry) !== null,
    })),
  };
}
