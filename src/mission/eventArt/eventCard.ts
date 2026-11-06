import type { TimelineEntry } from "../../simulation/simulation";
import type { IconName } from "../../ui/Icon";

/** The pictures the events column can show, one for each kind of thing that happens. */
export type EventPicture =
  | "launch"
  | "tankerLaunch"
  | "rendezvous"
  | "transferBurn"
  | "orbitInsertion"
  | "entryDescentLanding"
  | "spacecraft"
  | "missionReturned"
  | "dustStorm"
  | "solarParticleEvent"
  | "milestone"
  | "fundingThreshold"
  | "firstLanding"
  | "survey"
  | "flightProven"
  | "crewArrived"
  | "crewLost"
  | "suppliesOut"
  | "assetEnded"
  | "assetFailed";

/** How the events column shows one entry: its picture, the tag beside its date, and whether it went wrong. */
export interface EventCard {
  picture: EventPicture;
  /** A game term naming what kind of entry it is. */
  tag: string;
  icon: IconName;
  failed: boolean;
}

/** The pictures of the Mission Events in `public/data/mission-events.json`, by id. */
export const missionEventPictures: Readonly<Record<string, EventPicture>> = {
  launch: "launch",
  "tanker-launch": "tankerLaunch",
  rendezvous: "rendezvous",
  "mars-transfer-burn": "transferBurn",
  "mars-orbit-insertion": "orbitInsertion",
  "entry-descent-landing": "entryDescentLanding",
  // The journey home borrows the pictures nearest it until it has its own: a burn leaving orbit, and a return to Earth.
  "trans-earth-injection": "transferBurn",
  "earth-entry": "missionReturned",
};

/** A Mission Event's picture, or a plain spacecraft for one with no picture of its own. */
export function missionEventPicture(eventId: string): EventPicture {
  return missionEventPictures[eventId] ?? "spacecraft";
}

const hazardPictures = {
  dustStorm: "dustStorm",
  solarParticleEvent: "solarParticleEvent",
} as const satisfies Record<string, EventPicture>;

/** Works out how the events column shows an entry. */
export function eventCardFor(entry: TimelineEntry): EventCard {
  switch (entry.kind) {
    case "missionEvent":
      return {
        picture: missionEventPicture(entry.eventId),
        tag: "Mission Event",
        icon: "rocket",
        failed: entry.outcome === "failure",
      };
    case "missionReturned":
      return card("missionReturned", "Mission", "rocket");
    case "decisionPoint":
      return {
        picture: entry.hazard
          ? hazardPictures[entry.hazard]
          : entry.eventId
            ? missionEventPicture(entry.eventId)
            : "spacecraft",
        tag: "Decision Point",
        icon: "alert-triangle",
        failed: true,
      };
    case "hazard":
      return card(hazardPictures[entry.hazard], "Hazard", "shield-alert");
    case "milestone":
      return card("milestone", "Milestone", "trophy");
    case "fundingThreshold":
      return card("fundingThreshold", "Funding Threshold", "coins");
    case "firstLanding":
      return card("firstLanding", "Landing Site", "target");
    case "survey":
      return card("survey", "Survey", "flask-conical");
    case "flightProven":
      return card("flightProven", "Flight-proven", "award");
    case "crewArrived":
      return card("crewArrived", "Crew", "users");
    case "crewHome":
      return card("missionReturned", "Crew", "users");
    case "crewLost":
      return { ...card("crewLost", "Crew", "heart"), failed: true };
    case "suppliesOut":
      return { ...card("suppliesOut", "Supplies", "package"), failed: true };
    case "assetEnded":
      return card("assetEnded", "Asset", "hourglass");
    case "assetFailed":
      return {
        ...card("assetFailed", "Asset", "alert-triangle"),
        failed: true,
      };
  }
}

function card(picture: EventPicture, tag: string, icon: IconName): EventCard {
  return { picture, tag, icon, failed: false };
}
