import type { Catalogue } from "../catalogue/catalogue";
import type { CrewAtWork } from "./crewAtMars";
import {
  crewKeyOf,
  locationNameOf,
  placeFor,
  type CrewMemberAtMars,
} from "./crewPlaces";
import { crewDeliveryDayOf, type MissionOutcome } from "./flight";
import { bothLost, type HealthLost } from "./health";
import { daysBetween, type Rules } from "./rules";
import type { AssetAtMars, CrewArrivedEntry, MissionAsset } from "./timeline";
import type { TurnSummary } from "./turnSummary";
import type { Program, TurnPlan } from "./types";

/** How the Crew at Mars show to the player: in the events column, in Mission Mode's views and in the Turn summary. */

// Slow to create, and balance runs fly a great many Missions.
const listOfNames = new Intl.ListFormat("en");

/**
 * What each Crew member lost in Health this Turn and why, whatever became of them: first those already at Mars, with
 * what they lost on the way home after what they lost at Mars if they left, then those the Mission carried, with what
 * they lost at Mars after what they lost on the way. Anyone who lost none is left out.
 */
export function healthLostSummary(
  atWork: CrewAtWork[],
  flown: Pick<MissionOutcome, "crewHealth">,
  homeward: Pick<MissionOutcome, "crewHealth"> | null,
): TurnSummary["healthLost"] {
  const stays = atWork.flatMap(({ stays: here }) => here);
  const atMars = (name: string) =>
    stays.find(({ member }) => member.name === name)?.health;
  const flownNames = new Set(flown.crewHealth.map(({ name }) => name));
  // What Protection saved is left out for those it saved nothing, such as Crew with none.
  const withSaved = (name: string, lost: HealthLost[], saved: number) => ({
    name,
    lost,
    ...(saved > 0 ? { savedByProtection: saved } : {}),
  });
  return [
    ...stays
      .filter(({ member }) => !flownNames.has(member.name))
      .map(({ member, health }) => {
        const home = homeward?.crewHealth.find(
          ({ name }) => name === member.name,
        );
        return withSaved(
          member.name,
          bothLost(health.lost, home?.lost ?? []),
          health.saved + (home?.saved ?? 0),
        );
      }),
    ...flown.crewHealth.map(({ name, lost, saved }) =>
      withSaved(
        name,
        bothLost(lost, atMars(name)?.lost ?? []),
        saved + (atMars(name)?.saved ?? 0),
      ),
    ),
  ].filter(({ lost }) => lost.length > 0);
}

/** The events column's entry for the Crew arriving in Mars orbit or landing, if they did. */
export function crewArrivedEntry(
  catalogue: Catalogue,
  rules: Rules,
  plan: TurnPlan,
  flown: Pick<MissionOutcome, "heldLanding">,
  arrived: CrewMemberAtMars[],
  crewActivities: Record<string, string>,
): CrewArrivedEntry[] {
  const [first] = arrived;
  if (!first) return [];
  const where = locationNameOf(rules, first.location);
  const activityId = crewActivities[crewKeyOf(first.location)] ?? "";
  const doing = rules.activityById(activityId);
  const how = first.location.kind === "marsOrbit" ? "arrived" : "landed";
  return [
    {
      kind: "crewArrived",
      day: crewDeliveryDayOf(rules, plan, flown),
      title: `Crew in ${where}`,
      description: `${listOfNames.format(arrived.map(({ name }) => name))} have ${how} in ${where} aboard the ${catalogue.crew.vehicleName}, and ${
        doing?.effect.kind === "research" ? `start ${doing.name}` : "rest"
      }.`,
    },
  ];
}

/** The Crewed Mission's ship as Mission Mode shows it on its way, if the Mission carried Crew. */
export function crewShipOnMission(
  catalogue: Catalogue,
  rules: Rules,
  plan: TurnPlan,
  flown: Pick<
    MissionOutcome,
    "deliveredCrew" | "failedOnDay" | "failedEvent" | "heldLanding"
  >,
): MissionAsset[] {
  if (!plan.mission?.crew) return [];
  const delivered = flown.deliveredCrew.length > 0;
  const place = placeFor(plan.mission);
  const lands = place.kind === "landingSite";
  return [
    {
      name: catalogue.crew.vehicleName,
      kind: "crew",
      landingSiteName: lands ? locationNameOf(rules, place) : null,
      deliveredOnDay: delivered ? crewDeliveryDayOf(rules, plan, flown) : null,
      lostOnDay: delivered ? null : flown.failedOnDay,
      crashed:
        !delivered &&
        lands &&
        // Crashing is failing a Mission Event that only landing brings.
        flown.failedEvent !== undefined &&
        catalogue.crew.landingMissionEvents.includes(flown.failedEvent.id) &&
        !catalogue.crew.missionEvents.includes(flown.failedEvent.id),
    },
  ];
}

/**
 * Each place's Crew as Mission Mode shows them at Mars: their ship, in orbit or standing at their Landing Site, from
 * the day the first of them is there until the last of them dies, with each Crew member's own days there. They get
 * about as their Activity has them do.
 */
export function crewShipsAtMars(
  catalogue: Catalogue,
  rules: Rules,
  program: Program,
  atWork: CrewAtWork[],
): AssetAtMars[] {
  return atWork.map(({ key, place, locationName, activityId, stays }) => {
    const crew = stays.map(({ member, fromDay, untilDay, shelter }) => ({
      name: member.name,
      arrivedOnDay: daysBetween(program.date, member.arrivedOn),
      fromDay,
      untilDay,
      ...(shelter ? { shelter } : {}),
    }));
    return {
      key: `crew:${key}`,
      name: catalogue.crew.vehicleName,
      kind: "crew",
      landingSiteName: place.kind === "landingSite" ? locationName : null,
      activityName: rules.activityNameOf({ activityId }),
      surfaceMotion: rules.surfaceMotionOf({ activityId }),
      arrivedOnDay: Math.min(...crew.map(({ arrivedOnDay }) => arrivedOnDay)),
      fromDay: Math.min(...crew.map(({ fromDay }) => fromDay)),
      untilDay: crew.every(({ untilDay }) => untilDay !== null)
        ? Math.max(...crew.map(({ untilDay }) => untilDay ?? 0))
        : null,
      crew,
    };
  });
}

/** Every Crew member at Mars at the end of the Turn, with their Health, for the Turn summary. */
export function crewSummary(
  catalogue: Catalogue,
  atWork: CrewAtWork[],
): TurnSummary["crew"] {
  return atWork.flatMap(({ stays, locationName }) =>
    stays.flatMap(({ member, fromDay, untilDay, health }) =>
      untilDay !== null
        ? []
        : [
            {
              name: member.name,
              locationName,
              health: health.health,
              maxHealth: catalogue.crew.maxHealth,
              arrived: fromDay > 0,
            },
          ],
    ),
  );
}
