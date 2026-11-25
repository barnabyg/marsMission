import type { Timeline, TimelineEntry } from "../simulation/simulation";
import { homewardPlayMs, homewardPartOf } from "./homeward";
import { launchDurationMs } from "./launch/launch";
import { viewAskedForBy } from "./missionViews";
import type { PlaybackTimeline } from "./playback";
import { rendezvousMs, tankerClimbMs } from "./spacecraft/refuelling";
import { lossShownMs, particlesShownMs } from "./spacecraft/spacecraft";
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
      return entry.outcome === "failure" ? rendezvousMs : tankerClimbMs;
    case "rendezvous":
      return rendezvousMs;
    case "entry-descent-landing":
      return sequenceMs;
    case "mars-transfer-burn":
      return entry.outcome === "failure" ? lossShownMs : 0;
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
